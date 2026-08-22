-- ============================================================
-- IoT Attendance Database Schema for XAMPP MySQL / MariaDB
-- Import file này vào phpMyAdmin hoặc chạy trong MySQL CLI:
-- http://localhost/phpmyadmin/
-- ============================================================

CREATE DATABASE IF NOT EXISTS `iot_attendance` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `iot_attendance`;

-- 1. Bảng sinh viên
CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `lop` VARCHAR(50) NOT NULL DEFAULT '',
  `face_descriptors` LONGTEXT DEFAULT NULL COMMENT 'JSON array chứa các mảng Float32Array 128 chiều',
  `avatar_path` VARCHAR(255) DEFAULT NULL,
  `created_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng lịch sử điểm danh
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` VARCHAR(50) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `status` ENUM('on-time', 'late') NOT NULL DEFAULT 'on-time',
  `confidence` FLOAT DEFAULT NULL,
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_student_id` (`student_id`),
  CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng cài đặt hệ thống
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Cài đặt mặc định
-- ============================================================
INSERT INTO `settings` (`key`, `value`) VALUES
('shiftStart', '07:00'),
('lateThreshold', '07:15'),
('espCamIp', '192.168.1.100'),
('espDevkitIp', '192.168.1.101'),
('faceThreshold', '0.5'),
('autoOpenDoor', 'true'),
('doorOpenDuration', '5'),
('language', 'vi'),
('timezone', 'Asia/Ho_Chi_Minh')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- ============================================================
-- Dữ liệu mẫu ban đầu (18 Sinh viên)
-- ============================================================
INSERT INTO `students` (`id`, `name`, `lop`, `face_descriptors`, `avatar_path`, `created_at`) VALUES
('B21DCCN001', 'Nguyễn Văn An', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN002', 'Trần Thị Bích', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN003', 'Lê Hoàng Cường', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN004', 'Phạm Minh Đức', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN005', 'Vũ Thùy Hiền', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN006', 'Hoàng Gia Khiêm', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN007', 'Đỗ Thanh Lam', 'D21CQCN03-B', '[]', NULL, 1708300000000),
('B21DCCN008', 'Bùi Xuân Mai', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN009', 'Ngô Quốc Nam', 'D21CQCN03-B', '[]', NULL, 1708300000000),
('B21DCCN010', 'Trịnh Hải Phong', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN011', 'Dương Minh Quân', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN012', 'Lý Thị Rạng', 'D21CQCN03-B', '[]', NULL, 1708300000000),
('B21DCCN013', 'Phan Đức Sơn', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN014', 'Hồ Bảo Trâm', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN015', 'Mai Anh Uyên', 'D21CQCN03-B', '[]', NULL, 1708300000000),
('B21DCCN016', 'Cao Thành Vinh', 'D21CQCN01-B', '[]', NULL, 1708300000000),
('B21DCCN017', 'Đinh Hồng Xuân', 'D21CQCN02-B', '[]', NULL, 1708300000000),
('B21DCCN018', 'Tô Khánh Yến', 'D21CQCN03-B', '[]', NULL, 1708300000000)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
