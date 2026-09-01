import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UserPlus, Search, Edit3, Trash2, Upload, Camera, Check, X, 
  RotateCcw, Sparkles, Loader2, AlertCircle, ScanFace, Plus, 
  Layers, CheckCircle2, ShieldCheck, RefreshCw
} from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { getInitials } from '../utils/helpers';

// Weights URL (lưu cục bộ trong public/models)
const MODEL_URL = '/models';

const CAPTURE_PROMPTS = [
  'Ảnh 1/5: Nhìn thẳng trực diện',
  'Ảnh 2/5: Quay nhẹ sang trái (15°)',
  'Ảnh 3/5: Quay nhẹ sang phải (15°)',
  'Ảnh 4/5: Ngẩng cằm nhẹ lên',
  'Ảnh 5/5: Hơi cúi hoặc mỉm cười nhẹ',
];

export default function StudentManagement() {
  const { 
    students, addStudent, updateStudent, deleteStudent, 
    addStudentDescriptor, addStudentDescriptors, deleteStudentDescriptors, 
    refreshAll 
  } = useData();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | registered | not_registered
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [showFaceManageModal, setShowFaceManageModal] = useState(false);

  // Form states
  const [newStudent, setNewStudent] = useState({ id: '', name: '', lop: '', avatar: null, faceDescriptors: [], samples: [] });
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [managingStudent, setManagingStudent] = useState(null);
  const [managingStudentDetails, setManagingStudentDetails] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [extractingFace, setExtractingFace] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');

  // AI Models state
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Webcam capture state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCapturingFor, setIsCapturingFor] = useState('add'); // 'add' | 'edit' | 'manage'
  const [capturedSessionSamples, setCapturedSessionSamples] = useState([]);
  const [isAutoBurstRunning, setIsAutoBurstRunning] = useState(false);
  const [burstStep, setBurstStep] = useState(0);
  const [burstCountdown, setBurstCountdown] = useState(0);
  const [burstStepName, setBurstStepName] = useState('');

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const manageFileInputRef = useRef(null);

  // Load face-api.js AI Models
  const ensureModelsLoaded = useCallback(async () => {
    const faceapi = window.faceapi;
    if (!faceapi) return false;

    if (
      faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded
    ) {
      setModelsLoaded(true);
      return true;
    }

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      return true;
    } catch (err) {
      console.warn('Lỗi load face-api models:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    ensureModelsLoaded();
  }, [ensureModelsLoaded]);

  // Trích xuất vector 128 chiều từ phần tử ảnh hoặc canvas
  const computeFaceDescriptor = async (imageOrCanvas) => {
    const faceapi = window.faceapi;
    if (!faceapi) return null;

    try {
      await ensureModelsLoaded();

      const detection = await faceapi
        .detectSingleFace(imageOrCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection && detection.descriptor && detection.descriptor.length === 128) {
        return Array.from(detection.descriptor);
      }
    } catch (err) {
      console.error('Lỗi trích xuất vector khuôn mặt:', err);
    }
    return null;
  };

  // Filter students
  const filtered = students.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.lop && s.lop.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      filterStatus === 'all' || s.faceStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAll();
      addToast('✅ Đã làm mới danh sách sinh viên thành công!', 'success');
    } catch {
      addToast('Không thể làm mới dữ liệu từ máy chủ', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // XỬ LÝ CHỌN NHIỀU ẢNH TỪ MÁY TÍNH
  // ═══════════════════════════════════════════════════════════
  const handleMultipleImageFiles = async (e, target = 'add') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setExtractingFace(true);
    let successCount = 0;
    const newDescriptors = [];
    let firstValidAvatar = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setExtractionProgress(`Đang xử lý ảnh ${i + 1}/${files.length}...`);

      if (file.size > 8 * 1024 * 1024) continue;

      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        const desc = await computeFaceDescriptor(img);
        if (desc) {
          successCount++;
          newDescriptors.push(desc);
          if (!firstValidAvatar) firstValidAvatar = dataUrl;
        }
      } catch (err) {
        console.warn(`Lỗi xử lý file ${file.name}:`, err);
      }
    }

    setExtractingFace(false);
    setExtractionProgress('');
    e.target.value = ''; // Reset input file

    if (newDescriptors.length === 0) {
      addToast('⚠️ Không tìm thấy khuôn mặt rõ ràng trong các ảnh đã chọn. Hãy chọn ảnh chụp thẳng mặt, đủ sáng.', 'warning');
      return;
    }

    const newSamples = newDescriptors.map((desc, idx) => ({
      dataUrl: files[idx] ? URL.createObjectURL(files[idx]) : firstValidAvatar,
      descriptor: desc,
      timestamp: Date.now() + idx,
    }));

    addToast(`🎉 Đã trích xuất thành công ${newDescriptors.length} mẫu khuôn mặt AI!`, 'success');

    if (target === 'add') {
      setNewStudent(prev => ({
        ...prev,
        avatar: prev.avatar || firstValidAvatar,
        faceStatus: 'registered',
        faceDescriptors: [...(prev.faceDescriptors || []), ...newDescriptors],
        samples: [...(prev.samples || []), ...newSamples],
      }));
    } else if (target === 'edit') {
      setEditingStudent(prev => ({
        ...prev,
        avatar: prev.avatar || firstValidAvatar,
        faceStatus: 'registered',
        faceDescriptors: [...(prev.faceDescriptors || []), ...newDescriptors],
        samples: [...(prev.samples || []), ...newSamples],
      }));
    } else if (target === 'manage' && managingStudent) {
      try {
        await addStudentDescriptors(managingStudent.id, newDescriptors);
        addToast(`✅ Đã nạp thêm ${newDescriptors.length} mẫu khuôn mặt cho ${managingStudent.name}!`, 'success');
        await loadManagingDetails(managingStudent.id);
      } catch (err) {
        addToast('Lỗi lưu vector khuôn mặt: ' + err.message, 'error');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  // WEBCAM CAPTURE (HỖ TRỢ CHỤP NHIỀU MẪU & AUTO-BURST 5 GÓC)
  // ═══════════════════════════════════════════════════════════
  const startWebcam = async (target = 'add') => {
    setIsCapturingFor(target);
    setCapturedSessionSamples([]);
    setIsAutoBurstRunning(false);
    setBurstStep(0);
    setShowWebcamModal(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      addToast('Không thể mở Webcam: ' + err.message, 'error');
      setShowWebcamModal(false);
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsAutoBurstRunning(false);
    setShowWebcamModal(false);
  };

  // Chụp 1 ảnh đơn từ webcam
  const captureSingleSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const desc = await computeFaceDescriptor(canvas);
    if (desc) {
      const newSample = { dataUrl, descriptor: desc, timestamp: Date.now() };
      setCapturedSessionSamples(prev => [...prev, newSample]);
      addToast(`📸 Đã lưu mẫu #${capturedSessionSamples.length + 1}!`, 'success');
      return newSample;
    } else {
      addToast('⚠️ Không nhận diện rõ khuôn mặt. Vui lòng căn chỉnh lại góc mặt!', 'warning');
      return null;
    }
  };

  const STEP_DETAILS = [
    { title: 'Bước 1/5: Nhìn thẳng trực diện', hint: 'Giữ khuôn mặt ngay giữa khung hình' },
    { title: 'Bước 2/5: Hơi nghiêng sang TRÁI', hint: 'Quay nhẹ mặt sang trái khoảng 15-20°' },
    { title: 'Bước 3/5: Hơi nghiêng sang PHẢI', hint: 'Quay nhẹ mặt sang phải khoảng 15-20°' },
    { title: 'Bước 4/5: Ngẩng cằm nhẹ lên trên', hint: 'Ngẩng đầu nhẹ lên khoảng 10-15°' },
    { title: 'Bước 5/5: Cúi nhẹ hoặc mỉm cười', hint: 'Cúi nhẹ hoặc mỉm cười tự nhiên' },
  ];

  // Chụp tự động 5 góc mặt với đếm ngược 3s cho mỗi góc + tự thử lại nếu mờ
  const startAutoBurst = async () => {
    if (isAutoBurstRunning) return;
    setIsAutoBurstRunning(true);

    for (let step = 0; step < 5; step++) {
      setBurstStep(step);
      setBurstStepName(STEP_DETAILS[step].title);

      let success = false;
      let attempt = 0;

      while (!success && attempt < 3) {
        attempt++;
        // Đếm ngược 3 giây cho người dùng đổi tư thế thoải mái
        for (let cd = 3; cd > 0; cd--) {
          setBurstCountdown(cd);
          await new Promise(r => setTimeout(r, 1000));
        }
        setBurstCountdown(0);

        // Chụp và trích xuất vector AI
        const sample = await captureSingleSnapshot();
        if (sample) {
          success = true;
          // Chờ 800ms để người dùng thấy feedback trước khi sang góc kế tiếp
          await new Promise(r => setTimeout(r, 800));
        } else {
          // Thử lại nếu chưa thấy rõ mặt
          setBurstStepName(`⚠️ Thử lại ${STEP_DETAILS[step].title} (Hãy giữ khuôn mặt rõ nét)`);
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }

    setIsAutoBurstRunning(false);
    setBurstStep(0);
    setBurstCountdown(0);
    setBurstStepName('');
    addToast('🎉 Đã hoàn thành quá trình quét đầy đủ 5 mẫu khuôn mặt!', 'success');
  };

  // Lưu tất cả mẫu đã chụp từ Webcam vào sinh viên
  const finalizeWebcamCapture = async () => {
    if (capturedSessionSamples.length === 0) {
      addToast('Chưa có mẫu khuôn mặt nào được chụp!', 'warning');
      stopWebcam();
      return;
    }

    const descriptors = capturedSessionSamples.map(s => s.descriptor);
    const firstAvatar = capturedSessionSamples[0].dataUrl;

    if (isCapturingFor === 'add') {
      setNewStudent(prev => ({
        ...prev,
        avatar: prev.avatar || firstAvatar,
        faceStatus: 'registered',
        faceDescriptors: [...(prev.faceDescriptors || []), ...descriptors],
        samples: [...(prev.samples || []), ...capturedSessionSamples],
      }));
      addToast(`✅ Đã thêm ${descriptors.length} mẫu khuôn mặt vào danh sách!`, 'success');
    } else if (isCapturingFor === 'edit') {
      setEditingStudent(prev => ({
        ...prev,
        avatar: prev.avatar || firstAvatar,
        faceStatus: 'registered',
        faceDescriptors: [...(prev.faceDescriptors || []), ...descriptors],
        samples: [...(prev.samples || []), ...capturedSessionSamples],
      }));
      addToast(`✅ Đã thêm ${descriptors.length} mẫu khuôn mặt mới!`, 'success');
    } else if (isCapturingFor === 'manage' && managingStudent) {
      try {
        await addStudentDescriptors(managingStudent.id, descriptors);
        addToast(`✅ Đã nạp ${descriptors.length} mẫu khuôn mặt cho ${managingStudent.name}!`, 'success');
        await loadManagingDetails(managingStudent.id);
      } catch (err) {
        addToast('Lỗi lưu vector: ' + err.message, 'error');
      }
    }

    stopWebcam();
  };

  // ═══════════════════════════════════════════════════════════
  // QUẢN LÝ DỮ LIỆU KHUÔN MẶT RIÊNG CHO TỪNG SINH VIÊN
  // ═══════════════════════════════════════════════════════════
  const loadManagingDetails = async (id) => {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setManagingStudentDetails(data);
      }
    } catch (err) {
      console.error('Lỗi tải chi tiết sinh viên:', err);
    }
  };

  const openFaceManage = async (student) => {
    setManagingStudent(student);
    setManagingStudentDetails(null);
    setShowFaceManageModal(true);
    await loadManagingDetails(student.id);
  };

  const handleResetFaceData = async () => {
    if (!managingStudent) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu khuôn mặt của ${managingStudent.name}? Sinh viên này sẽ chuyển về trạng thái Chưa đăng ký.`)) {
      return;
    }

    try {
      await deleteStudentDescriptors(managingStudent.id);
      addToast(`🗑️ Đã xóa toàn bộ vector khuôn mặt của ${managingStudent.name}!`, 'info');
      await loadManagingDetails(managingStudent.id);
    } catch (err) {
      addToast('Lỗi xóa vector: ' + err.message, 'error');
    }
  };

  // CREATE
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newStudent.id.trim() || !newStudent.name.trim() || !newStudent.lop.trim()) {
      addToast('Vui lòng điền đầy đủ Mã SV, Họ tên và Lớp!', 'error');
      return;
    }

    try {
      await addStudent({
        id: newStudent.id.trim().toUpperCase(),
        name: newStudent.name.trim(),
        lop: newStudent.lop.trim(),
        avatar: newStudent.avatar || null,
        faceDescriptors: newStudent.faceDescriptors || [],
      });
      addToast(`🎉 Đã thêm sinh viên ${newStudent.name} (${newStudent.id}) với ${newStudent.faceDescriptors?.length || 0} mẫu khuôn mặt!`, 'success');
      setNewStudent({ id: '', name: '', lop: '', avatar: null, faceDescriptors: [], samples: [] });
      setShowAddModal(false);
    } catch (err) {
      addToast('Lỗi thêm sinh viên: ' + err.message, 'error');
    }
  };

  // UPDATE
  const openEdit = (student) => {
    setEditingStudent({ ...student, faceDescriptors: [] });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStudent.name.trim() || !editingStudent.lop.trim()) {
      addToast('Vui lòng điền đầy đủ thông tin!', 'error');
      return;
    }

    try {
      await updateStudent(editingStudent.id, {
        name: editingStudent.name.trim(),
        lop: editingStudent.lop.trim(),
        avatar: editingStudent.avatar,
      });

      // Nếu có thêm faceDescriptors mới
      if (editingStudent.faceDescriptors && editingStudent.faceDescriptors.length > 0) {
        await addStudentDescriptors(editingStudent.id, editingStudent.faceDescriptors);
      }

      addToast(`Đã cập nhật sinh viên ${editingStudent.name} thành công!`, 'success');
      setShowEditModal(false);
    } catch (err) {
      addToast('Lỗi cập nhật: ' + err.message, 'error');
    }
  };

  // DELETE
  const openDelete = (student) => {
    setDeletingStudent(student);
    setShowDeleteModal(true);
  };

  // Chỉ xóa dữ liệu khuôn mặt AI của sinh viên
  const handleDeleteFaceDataOnly = async () => {
    if (!deletingStudent) return;
    try {
      await deleteStudentDescriptors(deletingStudent.id);
      addToast(`🗑️ Đã xóa toàn bộ dữ liệu khuôn mặt của ${deletingStudent.name}!`, 'info');
      setShowDeleteModal(false);
      setDeletingStudent(null);
    } catch (err) {
      addToast('Lỗi xóa dữ liệu khuôn mặt: ' + err.message, 'error');
    }
  };

  // Xóa hoàn toàn sinh viên khỏi hệ thống
  const confirmDelete = async () => {
    if (!deletingStudent) return;
    try {
      await deleteStudent(deletingStudent.id);
      addToast(`Đã xóa sinh viên ${deletingStudent.name} (${deletingStudent.id})`, 'info');
      setShowDeleteModal(false);
      setDeletingStudent(null);
    } catch (err) {
      addToast('Lỗi xóa sinh viên: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hidden canvas for webcam snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <label htmlFor="student-search-input" className="sr-only">Tìm kiếm sinh viên</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="student-search-input"
              type="search"
              placeholder="Tìm theo tên, mã SV, lớp học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-slate-400 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold text-slate-600 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterStatus === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-100'}`}
            >
              Tất cả ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('registered')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterStatus === 'registered' ? 'bg-emerald-600 text-white shadow-xs' : 'hover:bg-slate-100'}`}
            >
              Đã nạp AI ({students.filter(s => s.faceStatus === 'registered').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('not_registered')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterStatus === 'not_registered' ? 'bg-slate-700 text-white shadow-xs' : 'hover:bg-slate-100'}`}
            >
              Chưa nạp ({students.filter(s => s.faceStatus === 'not_registered').length})
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Làm mới danh sách sinh viên"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            {isRefreshing ? 'Đang tải...' : 'Làm mới'}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Thêm Sinh viên mới
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Danh sách sinh viên">
            <thead>
              <tr>
                <th scope="col">Sinh viên</th>
                <th scope="col">Mã SV</th>
                <th scope="col">Lớp</th>
                <th scope="col">Dữ liệu khuôn mặt AI</th>
                <th scope="col" className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, i) => (
                <tr key={student.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                  <td>
                    <div className="flex items-center gap-3">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shadow-xs flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs">
                          {getInitials(student.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-400 font-mono sm:hidden">{student.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-sm text-slate-700 font-bold tabular-nums">{student.id}</td>
                  <td className="text-slate-600 font-semibold">{student.lop}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openFaceManage(student)}
                      title="Bấm để xem và nạp thêm mẫu khuôn mặt"
                      className="group flex items-center gap-1.5 cursor-pointer text-left"
                    >
                      <StatusBadge 
                        status={student.faceStatus} 
                        customLabel={
                          student.faceStatus === 'registered' 
                            ? `Đã đăng ký (${student.descriptorCount || 1} mẫu)` 
                            : 'Chưa có mẫu'
                        }
                      />
                      <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        + Quản lý
                      </span>
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openFaceManage(student)}
                        title="Quản lý / Nạp thêm khuôn mặt"
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none cursor-pointer"
                      >
                        <ScanFace className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(student)}
                        aria-label={`Chỉnh sửa thông tin ${student.name}`}
                        title="Chỉnh sửa thông tin"
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(student)}
                        aria-label={`Xóa sinh viên ${student.name}`}
                        title="Xóa sinh viên"
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 outline-none cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400">
                    <p className="text-base font-semibold text-slate-600">Không tìm thấy sinh viên nào phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">Hãy thử tìm kiếm với từ khóa khác hoặc thêm sinh viên mới.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD STUDENT ================= */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Thêm Sinh viên mới" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleMultipleImageFiles(e, 'add')}
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="new-student-id" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mã Sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                id="new-student-id"
                type="text"
                required
                placeholder="VD: B21DCCN019"
                value={newStudent.id}
                onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
            </div>
            <div>
              <label htmlFor="new-student-class" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lớp học <span className="text-red-500">*</span>
              </label>
              <input
                id="new-student-class"
                type="text"
                required
                placeholder="VD: D21CQCN01-B"
                value={newStudent.lop}
                onChange={(e) => setNewStudent({ ...newStudent, lop: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-student-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Họ và Tên Sinh viên <span className="text-red-500">*</span>
            </label>
            <input
              id="new-student-name"
              type="text"
              required
              placeholder="VD: Nguyễn Thị Hương"
              value={newStudent.name}
              onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
            />
          </div>

          {/* Face Enrollment Box */}
          <div className="pt-1">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Đăng ký khuôn mặt AI (Nạp nhiều mẫu)</span>
              {extractingFace && (
                <span className="text-blue-600 text-[11px] font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {extractionProgress || 'Đang trích xuất AI...'}
                </span>
              )}
            </span>

            {newStudent.faceDescriptors && newStudent.faceDescriptors.length > 0 ? (
              <div className="p-3.5 rounded-xl border bg-emerald-50/90 border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        Đã nạp {newStudent.faceDescriptors.length} mẫu khuôn mặt AI (128-d)
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Bấm ✕ trên từng ảnh để xóa ảnh lỗi, hoặc bấm "Xóa tất cả" để nạp lại
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewStudent(prev => ({ ...prev, avatar: null, faceDescriptors: [], samples: [] }))}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Xóa tất cả mẫu
                  </button>
                </div>

                {/* Thumbnails preview gallery with individual delete buttons */}
                {newStudent.samples && newStudent.samples.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-0.5">
                    {newStudent.samples.map((sample, sIdx) => (
                      <div key={sIdx} className="relative group w-14 h-14 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-xs flex-shrink-0 bg-slate-900">
                        <img src={sample.dataUrl} alt={`Mẫu ${sIdx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setNewStudent(prev => {
                              const nextSamples = (prev.samples || []).filter((_, i) => i !== sIdx);
                              const nextDescriptors = nextSamples.map(s => s.descriptor);
                              return {
                                ...prev,
                                samples: nextSamples,
                                faceDescriptors: nextDescriptors,
                                avatar: nextSamples[0]?.dataUrl || null,
                                faceStatus: nextSamples.length > 0 ? 'registered' : 'not_registered',
                              };
                            });
                          }}
                          title="Xóa mẫu ảnh này"
                          className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow hover:scale-110 hover:bg-rose-700 transition-transform cursor-pointer"
                        >
                          ✕
                        </button>
                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[9px] text-white font-mono text-center">
                          #{sIdx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-emerald-200/70">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100/60 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nạp thêm ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => startWebcam('add')}
                    className="px-3 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100/60 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> Chụp thêm Webcam
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer group"
                >
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors mb-1" />
                  <p className="text-xs font-bold text-slate-700">Tải nhiều ảnh từ máy</p>
                  <p className="text-[10px] text-slate-400">Chọn 3-5 ảnh nhiều góc khác nhau</p>
                </button>

                <button
                  type="button"
                  onClick={() => startWebcam('add')}
                  className="border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer text-slate-700 group"
                >
                  <Camera className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                  <p className="text-xs font-bold text-slate-700">Chụp qua Webcam</p>
                  <p className="text-[10px] text-slate-400">Tự động lấy 5 góc mặt</p>
                </button>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
            >
              Lưu Sinh viên
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: EDIT STUDENT ================= */}
      {editingStudent && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Chỉnh sửa: ${editingStudent.name}`} size="md">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <input
              type="file"
              ref={editFileInputRef}
              onChange={(e) => handleMultipleImageFiles(e, 'edit')}
              accept="image/*"
              multiple
              className="hidden"
            />

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Mã Sinh viên (Cố định)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.id}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="edit-student-class" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lớp học <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-student-class"
                  type="text"
                  required
                  value={editingStudent.lop}
                  onChange={(e) => setEditingStudent({ ...editingStudent, lop: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-student-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Họ và Tên Sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-student-name"
                type="text"
                required
                value={editingStudent.name}
                onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
              />
            </div>

            {/* Face Status and Quick Append */}
            <div>
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Ảnh chân dung & Dữ liệu khuôn mặt AI</span>
                {extractingFace && (
                  <span className="text-blue-600 text-[11px] font-semibold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> {extractionProgress || 'Đang trích xuất AI...'}
                  </span>
                )}
              </span>

              <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {editingStudent.avatar ? (
                      <div className="relative group">
                        <img src={editingStudent.avatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" />
                        <button
                          type="button"
                          onClick={() => setEditingStudent(prev => ({ ...prev, avatar: null }))}
                          title="Xóa ảnh đại diện này"
                          className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow hover:scale-110 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm">
                        {getInitials(editingStudent.name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={editingStudent.faceStatus} />
                        <span className="text-xs text-slate-600 font-semibold">
                          {editingStudent.faceDescriptors?.length > 0 
                            ? `(+${editingStudent.faceDescriptors.length} mẫu chuẩn bị nạp)`
                            : `(Đang có ${editingStudent.descriptorCount || 1} mẫu trong CSDL)`
                          }
                        </span>
                      </div>
                      {editingStudent.faceStatus === 'registered' && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Xóa toàn bộ dữ liệu khuôn mặt của ${editingStudent.name}?`)) {
                              await deleteStudentDescriptors(editingStudent.id);
                              setEditingStudent(prev => ({ ...prev, faceStatus: 'not_registered', descriptorCount: 0, faceDescriptors: [], samples: [] }));
                              addToast('🗑️ Đã xóa sạch dữ liệu khuôn mặt của sinh viên!', 'info');
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline mt-1 block cursor-pointer"
                        >
                          Xóa toàn bộ khuôn mặt đã lưu trong CSDL
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Newly added samples preview */}
                {editingStudent.samples && editingStudent.samples.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">Mẫu mới chuẩn bị lưu:</p>
                    <div className="flex flex-wrap gap-2">
                      {editingStudent.samples.map((sample, sIdx) => (
                        <div key={sIdx} className="relative group w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-400 shadow-xs flex-shrink-0 bg-slate-900">
                          <img src={sample.dataUrl} alt={`Mẫu mới ${sIdx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudent(prev => {
                                const nextSamples = (prev.samples || []).filter((_, i) => i !== sIdx);
                                return {
                                  ...prev,
                                  samples: nextSamples,
                                  faceDescriptors: nextSamples.map(s => s.descriptor),
                                };
                              });
                            }}
                            title="Xóa mẫu này"
                            className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow hover:scale-110 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Nạp thêm ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => startWebcam('edit')}
                    className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> Chụp Webcam
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: MANAGE FACE DATA (CHUYÊN BIỆT) ================= */}
      {managingStudent && (
        <Modal 
          isOpen={showFaceManageModal} 
          onClose={() => setShowFaceManageModal(false)} 
          title={`Quản lý khuôn mặt AI: ${managingStudent.name}`} 
          size="md"
        >
          <div className="space-y-4">
            <input
              type="file"
              ref={manageFileInputRef}
              onChange={(e) => handleMultipleImageFiles(e, 'manage')}
              accept="image/*"
              multiple
              className="hidden"
            />

            {/* Student Info Card */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              {managingStudent.avatar ? (
                <img src={managingStudent.avatar} alt={managingStudent.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {getInitials(managingStudent.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-sm truncate">{managingStudent.name}</h4>
                <p className="text-xs text-slate-500 font-mono">{managingStudent.id} • {managingStudent.lop}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {managingStudentDetails?.faceDescriptors?.length || managingStudent.descriptorCount || 0} mẫu vector 128-d đã nạp
                  </span>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Lợi ích khi nạp nhiều mẫu khuôn mặt:
              </p>
              <p className="text-blue-700">
                Khi sinh viên có từ <b>3-5 mẫu vector</b> ở các góc khác nhau (thẳng, nghiêng trái, nghiêng phải, góc ngẩng), AI sẽ nhận diện cực nhanh và không bao giờ bị nhầm lẫn với người khác!
              </p>
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => manageFileInputRef.current?.click()}
                disabled={extractingFace}
                className="p-3.5 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
              >
                <Upload className="w-6 h-6 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">Tải thêm ảnh từ máy</span>
                <span className="text-[10px] text-slate-500">Chọn 1 hoặc nhiều ảnh JPG/PNG</span>
              </button>

              <button
                type="button"
                onClick={() => startWebcam('manage')}
                className="p-3.5 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
              >
                <Camera className="w-6 h-6 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">Chụp thêm qua Webcam</span>
                <span className="text-[10px] text-slate-500">Chụp từng ảnh hoặc quét 5 góc</span>
              </button>
            </div>

            {/* Reset Face Data Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetFaceData}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả mẫu cũ & nạp lại từ đầu
              </button>

              <button
                type="button"
                onClick={() => setShowFaceManageModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deletingStudent && (
        <Modal 
          isOpen={showDeleteModal} 
          onClose={() => setShowDeleteModal(false)} 
          title="Tùy chọn Xóa / Xóa dữ liệu khuôn mặt" 
          size="md"
        >
          <div className="space-y-4">
            {/* Student Info preview */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              {deletingStudent.avatar ? (
                <img src={deletingStudent.avatar} alt={deletingStudent.name} className="w-12 h-12 rounded-full object-cover border border-slate-300 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {getInitials(deletingStudent.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-sm">{deletingStudent.name}</h4>
                <p className="text-xs text-slate-500 font-mono">{deletingStudent.id} • {deletingStudent.lop}</p>
                <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                  {deletingStudent.faceStatus === 'registered' 
                    ? `● Đang có ${deletingStudent.descriptorCount || 1} mẫu vector khuôn mặt AI` 
                    : '○ Chưa có mẫu khuôn mặt AI'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Vui lòng chọn thao tác xóa bạn muốn thực hiện:
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Chỉ xóa dữ liệu khuôn mặt */}
              {deletingStudent.faceStatus === 'registered' ? (
                <button
                  type="button"
                  onClick={handleDeleteFaceDataOnly}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-200/80 text-amber-800 mt-0.5">
                      <ScanFace className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-950">Chỉ xóa dữ liệu khuôn mặt AI</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Xóa tất cả các mẫu vector đã nạp (chuyển về Chưa đăng ký để chụp/nạp lại mẫu mới). Vẫn giữ nguyên hồ sơ sinh viên và lịch sử điểm danh.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700 whitespace-nowrap pl-2 group-hover:underline">
                    Xóa mẫu AI
                  </span>
                </button>
              ) : null}

              {/* Option 2: Xóa hoàn toàn sinh viên */}
              <button
                type="button"
                onClick={confirmDelete}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-200/80 text-rose-800 mt-0.5">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-950">Xóa hoàn toàn sinh viên khỏi hệ thống</p>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      Xóa toàn bộ hồ sơ sinh viên, dữ liệu khuôn mặt và toàn bộ lịch sử điểm danh liên quan.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-700 whitespace-nowrap pl-2 group-hover:underline">
                  Xóa sinh viên
                </span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: WEBCAM MULTI-SAMPLE CAPTURE ================= */}
      <Modal 
        isOpen={showWebcamModal} 
        onClose={stopWebcam} 
        title="Chụp nhiều mẫu khuôn mặt từ Webcam" 
        size="md"
      >
        <div className="space-y-4 text-center">
          <div className="relative bg-slate-950 aspect-video rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Overlay Guide Box */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
              <div className={`w-52 h-60 border-2 rounded-2xl flex flex-col items-center justify-between p-3 relative transition-all duration-300 ${isAutoBurstRunning ? 'border-emerald-400 bg-emerald-500/10' : 'border-dashed border-cyan-400/80'}`}>
                {isAutoBurstRunning ? (
                  <>
                    <div className="bg-slate-900/90 text-cyan-300 text-xs px-3 py-1 rounded-full font-bold border border-cyan-500/50 shadow-md">
                      {burstStepName || STEP_DETAILS[burstStep]?.title}
                    </div>

                    {burstCountdown > 0 ? (
                      <div className="w-16 h-16 rounded-full bg-slate-900/90 border-2 border-amber-400 text-amber-300 text-3xl font-black flex items-center justify-center animate-bounce shadow-lg">
                        {burstCountdown}
                      </div>
                    ) : (
                      <div className="text-emerald-400 text-xs font-mono font-bold bg-slate-900/80 px-2.5 py-1 rounded-full animate-pulse">
                        📸 Đang chụp...
                      </div>
                    )}

                    <div className="text-[10px] text-cyan-200 bg-slate-900/80 px-2.5 py-0.5 rounded-full font-medium">
                      {STEP_DETAILS[burstStep]?.hint}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-cyan-300 font-mono bg-slate-900/80 px-2 py-0.5 rounded">
                    Căn chỉnh khuôn mặt vào khung
                  </span>
                )}
              </div>
            </div>

            {/* Captured Counter Pill */}
            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-700 px-2.5 py-1 rounded-full text-xs font-mono text-emerald-400 font-bold">
              Đã chụp: {capturedSessionSamples.length} mẫu
            </div>
          </div>

          {/* 5-step Progress Bar Indicator */}
          {isAutoBurstRunning && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {[0, 1, 2, 3, 4].map(sIdx => (
                <div 
                  key={sIdx}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    burstStep === sIdx 
                      ? 'bg-amber-500 text-slate-950 scale-105 ring-2 ring-amber-300 shadow-sm' 
                      : burstStep > sIdx 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {burstStep > sIdx ? '✓' : `#${sIdx + 1}`}
                  <span className="text-[10px] hidden sm:inline">
                    {sIdx === 0 ? 'Thẳng' : sIdx === 1 ? 'Trái' : sIdx === 2 ? 'Phải' : sIdx === 3 ? 'Ngẩng' : 'Cúi'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Thumbnail list of captured samples */}
          {capturedSessionSamples.length > 0 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {capturedSessionSamples.map((s, idx) => (
                <div key={idx} className="relative group w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-400 shadow-xs flex-shrink-0 bg-slate-900">
                  <img src={s.dataUrl} alt={`Mẫu ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCapturedSessionSamples(prev => prev.filter((_, i) => i !== idx))}
                    title="Xóa mẫu ảnh này"
                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow hover:scale-110 cursor-pointer"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[9px] text-white font-mono text-center">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={captureSingleSnapshot}
              disabled={isAutoBurstRunning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-blue-600" /> Chụp thêm 1 mẫu
            </button>

            <button
              type="button"
              onClick={startAutoBurst}
              disabled={isAutoBurstRunning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {isAutoBurstRunning ? 'Đang tự động quét 5 góc...' : 'Tự động quét 5 góc mặt'}
            </button>

            <button
              type="button"
              onClick={finalizeWebcamCapture}
              disabled={capturedSessionSamples.length === 0 || isAutoBurstRunning}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" /> Hoàn tất ({capturedSessionSamples.length} mẫu)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
