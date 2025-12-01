import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, authorizeRole, AuthRequest } from "../middleware/authGuard";

const router = Router();

// GET /api/allocations/my → Get current user's own monthly allocations
router.get("/my", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    let [rows]: any = await pool.execute(
      `SELECT 
        id,
        item_code AS itemCode, 
        eligible_quantity AS eligibleQuantity,
        collected_quantity AS collectedQuantity, 
        month, 
        year,
        DATE_FORMAT(collection_date, '%Y-%m-%d %H:%i:%s') AS collectionDate
       FROM monthly_allocations
       WHERE user_id = ? AND month = ? AND year = ?
       ORDER BY item_code`,
      [userId, month, year]
    );

    // If no allocations exist for current month, create them automatically
    if (rows.length === 0) {
      console.log(`📦 No allocations found for user ${userId} in ${month}/${year}. Creating...`);
      
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
            items = [
              { code: 'rice', quantity: 35 },
              { code: 'wheat', quantity: 0 },
              { code: 'sugar', quantity: 5 }
            ];
            break;
          case 'PHH':
            const phhTotal = familySize * 5;
            items = [
              { code: 'rice', quantity: Math.ceil(phhTotal * 0.6) },
              { code: 'wheat', quantity: Math.ceil(phhTotal * 0.4) },
              { code: 'sugar', quantity: Math.min(familySize, 5) }
            ];
            break;
          case 'BPL':
            const bplTotal = familySize * 5;
            items = [
              { code: 'rice', quantity: Math.ceil(bplTotal * 0.7) },
              { code: 'wheat', quantity: Math.ceil(bplTotal * 0.3) }
            ];
            break;
          case 'APL':
          default:
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
              [userId, item.code, item.quantity, month, year]
            );
          }
        }
        
        console.log(`✅ Created ${items.length} allocations for user ${userId} (${card_type})`);
        
        // Re-fetch allocations
        [rows] = await pool.execute(
          `SELECT 
            id,
            item_code AS itemCode, 
            eligible_quantity AS eligibleQuantity,
            collected_quantity AS collectedQuantity, 
            month, 
            year,
            DATE_FORMAT(collection_date, '%Y-%m-%d %H:%i:%s') AS collectionDate
           FROM monthly_allocations
           WHERE user_id = ? AND month = ? AND year = ?
           ORDER BY item_code`,
          [userId, month, year]
        );
      }
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /allocations/my error:", err);
    return res.status(500).json({ success: false, error: "Failed to load allocations" });
  }
});

// GET /api/allocations → Get monthly allocations for logged-in user
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const [rows]: any = await pool.execute(
      `SELECT id, item_code AS itemCode, eligible_quantity AS eligibleQuantity,
              collected_quantity AS collectedQuantity, month, year,
              created_at AS createdAt, updated_at AS updatedAt
       FROM monthly_allocations
       WHERE user_id = ? AND month = ? AND year = ?
       ORDER BY item_code`,
      [userId, month, year]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET /allocations error:", err);
    return res.status(500).json({ error: "Failed to load allocations" });
  }
});

// POST /api/allocations → Create allocation (admin only)
router.post("/", authenticateToken, authorizeRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, itemCode, eligibleQuantity, month, year } = req.body;

    if (!userId || !itemCode || eligibleQuantity === undefined) {
      return res.status(400).json({ error: "userId, itemCode, eligibleQuantity required" });
    }

    const finalMonth = month || new Date().getMonth() + 1;
    const finalYear = year || new Date().getFullYear();

    const [result]: any = await pool.execute(
      `INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, month, year)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE eligible_quantity = VALUES(eligible_quantity)`,
      [userId, itemCode, Number(eligibleQuantity), finalMonth, finalYear]
    );

    const [rows]: any = await pool.execute(
      `SELECT id, item_code AS itemCode, eligible_quantity AS eligibleQuantity,
              collected_quantity AS collectedQuantity, month, year
       FROM monthly_allocations WHERE id = LAST_INSERT_ID()`,
      []
    );

    return res.json(rows[0] || { success: true, id: result.insertId });
  } catch (err) {
    console.error("POST /allocations error:", err);
    return res.status(500).json({ error: "Failed to create allocation" });
  }
});

// PATCH /api/allocations/:id → Update collected quantity (admin only)
router.patch("/:id", authenticateToken, authorizeRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { collectedQuantity } = req.body;

    if (collectedQuantity === undefined) {
      return res.status(400).json({ error: "collectedQuantity required" });
    }

    await pool.execute(
      `UPDATE monthly_allocations SET collected_quantity = ?, updated_at = NOW() WHERE id = ?`,
      [Number(collectedQuantity), id]
    );

    const [rows]: any = await pool.execute(
      `SELECT id, item_code AS itemCode, eligible_quantity AS eligibleQuantity,
              collected_quantity AS collectedQuantity, month, year
       FROM monthly_allocations WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /allocations/:id error:", err);
    return res.status(500).json({ error: "Failed to update allocation" });
  }
});

// GET /api/allocations/user/:userId/history → Get allocation history (last 6 months)
router.get("/user/:userId/history", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to view their own history, or admins to view anyone's
    if (req.user?.userId !== parseInt(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const [rows]: any = await pool.execute(
      `SELECT 
        item_code AS itemCode,
        eligible_quantity AS eligibleQuantity,
        collected_quantity AS collectedQuantity,
        month, 
        year,
        DATE_FORMAT(collection_date, '%Y-%m-%d') AS collectionDate,
        CONCAT(year, '-', LPAD(month, 2, '0')) AS period
       FROM monthly_allocations
       WHERE user_id = ?
       ORDER BY year DESC, month DESC
       LIMIT 6`,
      [userId]
    );

    // Group by month
    const grouped: any = {};
    rows.forEach((row: any) => {
      if (!grouped[row.period]) {
        grouped[row.period] = {
          month: row.month,
          year: row.year,
          items: []
        };
      }
      grouped[row.period].items.push({
        itemCode: row.itemCode,
        eligibleQuantity: row.eligibleQuantity,
        collectedQuantity: row.collectedQuantity,
        collectionDate: row.collectionDate
      });
    });

    const history = Object.values(grouped);

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error("GET /allocations/user/:userId/history error:", err);
    return res.status(500).json({ success: false, error: "Failed to load history" });
  }
});

export default router;
