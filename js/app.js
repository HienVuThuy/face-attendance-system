// ============================================================
// app.js — Client-side Face Recognition & IoT Attendance Scanner
// ============================================================
// Tích hợp:
// 1. face-api.js (TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet)
// 2. Giao tiếp 2 chiều với Backend API (http://localhost:3001/api)
// 3. Luồng camera: ESP32-CAM (MJPEG & /capture) hoặc Webcam máy tính
// 4. FaceMatcher với ngưỡng threshold cấu hình được
// 5. Tự động gửi kết quả check-in và mở rơ-le qua backend
// ============================================================

const API_BASE = 'http://localhost:3001/api';
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let studentsList = [];
let faceMatcher = null;
let recognizing = false;
let recognizeLoopTimer = null;
let lastSeenInfo = {};
let cameraSource = 'esp32'; // 'esp32' | 'webcam'
let webcamStream = null;

let systemSettings = {
  espCamIp: '192.168.100.178',
  faceThreshold: 0.5,
  autoOpenDoor: true,
  doorOpenDuration: 5,
};

const video = document.getElementById('video');
const espImg = document.getElementById('espImg');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const espCamIpInput = document.getElementById('espCamIpInput');

// ================= LOGIC ĐIỀU HƯỚNG TAB =================
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

// ================= CHUYỂN NGUỒN CAMERA =================
async function setCameraSource(source) {
  cameraSource = source;

  const btnEsp = document.getElementById('sourceEspBtn');
  const btnWebcam = document.getElementById('sourceWebcamBtn');
  const ipGroup = document.getElementById('espIpGroup');

  if (source === 'esp32') {
    if (btnEsp) { btnEsp.style.background = 'var(--accent)'; btnEsp.style.color = '#fff'; }
    if (btnWebcam) { btnWebcam.style.background = 'transparent'; btnWebcam.style.color = '#4b5563'; }
    if (ipGroup) ipGroup.style.display = 'flex';

    // Tắt webcam nếu đang bật
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
    if (video) video.style.display = 'none';

    // Bật ảnh luồng ESP32
    if (espImg) {
      espImg.style.display = 'block';
      espImg.src = `http://${systemSettings.espCamIp}:81/stream`;
    }
  } else {
    // Webcam mode
    if (btnWebcam) { btnWebcam.style.background = 'var(--accent)'; btnWebcam.style.color = '#fff'; }
    if (btnEsp) { btnEsp.style.background = 'transparent'; btnEsp.style.color = '#4b5563'; }
    if (ipGroup) ipGroup.style.display = 'none';

    if (espImg) espImg.style.display = 'none';
    if (video) video.style.display = 'block';

    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      video.srcObject = webcamStream;
      await new Promise(resolve => video.onloadedmetadata = resolve);
    } catch (err) {
      alert('Không thể mở Webcam: ' + err.message);
    }
  }

  resizeOverlay();
}

function updateEspIp() {
  if (espCamIpInput && espCamIpInput.value.trim()) {
    systemSettings.espCamIp = espCamIpInput.value.trim();
    if (cameraSource === 'esp32' && espImg) {
      espImg.src = `http://${systemSettings.espCamIp}:81/stream?t=${Date.now()}`;
    }
    alert(`Đã cập nhật IP ESP32-CAM: ${systemSettings.espCamIp}`);
  }
}

function resizeOverlay() {
  if (!overlay) return;
  const activeElement = cameraSource === 'esp32' ? espImg : video;
  if (activeElement) {
    overlay.width = activeElement.clientWidth || 640;
    overlay.height = activeElement.clientHeight || 480;
  }
}

window.addEventListener('load', init);
window.addEventListener('resize', resizeOverlay);

// ================= KHỞI TẠO HỆ THỐNG =================
async function init() {
  try {
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải Model AI và cấu hình hệ thống...';

    // 1. Tải cấu hình từ backend
    await loadSettings();
    if (espCamIpInput && systemSettings.espCamIp) {
      espCamIpInput.value = systemSettings.espCamIp;
    }

    // 2. Tải AI Models (face-api.js)
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    // 3. Khởi tạo nguồn camera mặc định (ESP32-CAM)
    if (espImg) {
      espImg.src = `http://${systemSettings.espCamIp}:81/stream`;
      espImg.onload = () => resizeOverlay();
      espImg.onerror = () => {
        console.warn(`Chưa kết nối được luồng MJPEG tại http://${systemSettings.espCamIp}:81/stream`);
      };
    }

    // 4. Tải danh sách sinh viên từ backend
    await loadStudentsFromBackend();
    await updateDashboardStats();

    statusEl.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Sẵn sàng. AI Models & Backend đã kết nối.';
    const startBtn = document.getElementById('startBtn');
    const singleScanBtn = document.getElementById('singleScanBtn');
    if (startBtn) startBtn.disabled = false;
    if (singleScanBtn) singleScanBtn.disabled = false;
  } catch (err) {
    statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Lỗi khởi tạo: ' + err.message;
    console.error('Init error:', err);
  }
}

