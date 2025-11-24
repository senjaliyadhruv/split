-- Create database
CREATE DATABASE IF NOT EXISTS splitwise_db
  DEFAULT CHARACTER SET = utf8mb4
  DEFAULT COLLATE = utf8mb4_unicode_ci;
USE splitwise_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Groups table
CREATE TABLE IF NOT EXISTS `groups` (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(10) DEFAULT 'USD',
    created_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_groups_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Group members table (junction)
-- CRITICAL FIX: Added 'name' column that your code requires
CREATE TABLE IF NOT EXISTS group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,            -- ✅ ADDED: Required by your server.py code
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gm_group FOREIGN KEY (group_id)
        REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY unique_group_member (group_id, user_id),
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    category VARCHAR(50) DEFAULT 'Other',
    paid_by CHAR(36) NULL,
    paid_by_name VARCHAR(255) NULL,
    split_type ENUM('equal', 'custom', 'percentage') NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_group FOREIGN KEY (group_id)
        REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_exp_group_id (group_id),
    INDEX idx_exp_paid_by (paid_by),
    INDEX idx_exp_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense splits table
CREATE TABLE IF NOT EXISTS expense_splits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_es_expense FOREIGN KEY (expense_id)
        REFERENCES expenses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_expense_id (expense_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
    id CHAR(36) PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    from_user_id CHAR(36) NOT NULL,
    from_user_name VARCHAR(255) NOT NULL,
    to_user_id CHAR(36) NOT NULL,
    to_user_name VARCHAR(255) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_settlements_group FOREIGN KEY (group_id)
        REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_set_group (group_id),
    INDEX idx_from_user (from_user_id),
    INDEX idx_to_user (to_user_id),
    INDEX idx_set_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- DROP TABLE IF EXISTS settlements;
-- DROP TABLE IF EXISTS expense_splits;
-- DROP TABLE IF EXISTS expenses;
-- DROP TABLE IF EXISTS group_members;
-- DROP TABLE IF EXISTS `groups`;
-- DROP TABLE IF EXISTS users;

-- select * from users; 
