-- ============================================================================
-- FIX: Collection Updates for Shopkeeper Dashboard
-- Run this in MySQL/phpMyAdmin to fix real-time collection tracking
-- ============================================================================

USE ration_tds;

-- Step 1: Remove the constraint that blocks collection updates
ALTER TABLE monthly_allocations DROP CONSTRAINT IF EXISTS chk_collected_lte_eligible;

-- Step 2: Add proper indexes for faster updates
ALTER TABLE monthly_allocations
  ADD INDEX IF NOT EXISTS idx_user_item_month_year (user_id, item_code, month, year);

-- Step 3: Ensure columns have correct types
ALTER TABLE monthly_allocations 
  MODIFY COLUMN collected_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  MODIFY COLUMN eligible_quantity DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Step 4: Add change_type column to quota_change_log if not exists
-- This helps track whether we changed eligible or collected quantity
ALTER TABLE quota_change_log
  ADD COLUMN IF NOT EXISTS change_type VARCHAR(20) DEFAULT 'collected';

-- Step 5: Verify the fix - show current allocations
SELECT 
  ma.id,
  u.name AS customer,
  u.ration_card_number,
  ma.item_code,
  ma.eligible_quantity AS quota,
  ma.collected_quantity AS collected,
  (ma.eligible_quantity - ma.collected_quantity) AS remaining,
  CONCAT(ma.month, '/', ma.year) AS period,
  ma.updated_at AS last_update
FROM monthly_allocations ma
JOIN users u ON ma.user_id = u.id
WHERE ma.month = MONTH(CURDATE()) AND ma.year = YEAR(CURDATE())
ORDER BY u.name, ma.item_code;

-- Step 6: Show recent distribution log
SELECT 
  qcl.id,
  u.name AS customer,
  qcl.item_code,
  CONCAT(qcl.old_quantity, ' -> ', qcl.new_quantity) AS change_detail,
  qcl.change_amount AS distributed,
  changer.name AS distributed_by,
  qcl.reason,
  qcl.created_at
FROM quota_change_log qcl
JOIN users u ON qcl.user_id = u.id
JOIN users changer ON qcl.changed_by_user_id = changer.id
ORDER BY qcl.created_at DESC
LIMIT 10;

-- ============================================================================
-- After running this, RESTART the backend server:
-- cd backend && npm run dev
-- ============================================================================