// ================= CẤU HÌNH & DỮ LIỆU TỪ BACKEND =================
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (res.ok) {
      const data = await res.json();
      systemSettings = { ...systemSettings, ...data };
    }
  } catch (e) {
    console.warn('Dùng cấu hình mặc định (Backend offline):', e.message);
  }
}

async function loadStudentsFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/students`);
    if (res.ok) {
      const basicList = await res.json();

      // Tải chi tiết từng SV để lấy face descriptors
      const fullList = await Promise.all(
        basicList.map(async (s) => {
          try {
            const detailRes = await fetch(`${API_BASE}/students/${encodeURIComponent(s.id)}`);
            if (detailRes.ok) return await detailRes.json();
          } catch {}
          return s;
        })
      );

      studentsList = fullList;
      buildFaceMatcher();
      renderStudentTable();
    }
  } catch (err) {
    console.error('Lỗi tải sinh viên từ backend:', err);
  }
}

function buildFaceMatcher() {
  const labeledDescriptors = [];

  studentsList.forEach(sv => {
    if (sv.faceDescriptors && sv.faceDescriptors.length > 0) {
      const descriptors = sv.faceDescriptors.map(d =>
        new Float32Array(Array.isArray(d) ? d : Object.values(d))
      );
      labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(sv.id, descriptors));
    }
  });

  if (labeledDescriptors.length > 0) {
    const threshold = Number(systemSettings.faceThreshold) || 0.5;
    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  } else {
    faceMatcher = null;
  }
}

// ================= LẤY FRAME TĨNH TỪ CAMERA =================
function getActiveCameraFrame() {
  return new Promise((resolve, reject) => {
    if (cameraSource === 'webcam') {
      if (video && video.readyState >= 2) {
        resolve(video);
      } else {
        reject(new Error('Webcam chưa sẵn sàng!'));
      }
    } else {
      // ESP32-CAM: lấy 1 frame tĩnh từ endpoint /capture
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Không thể kết nối ESP32-CAM tại http://${systemSettings.espCamIp}/capture`));
      img.src = `http://${systemSettings.espCamIp}/capture?t=${Date.now()}`;
    }
  });
}

// ================= ĐĂNG KÝ KHUÔN MẶT MỚI =================
const regBtn = document.getElementById('registerBtn');
if (regBtn) {
  regBtn.addEventListener('click', async () => {
    const svId = document.getElementById('svId').value.trim().toUpperCase();
    const svName = document.getElementById('svName').value.trim();
    const svClass = document.getElementById('svClass').value.trim();
    const regStatus = document.getElementById('regStatus');

    if (!svId || !svName) return alert('Vui lòng nhập Mã SV và Họ tên!');

    regStatus.innerText = "Đang quét và trích xuất vector khuôn mặt từ camera...";
    regStatus.style.color = "#3b82f6";

    try {
      const frameElement = await getActiveCameraFrame();

      const detection = await faceapi.detectSingleFace(frameElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        regStatus.innerText = "Thất bại: Không tìm thấy khuôn mặt rõ ràng trong khung hình camera.";
        regStatus.style.color = "#ef4444";
        return;
      }

      // 1. Tạo/cập nhật SV trên backend
      let existingSv = studentsList.find(s => s.id === svId);
      if (!existingSv) {
        await fetch(`${API_BASE}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: svId, name: svName, lop: svClass }),
        });
      }

      // 2. Thêm vector khuôn mặt lên backend
      await fetch(`${API_BASE}/students/${encodeURIComponent(svId)}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: Array.from(detection.descriptor) }),
      });

      // 3. Tải lại danh sách
      await loadStudentsFromBackend();
      await updateDashboardStats();

      regStatus.innerText = `Đã lưu khuôn mặt thành công: ${svName} (${svId})`;
      regStatus.style.color = "#10b981";

      document.getElementById('svId').value = '';
      document.getElementById('svName').value = '';
      document.getElementById('svClass').value = '';
    } catch (err) {
      regStatus.innerText = "Lỗi: " + err.message;
      regStatus.style.color = "#ef4444";
    }
  });
}

