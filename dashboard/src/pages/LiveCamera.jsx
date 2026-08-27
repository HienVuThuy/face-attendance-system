import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Wifi, Activity, Cpu, Zap, Radio, RefreshCw, Eye, Sparkles, AlertCircle, Video, Camera, ScanFace, Loader2, UserCheck, PlusCircle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { formatTime, getInitials } from '../utils/helpers';

// ============================================================
// URL tải AI Models (face-api.js weights lưu cục bộ trong public/models)
// ============================================================
const MODEL_URL = '/models';

export default function LiveCamera() {
  const { students, logs, addAttendanceLog, settings, checkDeviceStatus, fetchStudents, currentSession, fetchCurrentSession } = useData();
  const { addToast } = useToast();

  // ── Camera & Stream State ──
  const [streaming, setStreaming] = useState(true);
  const [streamSource, setStreamSource] = useState('esp32'); // 'esp32' | 'webcam'
  const [cameraError, setCameraError] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({ espCam: { online: false }, espDevkit: { online: false } });

  // ── AI Face Recognition State ──
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [registeredFaceCount, setRegisteredFaceCount] = useState(0);
  const [recognizing, setRecognizing] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]); // Realtime detected faces for HUD
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'found' | 'not-found'
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshingStatus(true);
    try {
      await Promise.all([refreshDeviceStatus(), fetchStudents(), buildFaceMatcher()]);
      addToast('✅ Đã làm mới trạng thái thiết bị & dữ liệu AI!', 'success');
    } catch {
      addToast('Lỗi khi làm mới kết nối', 'error');
    } finally {
      setTimeout(() => setIsRefreshingStatus(false), 500);
    }
  };

  // ── Quick Enroll Modal State ──
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // ── Refs ──
  const videoRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const espImgRef = useRef(null);
  const canvasOverlayRef = useRef(null);   // Canvas để vẽ bounding box nhận diện
  const captureCanvasRef = useRef(null);   // Canvas ẩn để chuyển frame thành input cho face-api
  const recognizeLoopRef = useRef(null);
  const recognizingRef = useRef(false);
  const lastSeenRef = useRef({});          // Chống ghi trùng 60s

  // Live recognition event list (last 8 recognized)
  const recentRecognitions = logs.slice(0, 8);

  const espCamIp = settings.espCamIp || '192.168.100.178';
  const espStreamUrl = `http://${espCamIp}:81/stream`;
  const espCaptureUrl = `http://${espCamIp}/capture`;

  // ═══════════════════════════════════════════════════════════
  // 1. LOAD AI MODELS (face-api.js)
  // ═══════════════════════════════════════════════════════════
  const loadModels = useCallback(async () => {
    if (modelsLoaded || modelsLoading) return;

    // Chờ face-api.js load từ CDN
    const faceapi = window.faceapi;
    if (!faceapi) {
      return;
    }

    setModelsLoading(true);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      addToast('✅ AI Models đã tải thành công (TinyFaceDetector + FaceRecognition)', 'success');
    } catch (err) {
      addToast('Lỗi tải AI Models: ' + err.message, 'error');
      console.error('Lỗi load face-api models:', err);
    } finally {
      setModelsLoading(false);
    }
  }, [modelsLoaded, modelsLoading, addToast]);

  // ═══════════════════════════════════════════════════════════
  // 2. BUILD FACE MATCHER (từ dữ liệu sinh viên backend)
  // ═══════════════════════════════════════════════════════════
  const buildFaceMatcher = useCallback(async () => {
    const faceapi = window.faceapi;
    if (!faceapi || !modelsLoaded) return null;

    try {
      // Lấy chi tiết từng SV (gồm faceDescriptors)
      const detailedStudents = await Promise.all(
        students.map(async (s) => {
          try {
            const res = await fetch(`/api/students/${encodeURIComponent(s.id)}`);
            if (res.ok) return await res.json();
          } catch { /* bỏ qua lỗi từng SV */ }
          return s;
        })
      );

      const labeledDescriptors = [];
      detailedStudents.forEach(sv => {
        if (sv.faceDescriptors && sv.faceDescriptors.length > 0) {
          const validDescriptors = sv.faceDescriptors
            .filter(d => (Array.isArray(d) && d.length === 128) || (typeof d === 'object' && Object.keys(d).length === 128))
            .map(d => new Float32Array(Array.isArray(d) ? d : Object.values(d)));

          if (validDescriptors.length > 0) {
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(sv.id, validDescriptors)
            );
          }
        }
      });

      setRegisteredFaceCount(labeledDescriptors.length);

      if (labeledDescriptors.length > 0) {
        const threshold = Number(settings.faceThreshold) || 0.5;
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
        setFaceMatcher(matcher);
        return matcher;
      } else {
        setFaceMatcher(null);
        return null;
      }
    } catch (err) {
      console.error('Lỗi build FaceMatcher:', err);
      return null;
    }
  }, [students, modelsLoaded, settings.faceThreshold]);

  // Auto-load models khi component mount
  useEffect(() => {
    const checkAndLoad = () => {
      if (window.faceapi) {
        loadModels();
      } else {
        setTimeout(checkAndLoad, 500);
      }
    };
    checkAndLoad();
  }, [loadModels]);

  // Rebuild FaceMatcher khi models loaded hoặc students thay đổi
  useEffect(() => {
    if (modelsLoaded && students.length > 0) {
      buildFaceMatcher();
    }
  }, [modelsLoaded, students, buildFaceMatcher]);

  // ═══════════════════════════════════════════════════════════
  // 3. CHECK DEVICE STATUS (ESP32-CAM & DevKit)
  // ═══════════════════════════════════════════════════════════
  const refreshDeviceStatus = useCallback(async () => {
    const status = await checkDeviceStatus();
    if (status) {
      setDeviceStatus(status);
    }
  }, [checkDeviceStatus]);

  useEffect(() => {
    refreshDeviceStatus();
    const interval = setInterval(refreshDeviceStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshDeviceStatus]);

  // ═══════════════════════════════════════════════════════════
  // 4. STOP RECOGNITION HELPER
  // ═══════════════════════════════════════════════════════════
  const stopRecognition = useCallback((silent = false) => {
    setRecognizing(false);
    recognizingRef.current = false;
    if (recognizeLoopRef.current) {
      cancelAnimationFrame(recognizeLoopRef.current);
      clearTimeout(recognizeLoopRef.current);
      recognizeLoopRef.current = null;
    }
    if (canvasOverlayRef.current) {
      const ctx = canvasOverlayRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasOverlayRef.current.width, canvasOverlayRef.current.height);
    }
    setDetectedFaces([]);
    if (!silent) {
      addToast('Đã dừng nhận diện liên tục', 'info');
    }
  }, [addToast]);

  // ═══════════════════════════════════════════════════════════
  // 5. CAMERA STREAM (ESP32-CAM MJPEG hoặc Webcam)
  // ═══════════════════════════════════════════════════════════
  const handleStart = async (source = streamSource) => {
    setCameraError(false);
    setStreaming(true);

    if (source === 'webcam') {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          webcamStreamRef.current = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play();
          }
          addToast('Đã kết nối Webcam máy tính thành công!', 'success');
          return;
        }
      } catch (err) {
        setCameraError(true);
        addToast('Không thể mở Webcam: ' + err.message, 'error');
        setStreaming(false);
        return;
      }
    } else {
      addToast(`Đang kết nối luồng MJPEG từ ESP32-CAM (${espCamIp})...`, 'info');
    }
  };

  const handleStop = () => {
    stopRecognition();

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setCameraError(false);
    setDetectedFaces([]);
    addToast('Đã ngắt luồng Camera', 'info');
  };

  useEffect(() => {
    return () => {
      stopRecognition(true);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopRecognition]);

  // ═══════════════════════════════════════════════════════════
  // 5. NHẬN DIỆN KHUÔN MẶT THẬT (face-api.js)
  // ═══════════════════════════════════════════════════════════

  /**
   * Lấy 1 frame từ ESP32-CAM /capture, trả về Image element
   */
  const captureFrameFromESP = () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không thể lấy frame từ ESP32-CAM tại ' + espCaptureUrl));
      img.src = `${espCaptureUrl}?t=${Date.now()}`;
    });
  };

  /**
   * Quét 1 lần: detect & recognize tất cả khuôn mặt trong frame hiện tại
   */
  const handleSingleScan = async () => {
    const faceapi = window.faceapi;
    if (!faceapi || !modelsLoaded) {
      addToast('AI Models đang tải, vui lòng thử lại sau vài giây...', 'info');
      return;
    }

    setScanStatus('scanning');

    try {
      let inputElement;

      if (streamSource === 'webcam') {
        inputElement = videoRef.current;
        if (!inputElement || inputElement.readyState < 2) {
          addToast('Webcam chưa sẵn sàng, hãy bật luồng camera trước!', 'error');
          setScanStatus('idle');
          return;
        }
      } else {
        try {
          inputElement = await captureFrameFromESP();
        } catch (err) {
          addToast(`Lỗi lấy ảnh ESP32-CAM: ${err.message}`, 'error');
          setScanStatus('not-found');
          return;
        }
      }

      const detections = await faceapi
        .detectAllFaces(inputElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setScanStatus('not-found');
        setDetectedFaces([]);
        addToast('Không tìm thấy khuôn mặt nào trong khung hình.', 'info');
        return;
      }

      drawDetections(inputElement, detections);

      let foundCount = 0;
      for (const det of detections) {
        const match = faceMatcher ? faceMatcher.findBestMatch(det.descriptor) : null;
        const isUnknown = !match || match.label === 'unknown';

        if (!isUnknown) {
          foundCount++;
          const confidence = Math.round((1 - match.distance) * 100);
          await logRecognition(match.label, confidence);
        }
      }

      if (foundCount > 0) {
        setScanStatus('found');
      } else {
        setScanStatus('not-found');
        if (!faceMatcher || registeredFaceCount === 0) {
          addToast('⚠️ Phát hiện khuôn mặt nhưng hệ thống chưa có dữ liệu sinh viên nào được nạp AI.', 'warning');
        } else {
          addToast('Phát hiện khuôn mặt nhưng không khớp sinh viên nào trong hệ thống.', 'info');
        }
      }

      setDetectedFaces(detections.map(det => {
        const match = faceMatcher ? faceMatcher.findBestMatch(det.descriptor) : null;
        const sv = match && match.label !== 'unknown' ? students.find(s => s.id === match.label) : null;
        return {
          name: sv ? sv.name : 'Người lạ (Chưa đăng ký)',
          id: match ? match.label : 'unknown',
          confidence: match ? Math.round((1 - match.distance) * 100) : 0,
          isUnknown: !match || match.label === 'unknown',
        };
      }));

    } catch (err) {
      console.error('Lỗi quét nhận diện:', err);
      addToast('Lỗi nhận diện: ' + err.message, 'error');
      setScanStatus('idle');
    }
  };

  /**
   * Quét liên tục (auto-scan loop)
   */
  const startRecognition = async () => {
    const faceapi = window.faceapi;
    if (!faceapi || !modelsLoaded) {
      addToast('AI Models đang tải, vui lòng chờ...', 'info');
      return;
    }

    setRecognizing(true);
    recognizingRef.current = true;
    addToast('🔄 Bắt đầu nhận diện liên tục...', 'info');

    const loop = async () => {
      if (!recognizingRef.current) return;

      try {
        let inputElement;

        if (streamSource === 'webcam') {
          inputElement = videoRef.current;
          if (!inputElement || inputElement.readyState < 2) {
            if (recognizingRef.current) {
              recognizeLoopRef.current = requestAnimationFrame(loop);
            }
            return;
          }
        } else {
          try {
            inputElement = await captureFrameFromESP();
          } catch {
            if (recognizingRef.current) {
              recognizeLoopRef.current = setTimeout(loop, 2000);
            }
            return;
          }
        }

        const detections = await faceapi
          .detectAllFaces(inputElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        drawDetections(inputElement, detections);

        if (detections.length > 0) {
          const faces = [];
          for (const det of detections) {
            const match = faceMatcher ? faceMatcher.findBestMatch(det.descriptor) : null;
            const isUnknown = !match || match.label === 'unknown';
            const sv = !isUnknown ? students.find(s => s.id === match.label) : null;

            faces.push({
              name: sv ? sv.name : 'Người lạ (Chưa đăng ký)',
              id: match ? match.label : 'unknown',
              confidence: match ? Math.round((1 - match.distance) * 100) : 0,
              isUnknown,
            });

            if (!isUnknown) {
              const confidence = Math.round((1 - match.distance) * 100);
              await logRecognition(match.label, confidence);
            }
          }
          setDetectedFaces(faces);
        } else {
          setDetectedFaces([]);
        }

      } catch (err) {
        console.error('Lỗi recognize loop:', err);
      }

      if (recognizingRef.current) {
        if (streamSource === 'webcam') {
          recognizeLoopRef.current = requestAnimationFrame(loop);
        } else {
          recognizeLoopRef.current = setTimeout(loop, 800);
        }
      }
    };

    loop();
  };

  /**
   * Vẽ bounding box + label lên canvas overlay
   */
  const drawDetections = (inputElement, detections) => {
    const faceapi = window.faceapi;
    const canvas = canvasOverlayRef.current;
    if (!canvas || !faceapi) return;

    const container = canvas.parentElement;
    const displayWidth = container?.clientWidth || 640;
    const displayHeight = container?.clientHeight || 480;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const resized = faceapi.resizeResults(detections, {
      width: displayWidth,
      height: displayHeight,
    });

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    resized.forEach((det, i) => {
      const match = faceMatcher ? faceMatcher.findBestMatch(detections[i].descriptor) : null;
      const isUnknown = !match || match.label === 'unknown';
      const sv = !isUnknown ? students.find(s => s.id === match.label) : null;
      const displayName = sv
        ? `${sv.name} (${Math.round((1 - match.distance) * 100)}%)`
        : (faceMatcher ? 'Người lạ' : 'Phát hiện mặt (Chưa nạp AI)');
      const boxColor = isUnknown ? '#ef4444' : '#10b981';

      const box = det.detection.box;

      // Vẽ box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Vẽ nhãn
      ctx.fillStyle = boxColor;
      const textWidth = ctx.measureText(displayName).width;
      ctx.fillRect(box.x, box.y - 24, textWidth + 20, 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Inter", "Segoe UI", sans-serif';
      ctx.fillText(displayName, box.x + 8, box.y - 7);
    });
  };

  /**
   * Ghi nhận điểm danh (chống trùng 60s)
   */
  const logRecognition = async (studentId, confidence) => {
    const now = Date.now();

    if (lastSeenRef.current[studentId] && (now - lastSeenRef.current[studentId] < 60000)) {
      return;
    }
    lastSeenRef.current[studentId] = now;

    try {
      const res = await addAttendanceLog({
        studentId,
        timestamp: now,
        confidence,
      });

      const sv = students.find(s => s.id === studentId);
      const svName = sv ? sv.name : studentId;

      if (res.skipped) {
        addToast(`Bỏ qua: ${svName} (${studentId}) vừa check-in cách đây < 60s`, 'info');
      } else {
        const log = res.log || {};
        const statusText = log.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn';
        addToast(`✅ AI Điểm danh: ${svName} (${studentId}) — ${confidence}% — ${statusText}`, 'success');
      }
    } catch (err) {
      addToast('Lỗi ghi nhận điểm danh: ' + err.message, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 6. ĐĂNG KÝ NHANH KHUÔN MẶT TỪ CAMERA CHO SINH VIÊN
  // ═══════════════════════════════════════════════════════════
  const handleQuickEnroll = async () => {
    if (!selectedStudentForEnroll) {
      addToast('Vui lòng chọn một sinh viên để gán khuôn mặt!', 'error');
      return;
    }

    const faceapi = window.faceapi;
    if (!faceapi || !modelsLoaded) {
      addToast('AI Models chưa tải xong!', 'error');
      return;
    }

    setEnrolling(true);
    try {
      let inputElement;
      if (streamSource === 'webcam') {
        inputElement = videoRef.current;
      } else {
        inputElement = await captureFrameFromESP();
      }

      const detection = await faceapi
        .detectSingleFace(inputElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        addToast('Không tìm thấy khuôn mặt rõ ràng trong khung hình. Hãy nhìn thẳng vào camera!', 'error');
        setEnrolling(false);
        return;
      }

      // Gửi descriptor lên backend
      const res = await fetch(`/api/students/${encodeURIComponent(selectedStudentForEnroll)}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: Array.from(detection.descriptor) }),
      });

      if (res.ok) {
        const targetSv = students.find(s => s.id === selectedStudentForEnroll);
        addToast(`🎉 Đã nạp thành công khuôn mặt cho sinh viên ${targetSv ? targetSv.name : selectedStudentForEnroll}!`, 'success');
        setShowEnrollModal(false);
        await fetchStudents();
        await buildFaceMatcher();
      } else {
        const err = await res.json();
        addToast(`Lỗi nạp vector: ${err.error}`, 'error');
      }
    } catch (err) {
      addToast('Lỗi nạp khuôn mặt: ' + err.message, 'error');
    } finally {
      setEnrolling(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in">
      {/* ★ Current Session Status Banner */}
      {currentSession && (
        currentSession.active ? (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-3.5 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-3 rounded-full bg-white animate-pulse flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-wide truncate">
                  {currentSession.session.name} — {currentSession.session.subject}
                </p>
                <p className="text-xs text-emerald-100">
                  {currentSession.currentDayName} • {currentSession.session.start_time} – {currentSession.session.end_time} • Phòng {currentSession.session.room}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full flex-shrink-0">
              Đang diễn ra
            </span>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3.5 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-wide">
                  Ngoài giờ học — Không có ca học nào đang diễn ra
                </p>
                <p className="text-xs text-amber-100">
                  {currentSession.currentDayName} • {currentSession.currentTime} — Điểm danh sẽ bị từ chối
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full flex-shrink-0">
              Tạm dừng
            </span>
          </div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Live Feed (3/5) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Video Feed Wrapper */}
          <div className="bg-slate-950 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            {/* Camera Header HUD */}
            <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                  <div className={`w-2.5 h-2.5 rounded-full ${streaming ? 'bg-emerald-400 animate-pulse-dot' : 'bg-slate-500'}`} aria-hidden="true" />
                  <span className="text-xs font-bold text-slate-200 tracking-wider">
                    {streaming
                      ? (streamSource === 'webcam' ? 'WEBCAM LAPTOP' : 'ESP32-CAM MJPEG')
                      : 'STANDBY MODE'}
                  </span>
                </div>
                <span className="text-xs text-blue-400 font-mono font-semibold hidden sm:inline">
                  {streamSource === 'esp32' ? `IP: ${espCamIp}:81` : 'Local MediaStream'}
                </span>

                {/* AI Model status */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${modelsLoaded
                    ? (registeredFaceCount > 0
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700'
                      : 'bg-amber-900/40 text-amber-300 border-amber-700')
                    : modelsLoading
                      ? 'bg-amber-900/40 text-amber-400 border-amber-700'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                  {modelsLoaded
                    ? (registeredFaceCount > 0 ? `● AI READY (${registeredFaceCount} SV)` : '● AI CHƯA CÓ DỮ LIỆU')
                    : modelsLoading ? '⏳ LOADING AI...' : '○ AI OFF'}
                </span>
              </div>

              {/* Source toggle */}
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    const next = 'esp32';
                    setStreamSource(next);
                    if (streaming) { handleStop(); handleStart(next); }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${streamSource === 'esp32' ? 'bg-blue-600 text-white font-bold' : 'hover:text-white'}`}
                >
                  ESP32-CAM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = 'webcam';
                    setStreamSource(next);
                    if (streaming) { handleStop(); handleStart(next); }
                  }}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${streamSource === 'webcam' ? 'bg-blue-600 text-white font-bold' : 'hover:text-white'}`}
                >
                  Webcam
                </button>
              </div>
            </div>

            {/* Camera Viewport */}
            <div
              className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden select-none"
              aria-label="Khung hình Camera trực tiếp"
            >
              {streaming ? (
                <>
                  {/* Real video/image element */}
                  {streamSource === 'webcam' ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    /* ESP32-CAM MJPEG Stream */
                    <img
                      ref={espImgRef}
                      src={espStreamUrl}
                      alt="Luồng ESP32-CAM"
                      onError={() => setCameraError(true)}
                      onLoad={() => setCameraError(false)}
                      className={`absolute inset-0 w-full h-full object-cover ${cameraError ? 'opacity-20' : 'opacity-100'}`}
                    />
                  )}

                  {/* Canvas overlay cho bounding box nhận diện */}
                  <canvas
                    ref={canvasOverlayRef}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  />

                  {/* Canvas ẩn để capture frame */}
                  <canvas ref={captureCanvasRef} className="hidden" />

                  {/* Camera Error Message Overlay */}
                  {cameraError && streamSource === 'esp32' && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
                      <AlertCircle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
                      <p className="text-white font-bold text-sm">Không thể kết nối luồng ESP32-CAM</p>
                      <p className="text-slate-400 text-xs mt-1 max-w-md font-mono">
                        URL: {espStreamUrl}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-1">
                        Module ESP32-CAM chưa bật nguồn hoặc chưa kết nối chung mạng WiFi
                      </p>
                      <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setStreamSource('webcam');
                            handleStop();
                            handleStart('webcam');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" /> Chuyển sang Webcam máy tính ngay
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraError(false);
                            if (espImgRef.current) espImgRef.current.src = espStreamUrl + '?t=' + Date.now();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                        >
                          Thử lại ESP32
                        </button>
                      </div>
                    </div>
                  )}

                  {/* High-Tech Tactical Grid */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.15) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Corner Target Reticles */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none" />

                  {/* Scan line effect */}
                  <div className="scan-line" aria-hidden="true" />

                  {/* Top HUD Telemetry */}
                  <div className="absolute top-4 left-12 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 z-10">
                    <span className="flex items-center gap-1">
                      <Radio className={`w-3.5 h-3.5 ${recognizing ? 'text-red-500 animate-pulse-dot' : 'text-slate-500'}`} />
                      {recognizing ? 'AI AUTO-SCAN ON' : 'CAMERA LIVE'}
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-200 tabular-nums">
                      {detectedFaces.length > 0 ? `${detectedFaces.length} MẶT` : 'NO FACE'}
                    </span>
                  </div>

                  {/* Bottom HUD Telemetry */}
                  <div className="absolute bottom-4 left-12 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400 font-bold tabular-nums z-10">
                    <span>NGƯỠNG: {settings.faceThreshold || 0.5}</span>
                    <span className="text-slate-500">|</span>
                    <span className={recognizing ? 'text-red-400' : 'text-cyan-400'}>
                      {recognizing ? 'STATUS: SCANNING' : 'STATUS: READY'}
                    </span>
                  </div>

                  {/* Detected faces HUD (bottom-right) */}
                  {detectedFaces.length > 0 && (
                    <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-2 text-xs font-mono z-10 max-w-[220px]">
                      {detectedFaces.map((face, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1 ${face.isUnknown ? 'text-red-400' : 'text-emerald-400'}`}>
                          <div className={`w-2 h-2 rounded-full ${face.isUnknown ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span className="truncate">{face.name}</span>
                          {face.confidence > 0 && <span className="text-slate-400">{face.confidence}%</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Cpu className="w-10 h-10 text-slate-600 animate-pulse" />
                  </div>
                  <p className="text-slate-200 font-bold text-base">Camera Đang Ở Trạng Thái Chờ</p>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-sm mx-auto">
                    Nhấn "Bật Luồng Camera" để kết nối luồng video và bắt đầu nhận diện.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Controls & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* IoT Hardware Telemetry */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-600" /> Trạng thái kết nối
                  </h4>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={isRefreshingStatus}
                    title="Làm mới trạng thái kết nối và AI"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-600">
                      {streamSource === 'webcam' ? 'Webcam máy tính' : 'Camera ESP32-CAM'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {streamSource === 'webcam' ? 'Webcam USB/Laptop' : espCamIp}
                      </span>
                      <StatusBadge status={streamSource === 'webcam' ? (streaming ? 'online' : 'offline') : (deviceStatus?.espCam?.online && !cameraError ? 'online' : 'offline')} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-1">
                    <span className="text-sm font-medium text-slate-600">AI Nhận diện</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">{registeredFaceCount} SV nạp AI</span>
                      <StatusBadge status={modelsLoaded ? 'online' : 'offline'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Nút nạp nhanh khuôn mặt */}
              <button
                type="button"
                onClick={() => setShowEnrollModal(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Nạp khuôn mặt hiện tại cho Sinh viên
              </button>
            </div>

            {/* Action Panel */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Bảng điều khiển tác vụ
              </h4>
              <div className="space-y-2.5">
                {/* Bật / Dừng luồng */}
                {streaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 outline-none transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
                  >
                    <Square className="w-4 h-4" /> Dừng Luồng Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStart(streamSource)}
                    className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Bật Luồng {streamSource === 'esp32' ? 'ESP32-CAM' : 'Webcam'}
                  </button>
                )}

                {/* Quét 1 lần */}
                <button
                  type="button"
                  onClick={handleSingleScan}
                  disabled={!modelsLoaded}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scanStatus === 'scanning' ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Đang phân tích khuôn mặt...</>
                  ) : (
                    <><ScanFace className="w-4 h-4 text-indigo-600" /> Quét 1 lần (AI Scan)</>
                  )}
                </button>

                {/* Nhận diện liên tục */}
                {recognizing ? (
                  <button
                    type="button"
                    onClick={stopRecognition}
                    className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-500 outline-none transition-all cursor-pointer shadow-sm shadow-red-500/25"
                  >
                    <Square className="w-4 h-4" /> Dừng Nhận diện liên tục
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecognition}
                    disabled={!modelsLoaded || !streaming}
                    className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-all shadow-sm shadow-indigo-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" /> Nhận diện liên tục (Auto-Scan)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Recognition Log Feed (2/5) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 h-full flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" /> Nhật ký nhận diện trực tiếp
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Sự kiện check-in ghi nhận theo thời gian thực</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {recentRecognitions.length} sự kiện
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto flex-1 p-2" role="feed" aria-label="Luồng nhận diện trực tiếp">
              {recentRecognitions.map((log, i) => (
                <article
                  key={log.id}
                  className="p-3.5 rounded-xl hover:bg-slate-50 transition-all animate-slide-right mb-1"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {getInitials(log.name)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{log.name}</p>
                      <p className="text-xs text-slate-500 font-mono font-medium tabular-nums">{log.studentId} • {log.lop}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-600 font-semibold tabular-nums">{formatTime(log.timestamp)}</p>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${log.status === 'on-time' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {log.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}

              {recentRecognitions.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-sm font-semibold">Chưa có lượt điểm danh nào hôm nay</p>
                  <p className="text-xs mt-1">Bấm "Nhận diện liên tục" hoặc "Quét 1 lần" để bắt đầu.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL: QUICK FACE ENROLL ================= */}
      <Modal isOpen={showEnrollModal} onClose={() => setShowEnrollModal(false)} title="Nạp khuôn mặt từ Camera cho Sinh viên" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Hệ thống sẽ lấy ngay 1 frame từ luồng camera hiện tại, trích xuất vector khuôn mặt AI và lưu vào hồ sơ sinh viên được chọn.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Chọn Sinh viên cần nạp khuôn mặt:
            </label>
            <select
              value={selectedStudentForEnroll}
              onChange={(e) => setSelectedStudentForEnroll(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
            >
              <option value="">-- Chọn sinh viên trong danh sách --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id}) - {s.lop} {s.faceStatus === 'registered' ? '● Đã có mặt' : '○ Chưa có'}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <b>Lưu ý:</b> Hãy nhìn thẳng vào ống kính ESP32-CAM với ánh sáng rõ ràng trước khi bấm nút xác nhận.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEnrollModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!selectedStudentForEnroll || enrolling}
              onClick={handleQuickEnroll}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang trích xuất...</> : <><UserCheck className="w-4 h-4" /> Trích xuất & Nạp vào SV</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
