-- ============================================================================
-- Ration Distribution System Database Schema (Authentic PDS Categories)
-- MySQL Version 8+
-- Enhanced for Shopkeeper Features (Stock, Alerts, Tokens, Reports, Quota)
-- ============================================================================
-- 
-- ROLE PERMISSIONS:
-- 
-- SHOPKEEPER (shopkeeper role):
--   ? Stock Management - View/Update stock levels
--   ? Alerts/Notifications - Send to cardholders
--   ? Token Management - View/Manage tokens
--   ? Reports - View distribution & stock reports
--   ? Quota Management - Update customer quotas
--   ? User Management - CANNOT add/edit/delete users
--   ? Shopkeeper Management - CANNOT manage other shopkeepers
--
-- ADMIN (admin role):
--   ? All Shopkeeper features PLUS:
--   ? User Management - Full CRUD on cardholders
--   ? Shopkeeper Management - Full CRUD on shopkeepers
--   ? Flag/Unflag suspicious users
--   ? System-wide settings
--
-- ============================================================================

CREATE DATABASE IF NOT EXISTS ration_tds;
USE ration_tds;

-- DROP tables (correct order)
DROP TABLE IF EXISTS stock_audit_log;
DROP TABLE IF EXISTS quota_change_log;
DROP TABLE IF EXISTS verification_codes;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS monthly_allocations;
DROP TABLE IF EXISTS stock_items;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS shops;