async function deleteStudent(svId) {
  if (!confirm(`Xác nhận xóa sinh viên ${svId}?`)) return;
  try {
    await fetch(`${API_BASE}/students/${encodeURIComponent(svId)}`, { method: 'DELETE' });
    await loadStudentsFromBackend();
    await updateDashboardStats();
  } catch (err) {
    alert('Lỗi xóa sinh viên: ' + err.message);
  }
}

function renderStudentTable() {
  const tbody = document.getElementById('studentTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  studentsList.forEach(sv => {
    const hasFace = sv.faceDescriptors && sv.faceDescriptors.length > 0;
    tbody.innerHTML += `<tr>
      <td><b>${sv.id}</b></td>
      <td>${sv.name}</td>
      <td>${sv.lop || ''}</td>
      <td><span style="color: ${hasFace ? '#10b981' : '#6b7280'}; font-weight: bold;">${hasFace ? '● Đã nạp AI' : 'Chưa có'}</span></td>
      <td><button class="btn-danger" style="padding: 5px 10px; font-size: 0.8rem;" onclick="deleteStudent('${sv.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  });
}

// ================= NHẬN DIỆN THỜI GIAN THỰC =================
const startBtn = document.getElementById('startBtn');
const singleScanBtn = document.getElementById('singleScanBtn');
const stopBtn = document.getElementById('stopBtn');

if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (!faceMatcher) return alert('Chưa có dữ liệu khuôn mặt sinh viên nào trong hệ thống!');
    recognizing = true;
    startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="color: #3b82f6;"></i> Đang nhận diện liên tục...';
    recognizeLoop();
  });
}

if (singleScanBtn) {
  singleScanBtn.addEventListener('click', async () => {
    if (!faceMatcher) return alert('Chưa có dữ liệu khuôn mặt sinh viên nào trong hệ thống!');
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét 1 lần...';
    await performFaceScanOnce();
  });
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    recognizing = false;
    if (startBtn) startBtn.disabled = false;
    stopBtn.disabled = true;
    if (recognizeLoopTimer) {
      clearTimeout(recognizeLoopTimer);
      cancelAnimationFrame(recognizeLoopTimer);
      recognizeLoopTimer = null;
    }
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    statusEl.innerHTML = '<i class="fa-solid fa-circle-pause" style="color: #6b7280;"></i> Đã dừng nhận diện.';
  });
}

async function performFaceScanOnce() {
  try {
    const frameElement = await getActiveCameraFrame();
    const detections = await faceapi.detectAllFaces(frameElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    resizeOverlay();
    renderDetectionsOnOverlay(frameElement, detections);

    if (detections.length === 0) {
      statusEl.innerHTML = '<span style="color: #ef4444;">Không tìm thấy khuôn mặt trong khung hình.</span>';
    }
  } catch (err) {
    statusEl.innerHTML = '<span style="color: #ef4444;">Lỗi quét: ' + err.message + '</span>';
  }
}

async function recognizeLoop() {
  if (!recognizing) return;

  try {
    const frameElement = await getActiveCameraFrame();
    const detections = await faceapi.detectAllFaces(frameElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    resizeOverlay();
    renderDetectionsOnOverlay(frameElement, detections);
  } catch (err) {
    console.error('Lỗi nhận diện loop:', err);
  }

  if (recognizing) {
    if (cameraSource === 'esp32') {
      // Polling ESP32-CAM mỗi 800ms để không nghẽn chip ESP
      recognizeLoopTimer = setTimeout(recognizeLoop, 800);
    } else {
      recognizeLoopTimer = requestAnimationFrame(recognizeLoop);
    }
  }
}

function renderDetectionsOnOverlay(frameElement, detections) {
  if (!overlay) return;

  const displayWidth = overlay.width;
  const displayHeight = overlay.height;
  const resized = faceapi.resizeResults(detections, { width: displayWidth, height: displayHeight });
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  let recognizedAny = false;

  resized.forEach((det, i) => {
    const match = faceMatcher ? faceMatcher.findBestMatch(detections[i].descriptor) : null;
    const box = det.detection.box;
    const isUnknown = !match || match.label === 'unknown';

    let displayName = "Không xác định";
    let svInfo = null;

    if (!isUnknown) {
      svInfo = studentsList.find(s => s.id === match.label);
      const conf = Math.round((1 - match.distance) * 100);
      displayName = svInfo ? `${svInfo.name} (${conf}%)` : match.label;
      logAttendance(svInfo, conf);
      recognizedAny = true;
    }

    const boxColor = isUnknown ? '#ef4444' : '#10b981';

    // Vẽ khung viền
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Vẽ nhãn tên
    ctx.fillStyle = boxColor;
    const textWidth = ctx.measureText(displayName).width;
    ctx.fillRect(box.x, box.y - 22, textWidth + 16, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillText(displayName, box.x + 8, box.y - 6);
  });

  if (detections.length > 0 && recognizing) {
    statusEl.innerHTML = recognizedAny
      ? `<span style="color: #10b981; font-weight: bold;">● Đã nhận diện được sinh viên</span>`
      : `<span style="color: #ef4444;">● Phát hiện người lạ (chưa đăng ký)</span>`;
  }
}

// Gửi kết quả check-in lên Backend API
async function logAttendance(svInfo, confidence) {
  if (!svInfo) return;
  const now = Date.now();

  // Chống ghi trùng cục bộ 60 giây
  if (!lastSeenInfo[svInfo.id] || (now - lastSeenInfo[svInfo.id] > 60000)) {
    lastSeenInfo[svInfo.id] = now;

    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: svInfo.id,
          timestamp: now,
          confidence,
        }),
      });

      if (res.ok) {
        console.log(`✅ Điểm danh: ${svInfo.name} (${svInfo.id})`);

        // Mở rơ-le nếu bật autoOpenDoor
        if (systemSettings.autoOpenDoor) {
          fetch(`${API_BASE}/device/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: systemSettings.doorOpenDuration || 5 }),
          }).catch(() => {});
        }

        await updateDashboardStats();
      }
    } catch (e) {
      console.error('Lỗi gửi log điểm danh:', e);
    }
  }
}

