-- Add December 2025 allocations for all users
-- Run this in your MySQL/phpMyAdmin

-- AAY Allocations (35kg fixed per family)
INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year) VALUES
  -- Ramesh Kumar (AAY, 6 members) - 35kg rice
  (2, 'rice', 35.00, 0.00, 12, 2025),
  (2, 'wheat', 0.00, 0.00, 12, 2025),
  (2, 'sugar', 5.00, 0.00, 12, 2025),
  
  -- Lakshmi Devi (AAY, 4 members) - 35kg rice
  (3, 'rice', 35.00, 0.00, 12, 2025),
  (3, 'sugar', 5.00, 0.00, 12, 2025),

  -- Suresh Patel (AAY, 5 members) - 35kg mixed
  (4, 'rice', 20.00, 0.00, 12, 2025),
  (4, 'wheat', 15.00, 0.00, 12, 2025),
  (4, 'sugar', 5.00, 0.00, 12, 2025);

-- PHH Allocations (family_size × 5kg)
INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year) VALUES
  -- Vijay Singh (PHH, 4 members) - 4×5=20kg
  (5, 'rice', 10.00, 0.00, 12, 2025),
  (5, 'wheat', 10.00, 0.00, 12, 2025),

  -- Meena Sharma (PHH, 3 members) - 3×5=15kg
  (6, 'rice', 15.00, 0.00, 12, 2025),
  (6, 'sugar', 3.00, 0.00, 12, 2025),

  -- Priya Venkatesh (PHH, 5 members) - 5×5=25kg
  (7, 'rice', 15.00, 0.00, 12, 2025),
  (7, 'wheat', 10.00, 0.00, 12, 2025),

  -- Amit Yadav (PHH, 3 members) - 3×5=15kg
  (8, 'rice', 10.00, 0.00, 12, 2025),
  (8, 'wheat', 5.00, 0.00, 12, 2025);

-- BPL Allocations
INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year) VALUES
  -- Gopal Reddy (BPL, 4 members) - 20kg
  (9, 'rice', 15.00, 0.00, 12, 2025),
  (9, 'wheat', 5.00, 0.00, 12, 2025);

-- APL Allocations (Ram Kumar - the test user from screenshot)
INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year) VALUES
  -- Find the user ID for Ram Kumar and add their allocation
  -- Assuming Ram Kumar is user ID 10 or similar
  (10, 'rice', 10.00, 0.00, 12, 2025),
  (10, 'wheat', 5.00, 0.00, 12, 2025),
  (10, 'sugar', 2.00, 0.00, 12, 2025);

-- If you get duplicate key errors, the allocations already exist
-- You can also run this to check existing users:
-- SELECT id, name, ration_card_number, card_type FROM users WHERE role = 'cardholder';