-- ------------------------
-- SHOPS
-- ------------------------
CREATE TABLE shops (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  district VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  contact_email VARCHAR(255),
  working_hours VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- USERS (Updated with Real PDS Categories)
-- ------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role ENUM('cardholder','shopkeeper','admin') NOT NULL COMMENT 'cardholder=end user, shopkeeper=FPS dealer (Stock/Alerts/Tokens/Reports/Quota), admin=full access',
  
  -- Personal Details
  name VARCHAR(255),
  profile_photo_url TEXT COMMENT 'URL to user profile photo',
  gender ENUM('male','female','other'),
  date_of_birth DATE,
  aadhaar_number VARCHAR(12) UNIQUE,
  mobile_number VARCHAR(15),
  address TEXT,
  district VARCHAR(100) COMMENT 'User district for location tracking',
  pincode VARCHAR(10),
  
  -- Ration Card Details (Real PDS Categories)
  ration_card_number VARCHAR(50) UNIQUE,
  card_type ENUM('AAY','PHH','BPL','APL') COMMENT 'AAY=Antyodaya(poorest), PHH=Priority Household, BPL/APL=Old categories',
  card_color ENUM('saffron','pink','orange','yellow','blue','white') COMMENT 'Saffron/Yellow=AAY, Pink/Orange=PHH, Blue=BPL, White=APL',
  
  -- Socio-Economic Data
  family_size INT DEFAULT 1 COMMENT 'Number of family members',
  socio_economic_category ENUM('SC','ST','OBC','General'),
  occupation ENUM('agricultural_laborer','marginal_farmer','daily_wage','salaried','self_employed','unemployed','others'),
  annual_income DECIMAL(10,2),
  
  -- System Fields
  language VARCHAR(50) DEFAULT 'english',
  shop_id VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  card_status ENUM('active','inactive','suspended','expired') DEFAULT 'active' COMMENT 'Current card status',
  
  -- Collection tracking
  last_collection_date DATE COMMENT 'Last date user collected ration',
  total_collections INT DEFAULT 0 COMMENT 'Total number of collections made',
  
  -- Anti-Tampering: Flag suspicious users (ADMIN ONLY)
  is_flagged BOOLEAN DEFAULT FALSE COMMENT 'Admin can flag user for suspicious activity',
  flag_reason TEXT COMMENT 'Why user was flagged',
  flagged_by INT COMMENT 'Admin user_id who flagged this user',
  flagged_at TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
  FOREIGN KEY (flagged_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_shop_id (shop_id),
  INDEX idx_card_type (card_type),
  INDEX idx_ration_card (ration_card_number),
  
  CONSTRAINT chk_family_size CHECK (family_size > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- STOCK ITEMS (Shopkeeper can view/update)
-- ------------------------
CREATE TABLE stock_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_name_hindi VARCHAR(100),
  
  -- Stock tracking
  government_allocated DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Original stock allocated by admin/government',
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Current stock (shopkeeper can update)',
  
  unit VARCHAR(20) NOT NULL,
  last_restocked TIMESTAMP NULL,
  allocated_by INT COMMENT 'Admin user_id who allocated stock',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_shop_item (shop_id, item_code),
  INDEX idx_item_code (item_code),
  INDEX idx_shop_item (shop_id, item_code),

  CONSTRAINT chk_quantity_nonneg CHECK (quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- STOCK AUDIT LOG (Track stock changes by shopkeeper/admin)
-- ------------------------
CREATE TABLE stock_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stock_item_id INT NOT NULL,
  shop_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  
  changed_by_user_id INT NOT NULL,
  changed_by_role ENUM('shopkeeper','admin') NOT NULL,
  change_type ENUM('increase','decrease','restock','correction') NOT NULL,
  
  old_quantity DECIMAL(10,2) NOT NULL,
  new_quantity DECIMAL(10,2) NOT NULL,
  quantity_difference DECIMAL(10,2) NOT NULL,
  
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_shop (shop_id),
  INDEX idx_changed_by (changed_by_user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- MONTHLY ALLOCATIONS (Shopkeeper can update quotas)
-- ------------------------
CREATE TABLE monthly_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  
  eligible_quantity DECIMAL(10,2) NOT NULL COMMENT 'Monthly quota - Shopkeeper can update',
  collected_quantity DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Amount already collected',
  
  month INT NOT NULL COMMENT '1-12',
  year INT NOT NULL,
  
  collection_date DATE,
  fps_dealer_id VARCHAR(50) COMMENT 'Shopkeeper who issued the ration',
  transaction_id VARCHAR(100),
  
  last_modified_by INT COMMENT 'User ID who last modified the quota',
  modification_reason TEXT COMMENT 'Reason for quota modification',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_user_item_month (user_id, item_code, month, year),
  INDEX idx_user_month (user_id, year, month),
  INDEX idx_collection_date (collection_date),
  INDEX idx_fps_dealer (fps_dealer_id),
  
  CONSTRAINT chk_month_valid CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT chk_quantities_nonneg CHECK (eligible_quantity >= 0 AND collected_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- QUOTA CHANGE LOG
-- ------------------------
CREATE TABLE quota_change_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  allocation_id INT NOT NULL,
  user_id INT NOT NULL COMMENT 'Cardholder whose quota was changed',
  item_code VARCHAR(50) NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  
  old_quantity DECIMAL(10,2) NOT NULL,
  new_quantity DECIMAL(10,2) NOT NULL,
  change_amount DECIMAL(10,2) NOT NULL COMMENT 'new - old',
  
  changed_by_user_id INT NOT NULL COMMENT 'Shopkeeper/Admin who made the change',
  changed_by_role ENUM('shopkeeper','admin') NOT NULL,
  reason TEXT COMMENT 'Reason for quota change',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (allocation_id) REFERENCES monthly_allocations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_user_month (user_id, year, month),
  INDEX idx_changed_by (changed_by_user_id, changed_by_role),
  INDEX idx_item_code (item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- TOKENS (Shopkeeper can manage)
-- ------------------------
CREATE TABLE tokens (
  id VARCHAR(50) PRIMARY KEY,
  shop_id VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  token_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  status ENUM('pending','active','completed','expired','cancelled') DEFAULT 'pending',
  queue_position INT,
  
  -- Additional token tracking
  issued_by INT COMMENT 'Shopkeeper who issued/managed the token',
  completed_at TIMESTAMP NULL,
  cancelled_reason TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_user_shop_date (user_id, shop_id, token_date),

  INDEX idx_shop_date (shop_id, token_date),
  INDEX idx_user_status (user_id, status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- NOTIFICATIONS (Shopkeeper can send/view)
-- ------------------------
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id VARCHAR(50),
  user_id INT COMMENT 'Target user (NULL = broadcast to all)',
  
  type ENUM('stock','alert','token','system','quota') DEFAULT 'system',
  title VARCHAR(255),
  message TEXT NOT NULL,
  
  -- Targeting
  target_card_type ENUM('AAY','PHH','BPL','APL','all') DEFAULT 'all',
  
  -- Sender tracking
  sent_by INT COMMENT 'Shopkeeper/Admin who sent notification',
  sent_by_role ENUM('shopkeeper','admin'),
  
  is_read BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  acknowledged_at TIMESTAMP NULL,

  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_shop_user (shop_id, user_id),
  INDEX idx_type (type),
  INDEX idx_sent_by (sent_by),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- COMPLAINTS
-- ------------------------
CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shop_id VARCHAR(50),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending','in_progress','resolved','closed') DEFAULT 'pending',
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  assigned_to INT,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_status (status),
  INDEX idx_user (user_id),
  INDEX idx_shop (shop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------
-- VERIFICATION CODES (for OTP login)
-- ------------------------
CREATE TABLE verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL COMMENT 'Hashed verification code',
  attempts INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_email_verified (email, verified_at),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert Shops
INSERT INTO shops (id, name, district, address, contact_email, working_hours) VALUES
('SHOP001', 'Ration Shop - Block 15, Sector 7', 'Mumbai', 'Block 15, Sector 7, Mumbai', 'shop001@ration.gov.in', '9:00 AM - 5:00 PM'),
('SHOP002', 'Ration Shop - Andheri West', 'Mumbai', 'Shop 23, Andheri West, Mumbai', 'shop002@ration.gov.in', '8:00 AM - 4:00 PM'),
('SHOP003', 'Ration Shop - Bandra East', 'Mumbai', 'Bandra East, Mumbai', 'shop003@ration.gov.in', '10:00 AM - 6:00 PM');

-- ============================================================================
-- USER ROLES EXPLAINED:
-- 
-- SHOPKEEPER: shopkeeper1@shop.com, shopkeeper2@shop.com
--   - Can access: Stock, Alerts, Tokens, Reports, Quota Management
--   - CANNOT access: User Management, Shopkeeper Management
--
-- ADMIN: admin@gov.in, admin@ration.gov.in
--   - Can access: EVERYTHING including User & Shopkeeper Management
-- ============================================================================

INSERT INTO users (email, role, name, ration_card_number, card_type, card_color, family_size, shop_id, mobile_number, address, district) VALUES
-- SHOPKEEPERS (Stock, Alerts, Tokens, Reports, Quota - NO User Management)
('shopkeeper1@shop.com', 'shopkeeper', 'Ramesh Shopkeeper', NULL, NULL, NULL, 1, 'SHOP001', '9876543211', 'Block 15, Sector 7', 'Mumbai'),
('shopkeeper2@shop.com', 'shopkeeper', 'Suresh Dealer', NULL, NULL, NULL, 1, 'SHOP002', '9876543212', 'Andheri West', 'Mumbai'),

-- ADMINS (Full Access - Including User & Shopkeeper Management)
('admin@gov.in', 'admin', 'Government Admin', NULL, NULL, NULL, 1, 'SHOP001', '9876543200', 'Government Office, New Delhi', 'Delhi'),
('admin@ration.gov.in', 'admin', 'Admin Kumar', NULL, NULL, NULL, 1, 'SHOP001', '9876543210', 'Government Office, Mumbai', 'Mumbai'),

-- Cardholders
('cardholder1@gmail.com', 'cardholder', 'Ram Kumar', 'APL789012', 'APL', 'white', 4, 'SHOP001', '9876543220', '123 Main St, Block 15', 'Mumbai'),
('cardholder2@gmail.com', 'cardholder', 'Sita Devi', 'BPL456789', 'BPL', 'pink', 5, 'SHOP001', '9876543221', '456 Park Ave, Sector 7', 'Mumbai'),
('cardholder3@gmail.com', 'cardholder', 'Mohan Lal', 'AAY123456', 'AAY', 'saffron', 6, 'SHOP002', '9876543222', '789 Lake Road, Andheri', 'Mumbai');

-- Insert Stock Items
INSERT INTO stock_items (shop_id, item_code, item_name, item_name_hindi, government_allocated, quantity, unit) VALUES
('SHOP001', 'rice', 'Rice', 'chawal', 500, 450, 'kg'),
('SHOP001', 'wheat', 'Wheat', 'gehun', 500, 480, 'kg'),
('SHOP001', 'sugar', 'Sugar', 'cheeni', 100, 85, 'kg'),
('SHOP001', 'kerosene', 'Kerosene', 'mitti ka tel', 200, 175, 'L'),

('SHOP002', 'rice', 'Rice', 'chawal', 600, 550, 'kg'),
('SHOP002', 'wheat', 'Wheat', 'gehun', 600, 580, 'kg'),
('SHOP002', 'sugar', 'Sugar', 'cheeni', 120, 100, 'kg'),
('SHOP002', 'kerosene', 'Kerosene', 'mitti ka tel', 250, 220, 'L');

-- Insert Monthly Allocations (Current Month)
INSERT INTO monthly_allocations (user_id, item_code, eligible_quantity, collected_quantity, month, year) VALUES
-- Cardholder 1 (user_id = 5)
(5, 'rice', 5, 0, MONTH(CURDATE()), YEAR(CURDATE())),
(5, 'wheat', 5, 0, MONTH(CURDATE()), YEAR(CURDATE())),
(5, 'sugar', 1, 0, MONTH(CURDATE()), YEAR(CURDATE())),
(5, 'kerosene', 2, 0, MONTH(CURDATE()), YEAR(CURDATE())),

-- Cardholder 2 (user_id = 6)
(6, 'rice', 5, 2, MONTH(CURDATE()), YEAR(CURDATE())),
(6, 'wheat', 5, 3, MONTH(CURDATE()), YEAR(CURDATE())),
(6, 'sugar', 1, 0, MONTH(CURDATE()), YEAR(CURDATE())),
(6, 'kerosene', 2, 1, MONTH(CURDATE()), YEAR(CURDATE())),

-- Cardholder 3 (user_id = 7)
(7, 'rice', 5, 5, MONTH(CURDATE()), YEAR(CURDATE())),
(7, 'wheat', 5, 5, MONTH(CURDATE()), YEAR(CURDATE())),
(7, 'sugar', 1, 1, MONTH(CURDATE()), YEAR(CURDATE())),
(7, 'kerosene', 2, 2, MONTH(CURDATE()), YEAR(CURDATE()));

-- Insert Sample Tokens
INSERT INTO tokens (id, shop_id, user_id, token_date, time_slot, status, queue_position) VALUES
('TKN001', 'SHOP001', 5, CURDATE(), '09:00-10:00', 'pending', 1),
('TKN002', 'SHOP001', 6, CURDATE(), '10:00-11:00', 'active', 2),
('TKN003', 'SHOP002', 7, CURDATE(), '11:00-12:00', 'completed', 1);

-- Insert Sample Notifications
INSERT INTO notifications (shop_id, user_id, type, title, message, sent_by, sent_by_role, is_sent, target_card_type) VALUES
('SHOP001', NULL, 'stock', 'New Stock Arrived', 'Fresh rice stock has arrived at the shop.', 1, 'shopkeeper', TRUE, 'all'),
('SHOP001', NULL, 'alert', 'Shop Timing Change', 'Shop will be closed on Sunday for maintenance.', 1, 'shopkeeper', TRUE, 'all'),
('SHOP001', 5, 'token', 'Token Generated', 'Your token TKN001 is ready for collection.', 1, 'shopkeeper', TRUE, 'all');

-- ============================================================================
-- VIEWS FOR EASY QUERIES
-- ============================================================================

-- View: Customer List for Shopkeeper
CREATE OR REPLACE VIEW v_shopkeeper_customers AS
SELECT 
  u.id AS user_id,
  u.name,
  u.ration_card_number,
  u.card_type,
  u.family_size,
  u.mobile_number,
  u.shop_id,
  s.name AS shop_name,
  (SELECT SUM(eligible_quantity) FROM monthly_allocations 
   WHERE user_id = u.id AND month = MONTH(CURDATE()) AND year = YEAR(CURDATE())) AS total_quota,
  (SELECT SUM(collected_quantity) FROM monthly_allocations 
   WHERE user_id = u.id AND month = MONTH(CURDATE()) AND year = YEAR(CURDATE())) AS total_collected
FROM users u
LEFT JOIN shops s ON u.shop_id = s.id
WHERE u.role = 'cardholder'
ORDER BY u.name;

-- View: Monthly Allocation Summary
CREATE OR REPLACE VIEW v_monthly_allocation_details AS
SELECT 
  ma.id AS allocation_id,
  ma.user_id,
  u.name AS customer_name,
  u.ration_card_number,
  ma.item_code,
  ma.eligible_quantity,
  ma.collected_quantity,
  (ma.eligible_quantity - ma.collected_quantity) AS remaining_quantity,
  ma.month,
  ma.year,
  ma.collection_date,
  ma.last_modified_by,
  modifier.name AS modified_by_name,
  ma.modification_reason,
  ma.updated_at
FROM monthly_allocations ma
JOIN users u ON ma.user_id = u.id
LEFT JOIN users modifier ON ma.last_modified_by = modifier.id
ORDER BY ma.year DESC, ma.month DESC, u.name, ma.item_code;

-- View: Stock Summary with Audit Info
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
  si.id,
  si.shop_id,
  s.name AS shop_name,
  si.item_code,
  si.item_name,
  si.item_name_hindi,
  si.government_allocated,
  si.quantity AS current_quantity,
  (si.government_allocated - si.quantity) AS distributed,
  si.unit,
  si.last_restocked,
  si.updated_at
FROM stock_items si
JOIN shops s ON si.shop_id = s.id
ORDER BY s.name, si.item_name;

-- View: Token Summary
CREATE OR REPLACE VIEW v_token_summary AS
SELECT 
  t.id AS token_id,
  t.shop_id,
  s.name AS shop_name,
  t.user_id,
  u.name AS customer_name,
  u.ration_card_number,
  t.token_date,
  t.time_slot,
  t.status,
  t.queue_position,
  t.created_at
FROM tokens t
JOIN shops s ON t.shop_id = s.id
JOIN users u ON t.user_id = u.id
ORDER BY t.token_date DESC, t.queue_position;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
