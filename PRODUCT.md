# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Người dùng chính:** Giảng viên, giáo vụ, và ban quản lý khoa/trường học cần theo dõi điểm danh lớp học, kiểm tra tình trạng sinh viên vắng/muộn, xuất báo cáo chấm công.
- **Người vận hành kỹ thuật:** Quản trị viên hệ thống IoT quản lý kết nối camera ESP32-CAM, đăng ký dữ liệu khuôn mặt sinh viên và cấu hình ca học.

## Product Purpose

Hệ thống Điểm danh bằng Khuôn mặt IoT (IoT Facial Recognition Attendance System) cung cấp giải pháp tự động hóa hoàn toàn quy trình điểm danh học đường theo ca học thông qua camera AI thời gian thực, loại bỏ gian lận điểm danh thủ công, nâng cao tính chính xác và giảm thiểu thời gian quản lý.

## Positioning

Khác biệt với các hệ thống điểm danh truyền thống dựa trên quẹt thẻ RFID hoặc danh sách giấy, hệ thống kết hợp sức mạnh nhận diện khuôn mặt AI trên luồng video camera thời gian thực với phần cứng nhúng IoT (ESP32-CAM) và dashboard quản trị trực quan, phản hồi tức thì.

## Operating Context

- **Môi trường:** Phòng học, giảng đường đại học, phòng thí nghiệm.
- **Thiết bị:** Màn hình máy tính/tablet quản trị viên hiển thị Admin Dashboard; thiết bị camera AI nhúng (ESP32-CAM) hoặc Webcam máy tính.
- **Quy trình hoạt động:** Sinh viên bước vào góc nhìn camera -> Hệ thống tự động nhận diện khuôn mặt và đối chiếu vector đặc trưng -> Ghi nhận log check-in khớp với ca học đang diễn ra (đúng giờ / đi muộn) -> Cập nhật dashboard thống kê tức thì.

## Capabilities and Constraints

- **Chức năng chính:**
  - Tổng quan số liệu thống kê (tổng SV, lượt check-in hôm nay, vắng mặt, đi muộn) kèm biểu đồ xu hướng 7 ngày và phân bố trạng thái.
  - Giám sát luồng video trực tiếp từ camera IoT / Webcam, hiển thị bounding box nhận diện khuôn mặt và danh sách nhận diện theo thời gian thực.
  - Quản lý danh sách sinh viên, đăng ký dữ liệu khuôn mặt mới (upload ảnh / chụp qua webcam).
  - Quản lý Ca học (Thời khóa biểu thông minh): Cấu hình ca học theo thứ, tự động khớp ca và gán môn học khi điểm danh.
  - Lịch sử điểm danh chi tiết với bộ lọc đa tiêu chí (từ khóa, trạng thái, khoảng ngày) và xuất dữ liệu CSV.
  - Bảng tổng hợp chấm công & báo cáo theo tháng kèm thanh tiến trình tỉ lệ chuyên cần và xếp loại.
  - Cài đặt hệ thống (IP camera ESP32-CAM, ngưỡng khoảng cách AI, ngôn ngữ, múi giờ).
- **Ràng buộc kỹ thuật:**
  - Xử lý nhận diện cần độ trễ thấp và độ chính xác cao.
  - Giao diện quản trị hiện đại, responsive, trực quan, hỗ trợ tiếng Việt chuẩn.

## Brand Commitments

- **Tên hệ thống:** IoT Attendance - Hệ thống Điểm danh bằng Khuôn mặt IoT.
- **Phong cách:** Hiện đại, chuyên nghiệp, công nghệ cao, giao diện tối giản với gam màu chủ đạo Slate/Deep Blue kết hợp các màu chỉ báo trực quan (Xanh lá: Thành công/Đúng giờ, Vàng hổ phách: Đi muộn/Cảnh báo, Đỏ: Vắng mặt/Lỗi).

## Evidence on Hand

- Module Admin Dashboard hoàn chỉnh xây dựng bằng React + Tailwind CSS v4 + Lucide Icons + Recharts nằm tại thư mục [dashboard/](file:///f:/face_attendance_system/IoT_Face_Attendance/dashboard).
- Bộ dữ liệu mẫu sinh viên và nhật ký điểm danh thực tế với tên tiếng Việt tại [dashboard/src/data/mockData.js](file:///f:/face_attendance_system/IoT_Face_Attendance/dashboard/src/data/mockData.js).
- Mã nguồn nhận diện khuôn mặt client-side với face-api.js tại [js/app.js](file:///f:/face_attendance_system/IoT_Face_Attendance/js/app.js) và bộ model weights AI tại [models/](file:///f:/face_attendance_system/IoT_Face_Attendance/models).

## Product Principles

1. **Phản hồi tức thì (Real-time Feedback):** Mọi sự kiện nhận diện và thay đổi trạng thái thiết bị phải được hiển thị rõ ràng trên dashboard mà không cần tải lại trang.
2. **Trực quan & Dễ sử dụng (Scanability & Clarity):** Bố cục dạng thẻ (card-based), biểu đồ trực quan, bảng biểu rõ ràng với màu sắc trạng thái chuẩn giúp người dùng nắm bắt thông tin chỉ trong vài giây.
3. **Độ tin cậy & Toàn vẹn dữ liệu (Data Integrity):** Dữ liệu điểm danh chính xác, có đầy đủ lịch sử thời gian, mã sinh viên và trạng thái rõ ràng, dễ dàng xuất báo cáo.
