import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, AuthRequest, authorizeRole } from "../middleware/authGuard";

const router = Router();

router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rawShopId = req.user?.shopId;

    // Normalize shopId (avoid "null" or "undefined" as strings)
    const shopId =
      rawShopId && rawShopId !== "null" && rawShopId !== "undefined"
        ? rawShopId
        : null;

    // Ensure limit is a clean number (default 20, max 100)
    let limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 100) limit = 100;

    console.log("DEBUG → shopId:", shopId, "limit:", limit);

    //-----------------------------------------------------
    // Build SQL dynamically
    //-----------------------------------------------------
    let sql = `
      SELECT id, shop_id AS shopId, user_id AS userId, type, message,
             is_sent AS isSent,
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
             DATE_FORMAT(acknowledged_at, '%Y-%m-%d %H:%i:%s') AS acknowledgedAt
      FROM notifications
    `;

    const params: any[] = [];

    // If user belongs to a shop → filter by shopId OR global notifications
    if (shopId) {
      sql += ` WHERE (shop_id = ? OR shop_id IS NULL) `;
      params.push(shopId);
    }
    // If user has no shop → only show global notifications
    else {
      sql += ` WHERE shop_id IS NULL `;
    }

    // MySQL does NOT accept LIMIT ? in prepared statements → embed directly
    sql += ` ORDER BY id DESC LIMIT ${limit}`;

    console.log("FINAL SQL:", sql);
    console.log("FINAL PARAMS:", params);

    //-----------------------------------------------------
    // Execute query
    //-----------------------------------------------------
    const [rows] = await pool.execute(sql, params);

    return res.json(rows);
  } catch (err) {
    console.error("GET /notifications error:", err);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { shopId, userId, type, message } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: "type and message are required" });
    }

    // Insert into database
    const [result]: any = await pool.execute(
      `
      INSERT INTO notifications (shop_id, user_id, type, message)
      VALUES (?, ?, ?, ?)
      `,
      [
        shopId || null,    // admin may send shopId or leave it null (global notification)
        userId || null,
        type,
        message
      ]
    );

    return res.json({
      success: true,
      id: result.insertId,
      message: "Notification created"
    });

  } catch (err) {
    console.error("POST /notifications error:", err);
    return res.status(500).json({ error: "Failed to create notification" });
  }
});

// PATCH /api/notifications/:id/ack → Acknowledge notification
router.patch("/:id/ack", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE notifications SET acknowledged_at = NOW() WHERE id = ?`,
      [id]
    );

    const [rows]: any = await pool.execute(
      `SELECT id, shop_id AS shopId, user_id AS userId, type, message,
              is_sent AS isSent,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
              DATE_FORMAT(acknowledged_at, '%Y-%m-%d %H:%i:%s') AS acknowledgedAt
       FROM notifications WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /notifications/:id/ack error:", err);
    return res.status(500).json({ error: "Failed to acknowledge notification" });
  }
});


export default router;
 
// -------------------------------------------------------------
// EXTRA: Broadcast token notifications by card type (shopkeeper)
// POST /api/notifications/broadcast/card-type
// Body: { cardType: 'BPL', intervalMinutes?: 15, startAt?: string(ISO) }
// Creates tokens in 15-minute slots and notifies only matching users.
// -------------------------------------------------------------
router.post(
  "/broadcast/card-type",
  authenticateToken,
  authorizeRole("shopkeeper", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      const { cardType, intervalMinutes, startAt } = req.body || {};

      if (!shopId) {
        return res.status(400).json({ error: "Missing shopId in user session" });
      }

      const validTypes = ["AAY", "PHH", "BPL", "APL"];
      if (!cardType || !validTypes.includes(cardType)) {
        return res.status(400).json({ error: "Invalid or missing cardType" });
      }

      const interval = Number(intervalMinutes) > 0 ? Number(intervalMinutes) : 15;

      // Start time → default to next quarter-hour from now
      const start = startAt ? new Date(startAt) : new Date();
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: "Invalid startAt timestamp" });
      }
      const remainder = start.getMinutes() % 15;
      if (remainder !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) {
        const add = (remainder === 0 ? 0 : 15 - remainder);
        start.setMinutes(start.getMinutes() + add);
        start.setSeconds(0, 0);
      }

      const formatSlot = (d: Date) => {
        let hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const mm = minutes.toString().padStart(2, "0");
        return `${hours}:${mm} ${ampm}`;
      };

      const dateStr = (d: Date) => d.toISOString().split("T")[0];

      // Fetch target users of this shop and cardType
      const [users]: any = await pool.execute(
        `SELECT id, name FROM users WHERE role = 'cardholder' AND shop_id = ? AND card_type = ? AND is_active = TRUE ORDER BY id`,
        [shopId, cardType]
      );

      if (!users.length) {
        return res.json({ success: true, created: 0, recipients: 0, slots: [] });
      }

      let current = new Date(start);
      const created: Array<{ userId: number; tokenId: string; timeSlot: string; date: string }> = [];

      // Determine current queue starting index for the start date
      const [cntRows]: any = await pool.execute(
        `SELECT COUNT(*) AS c FROM tokens WHERE shop_id = ? AND token_date = ?`,
        [shopId, dateStr(current)]
      );
      let queue = Number(cntRows?.[0]?.c || 0);

      for (let i = 0; i < users.length; i++) {
        const user = users[i];

        // If date changed (crossed midnight), recompute date count per day
        const curDate = dateStr(current);
        const [dayCntRows]: any = await pool.execute(
          `SELECT COUNT(*) AS c FROM tokens WHERE shop_id = ? AND token_date = ?`,
          [shopId, curDate]
        );
        const dayBase = Number(dayCntRows?.[0]?.c || 0);

        const tokenId = `T${Date.now()}${i.toString().padStart(4, "0")}`;
        const timeSlot = formatSlot(current);

        // Attempt token insert; ignore duplicates gracefully
        try {
          await pool.execute(
            `INSERT INTO tokens (id, shop_id, user_id, token_date, time_slot, queue_position, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [tokenId, shopId, user.id, curDate, timeSlot, dayBase + 1]
          );
        } catch (e) {
          // continue even if duplicate slot for that day; shift by interval and continue
        }

        const message = `Dear ${cardType} cardholder, your token has been created for ${curDate} at ${timeSlot}. Please visit the shop at your assigned 15-minute slot.`;
        await pool.execute(
          `INSERT INTO notifications (shop_id, user_id, type, message) VALUES (?, ?, 'token', ?)`
          , [shopId, user.id, message]
        );

        created.push({ userId: user.id, tokenId, timeSlot, date: curDate });

        // Move to next slot
        current = new Date(current.getTime() + interval * 60 * 1000);
        queue += 1;
      }

      return res.json({
        success: true,
        created: created.length,
        recipients: users.length,
        cardType,
        startAt: start.toISOString(),
        intervalMinutes: interval,
        slots: created,
      });
    } catch (err) {
      console.error("POST /notifications/broadcast/card-type error:", err);
      return res.status(500).json({ error: "Failed to broadcast notifications" });
    }
  }
);
