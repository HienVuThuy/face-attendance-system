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

-- 2. Bảng ca học (Thời khoá biểu)
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT 'VD: Ca Sáng, Ca Chiều',
  `subject` VARCHAR(150) NOT NULL COMMENT 'VD: Lập trình di động',
  `room` VARCHAR(50) DEFAULT '' COMMENT 'VD: A2-301',
  `day_of_week` TINYINT NOT NULL COMMENT '1=Thứ 2, 2=Thứ 3, ..., 7=Chủ nhật',
  `start_time` VARCHAR(5) NOT NULL COMMENT 'HH:MM, VD: 07:00',
  `end_time` VARCHAR(5) NOT NULL COMMENT 'HH:MM, VD: 09:30',
  `late_after` VARCHAR(5) DEFAULT NULL COMMENT 'Ngưỡng trễ riêng ca (NULL = start_time + 15 phút)',
  `is_active` TINYINT NOT NULL DEFAULT 1,
  INDEX `idx_day` (`day_of_week`),
  INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng lịch sử điểm danh
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` VARCHAR(50) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `status` ENUM('on-time', 'late') NOT NULL DEFAULT 'on-time',
  `confidence` FLOAT DEFAULT NULL,
  `session_id` INT DEFAULT NULL COMMENT 'Liên kết với ca học đang diễn ra khi check-in',
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_student_id` (`student_id`),
  INDEX `idx_session_id` (`session_id`),
  CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng cài đặt hệ thống
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Cài đặt mặc định
-- ============================================================
INSERT INTO `settings` (`key`, `value`) VALUES
('espCamIp', '192.168.100.178'),
('faceThreshold', '0.5'),
('language', 'vi'),
('timezone', 'Asia/Ho_Chi_Minh')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- ============================================================
-- Dữ liệu mẫu: Thời khoá biểu (8 ca học)
-- ============================================================
INSERT INTO `sessions` (`name`, `subject`, `room`, `day_of_week`, `start_time`, `end_time`, `late_after`, `is_active`) VALUES
('Ca Sáng',  'Lập trình di động',     'A2-301', 1, '07:00', '09:30', '07:15', 1),
('Ca Chiều', 'Mạng máy tính',         'A2-302', 1, '13:00', '15:30', '13:15', 1),
('Ca Sáng',  'Cơ sở dữ liệu',        'B3-201', 2, '07:00', '09:30', '07:15', 1),
('Ca Chiều', 'Trí tuệ nhân tạo',      'B3-202', 2, '13:00', '15:30', '13:15', 1),
('Ca Sáng',  'Lập trình di động',     'A2-301', 3, '07:00', '09:30', '07:15', 1),
('Ca Sáng',  'Hệ điều hành',          'C1-101', 4, '07:00', '09:30', '07:15', 1),
('Ca Chiều', 'Mạng máy tính',         'A2-302', 4, '13:00', '15:30', '13:15', 1),
('Ca Sáng',  'IoT & Hệ thống nhúng',  'D4-401', 5, '07:00', '09:30', '07:15', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

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