// ================= GIAO DIỆN THỐNG KÊ & LỊCH SỬ =================
async function updateDashboardStats() {
  try {
    const statsRes = await fetch(`${API_BASE}/stats/dashboard`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const elTotal = document.getElementById('statTotalStudents');
      const elToday = document.getElementById('statTodayCheckins');
      if (elTotal) elTotal.innerText = stats.totalStudents;
      if (elToday) elToday.innerText = stats.todayCheckins;
    }

    const logsRes = await fetch(`${API_BASE}/attendance?limit=50`);
    if (logsRes.ok) {
      const logs = await logsRes.json();

      const miniBody = document.querySelector('#miniLogTable tbody');
      if (miniBody) {
        miniBody.innerHTML = '';
        logs.slice(0, 10).forEach(log => {
          const timeStr = new Date(log.timestamp).toLocaleString('vi-VN');
          miniBody.innerHTML += `<tr>
            <td>${timeStr}</td>
            <td>${log.studentId}</td>
            <td><b>${log.name}</b></td>
            <td class="${log.status === 'on-time' ? 'status-ok' : ''}" style="${log.status === 'late' ? 'color: #f59e0b; font-weight: bold;' : ''}">
              ${log.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn'}
            </td>
          </tr>`;
        });
      }

      renderMainLogs(logs);
    }
  } catch (err) {
    console.warn('Lỗi cập nhật dashboard:', err.message);
  }
}

function renderMainLogs(logArray) {
  const mainBody = document.querySelector('#mainLogTable tbody');
  if (!mainBody) return;
  mainBody.innerHTML = '';
  logArray.forEach(log => {
    const timeStr = new Date(log.timestamp).toLocaleString('vi-VN');
    mainBody.innerHTML += `<tr>
      <td>${timeStr}</td>
      <td>${log.studentId}</td>
      <td><b>${log.name}</b></td>
      <td>${log.lop || ''}</td>
      <td class="${log.status === 'on-time' ? 'status-ok' : ''}" style="${log.status === 'late' ? 'color: #f59e0b; font-weight: bold;' : ''}">
        ${log.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn'}
      </td>
    </tr>`;
  });
}

async function filterLogs() {
  const keyword = document.getElementById('searchInput').value.toLowerCase();
  try {
    const res = await fetch(`${API_BASE}/attendance?search=${encodeURIComponent(keyword)}`);
    if (res.ok) {
      const filtered = await res.json();
      renderMainLogs(filtered);
    }
  } catch {}
}

async function clearLogs() {
  if (!confirm("Chắc chắn xóa toàn bộ lịch sử điểm danh trên máy chủ?")) return;
  try {
    await fetch(`${API_BASE}/attendance`, { method: 'DELETE' });
    await updateDashboardStats();
  } catch (err) {
    alert('Lỗi xóa lịch sử: ' + err.message);
  }
}

function exportExcel() {
  window.open(`${API_BASE}/attendance/export`, '_blank');
}