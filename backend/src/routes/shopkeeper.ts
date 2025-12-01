import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, AuthRequest, authorizeRole } from "../middleware/authGuard";

const router = Router();

// GET /api/shopkeeper/customers/:shopId - Get all customers for a shop
router.get("/customers/:shopId", authenticateToken, authorizeRole("shopkeeper", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { shopId } = req.params;

    const [customers]: any = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.ration_card_number AS rationCardNumber,
        u.card_type AS cardType,
        u.family_size AS familySize,
        u.mobile_number AS mobileNumber,
        u.address
       FROM users u
       WHERE u.role = 'cardholder' AND u.shop_id = ?
       ORDER BY u.name`,
      [shopId]
    );

    return res.json({ success: true, data: customers });
  } catch (err) {
    console.error("GET /shopkeeper/customers error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customers" });
  }
});

// GET /api/shopkeeper/quota/:userId - Get customer's current month quota
router.get("/quota/:userId", authenticateToken, authorizeRole("shopkeeper", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // First check if allocations exist for current month
    let [allocations]: any = await pool.execute(
      `SELECT 
        id,
        item_code AS itemCode,
        eligible_quantity AS eligibleQuantity,
        collected_quantity AS collectedQuantity,
        month,
        year,
        DATE_FORMAT(collection_date, '%Y-%m-%d') AS collectionDate
       FROM monthly_allocations
       WHERE user_id = ? AND month = ? AND year = ?
       ORDER BY item_code`,
      [userId, currentMonth, currentYear]
    );

    // If no allocations exist, create them based on user's card type
    if (allocations.length === 0) {
      console.log(`📦 No allocations found for user ${userId} in ${currentMonth}/${currentYear}. Creating...`);
      
      // Get user's card type and family size
      const [userInfo]: any = await pool.execute(
        `SELECT card_type, family_size FROM users WHERE id = ?`,
        [userId]
      );
      
      if (userInfo.length > 0) {
        const { card_type, family_size } = userInfo[0];
        const familySize = family_size || 4;
        
        // Define allocations based on card type
        let items: { code: string; quantity: number }[] = [];
        
        switch (card_type) {
          case 'AAY':
            // Antyodaya: 35kg rice fixed
            items = [
              { code: 'rice', quantity: 35 },
              { code: 'wheat', quantity: 0 },
              { code: 'sugar', quantity: 5 }
            ];
            break;
          case 'PHH':
            // Priority Household: 5kg per member
            const phhTotal = familySize * 5;
            items = [
              { code: 'rice', quantity: Math.ceil(phhTotal * 0.6) },
              { code: 'wheat', quantity: Math.ceil(phhTotal * 0.4) },
              { code: 'sugar', quantity: Math.min(familySize, 5) }
            ];
            break;
          case 'BPL':
            // Below Poverty Line: 5kg per member
            const bplTotal = familySize * 5;
            items = [
              { code: 'rice', quantity: Math.ceil(bplTotal * 0.7) },
              { code: 'wheat', quantity: Math.ceil(bplTotal * 0.3) }
            ];
            break;
          case 'APL':
          default:
            // Above Poverty Line: 3kg per member (market rate subsidy)
            const aplTotal = familySize * 3;
            items = [
              { code: 'rice', quantity: Math.ceil(aplTotal * 0.6) },
              { code: 'wheat', quantity: Math.ceil(aplTotal * 0.4) },
              { code: 'sugar', quantity: 2 }
            ];
            break;
        }
        
        // Insert allocations
        for (const item of items) {
          if (item.quantity > 0) {
            await pool.execute(
              `INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year)
               VALUES (?, ?, ?, 0, ?, ?)`,
              [userId, item.code, item.quantity, currentMonth, currentYear]
            );
          }
        }
        
        console.log(`✅ Created ${items.length} allocations for user ${userId} (${card_type})`);
        
        // Re-fetch allocations
        [allocations] = await pool.execute(
          `SELECT 
            id,
            item_code AS itemCode,
            eligible_quantity AS eligibleQuantity,
            collected_quantity AS collectedQuantity,
            month,
            year,
            DATE_FORMAT(collection_date, '%Y-%m-%d') AS collectionDate
           FROM monthly_allocations
           WHERE user_id = ? AND month = ? AND year = ?
           ORDER BY item_code`,
          [userId, currentMonth, currentYear]
        );
      }
    }

    return res.json({ success: true, data: allocations });
  } catch (err) {
    console.error("GET /shopkeeper/quota error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch quota" });
  }
});

// PATCH /api/shopkeeper/quota/:userId - Update customer's collected quantity (distribution)
router.patch("/quota/:userId", authenticateToken, authorizeRole("shopkeeper", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { itemCode, newQuantity, reason } = req.body;
    const shopkeeperId = req.user?.userId;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (!itemCode || newQuantity === undefined) {
      return res.status(400).json({ success: false, error: "itemCode and newQuantity required" });
    }

    if (newQuantity < 0) {
      return res.status(400).json({ success: false, error: "Quantity cannot be negative" });
    }

    // Get current allocation
    const [existing]: any = await pool.execute(
      `SELECT id, eligible_quantity, collected_quantity FROM monthly_allocations
       WHERE user_id = ? AND item_code = ? AND month = ? AND year = ?`,
      [userId, itemCode, currentMonth, currentYear]
    );

    if (!existing.length) {
      return res.status(404).json({ success: false, error: "Allocation not found" });
    }

    const allocation = existing[0];
    const oldCollected = allocation.collected_quantity;

    // Check if new collected quantity exceeds eligible
    if (newQuantity > allocation.eligible_quantity) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot collect more than eligible amount (${allocation.eligible_quantity} kg)` 
      });
    }

    // Update collected quantity (not eligible quantity)
    await pool.execute(
      `UPDATE monthly_allocations 
       SET collected_quantity = ?, 
           collection_date = NOW(),
           last_modified_by = ?,
           modification_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newQuantity, shopkeeperId, reason || 'Distribution by shopkeeper', allocation.id]
    );

    // Log the change
    await pool.execute(
      `INSERT INTO quota_change_log 
       (allocation_id, user_id, item_code, month, year, old_quantity, new_quantity, change_amount, changed_by_user_id, changed_by_role, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        allocation.id,
        userId,
        itemCode,
        currentMonth,
        currentYear,
        oldCollected,
        newQuantity,
        newQuantity - oldCollected,
        shopkeeperId,
        req.user?.role || 'shopkeeper',
        reason || 'Ration distribution'
      ]
    );

    // Return updated allocation
    const [updated]: any = await pool.execute(
      `SELECT 
        id,
        item_code AS itemCode,
        eligible_quantity AS eligibleQuantity,
        collected_quantity AS collectedQuantity,
        month,
        year,
        DATE_FORMAT(collection_date, '%Y-%m-%d %H:%i:%s') AS collectionDate
       FROM monthly_allocations
       WHERE id = ?`,
      [allocation.id]
    );

    console.log(`✅ Distribution recorded for user ${userId}, ${itemCode}: ${oldCollected} → ${newQuantity} kg collected`);

    return res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error("PATCH /shopkeeper/quota error:", err);
    res.status(500).json({ success: false, error: "Failed to update quota" });
  }
});

// GET /api/shopkeeper/quota-history/:userId - Get quota change history
router.get("/quota-history/:userId", authenticateToken, authorizeRole("shopkeeper", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const [history]: any = await pool.execute(
      `SELECT 
        qcl.id,
        qcl.item_code AS itemCode,
        qcl.month,
        qcl.year,
        qcl.old_quantity AS oldQuantity,
        qcl.new_quantity AS newQuantity,
        qcl.change_amount AS changeAmount,
        qcl.changed_by_role AS changedByRole,
        u.name AS changedByName,
        qcl.reason,
        DATE_FORMAT(qcl.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM quota_change_log qcl
       JOIN users u ON qcl.changed_by_user_id = u.id
       WHERE qcl.user_id = ?
       ORDER BY qcl.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error("GET /shopkeeper/quota-history error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
});

export default router;
