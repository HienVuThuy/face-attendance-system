# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Người dùng chính:** Giảng viên, giáo vụ, và ban quản lý khoa/trường học cần theo dõi điểm danh lớp học, kiểm tra tình trạng sinh viên vắng/muộn, xuất báo cáo chấm công.
- **Người vận hành kỹ thuật:** Quản trị viên hệ thống IoT quản lý kết nối camera ESP32-CAM, MQTT broker, đăng ký dữ liệu khuôn mặt sinh viên và giám sát thiết bị đóng/mở cửa tự động.

## Product Purpose

Hệ thống Điểm danh bằng Khuôn mặt IoT (IoT Facial Recognition Attendance System) cung cấp giải pháp tự động hóa hoàn toàn quy trình điểm danh học đường và kiểm soát cửa ra vào thông qua camera AI thời gian thực, loại bỏ gian lận điểm danh thủ công, nâng cao tính chính xác và giảm thiểu thời gian quản lý.

## Positioning

Khác biệt với các hệ thống điểm danh truyền thống dựa trên quẹt thẻ RFID hoặc danh sách giấy, hệ thống kết hợp sức mạnh nhận diện khuôn mặt AI trên luồng video camera thời gian thực với phần cứng nhúng IoT (ESP32-CAM, MQTT, Relay mở cửa) và dashboard quản trị trực quan, phản hồi tức thì.

## Operating Context

- **Môi trường:** Phòng học, giảng đường đại học, phòng thí nghiệm, lối vào khu học tập.
- **Thiết bị:** Màn hình máy tính/tablet quản trị viên hiển thị Admin Dashboard; thiết bị camera AI nhúng (ESP32-CAM) gắn tại cửa lớp/lối vào; rơ-le điều khiển khóa cửa điện từ.
- **Quy trình hoạt động:** Sinh viên bước vào góc nhìn camera -> Hệ thống tự động nhận diện khuôn mặt và đối chiếu vector đặc trưng -> Ghi nhận log check-in (đúng giờ / đi muộn) -> Kích hoạt lệnh mở cửa tự động qua IoT -> Cập nhật dashboard thống kê tức thì.

## Capabilities and Constraints

- **Chức năng chính:**
  - Tổng quan số liệu thống kê (tổng SV, lượt check-in hôm nay, vắng mặt, đi muộn) kèm biểu đồ xu hướng 7 ngày và phân bố trạng thái.
  - Giám sát luồng video trực tiếp từ camera IoT, hiển thị bounding box nhận diện khuôn mặt và danh sách nhận diện theo thời gian thực.
  - Quản lý danh sách sinh viên, đăng ký dữ liệu khuôn mặt mới (upload ảnh / chụp qua webcam).
  - Lịch sử điểm danh chi tiết với bộ lọc đa tiêu chí (từ khóa, trạng thái, khoảng ngày) và xuất dữ liệu CSV / Excel.
  - Bảng tổng hợp chấm công & báo cáo theo tháng kèm thanh tiến trình tỉ lệ chuyên cần và xếp loại.
  - Cài đặt quy tắc điểm danh (giờ bắt đầu ca, ngưỡng đi muộn, tự động mở cửa) và cấu hình kết nối IoT (IP camera, MQTT broker).
- **Ràng buộc kỹ thuật:**
  - Xử lý nhận diện cần độ trễ thấp và độ chính xác cao.
  - Giao diện quản trị hiện đại, responsive, trực quan, hỗ trợ tiếng Việt chuẩn.
  - **Chế độ Mô phỏng Phần cứng (Simulated Mode):** Khi thiết bị ESP32 DevKit (Relay) chưa sẵn sàng hoặc mất kết nối mạng, hệ thống tự động kích hoạt chế độ mô phỏng (Simulated Relay Countdown) để đảm bảo quá trình demo/báo cáo không bị gián đoạn.

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
