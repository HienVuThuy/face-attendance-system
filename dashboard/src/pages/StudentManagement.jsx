import { useState, useRef, useEffect, useCallback } from 'react';
import { UserPlus, Search, Edit3, Trash2, Upload, Camera, Check, X, RotateCcw, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { getInitials } from '../utils/helpers';

// Weights URL
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

export default function StudentManagement() {
  const { students, addStudent, updateStudent, deleteStudent, addStudentDescriptor, refreshAll } = useData();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | registered | not_registered
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);

  const [newStudent, setNewStudent] = useState({ id: '', name: '', lop: '', avatar: null, faceDescriptors: [] });
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // AI Models state
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [extractingFace, setExtractingFace] = useState(false);

  // Load face-api.js AI Models (TinyFaceDetector + faceLandmark68Net + faceRecognitionNet)
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

  // Trích xuất vector đặc trưng 128 chiều từ phần tử ảnh hoặc canvas
  const computeFaceDescriptor = async (imageOrCanvas) => {
    const faceapi = window.faceapi;
    if (!faceapi) return null;

    setExtractingFace(true);
    try {
      await ensureModelsLoaded();

      const detection = await faceapi
        .detectSingleFace(imageOrCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection && detection.descriptor && detection.descriptor.length === 128) {
        return Array.from(detection.descriptor);
      }
    } catch (err) {
      console.error('Lỗi trích xuất vector khuôn mặt:', err);
    } finally {
      setExtractingFace(false);
    }
    return null;
  };

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

  // Webcam capture state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCapturingFor, setIsCapturingFor] = useState('add'); // 'add' | 'edit'

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

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

  // Handle Image File Upload
  const handleImageFile = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      let descriptors = [];

      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        const desc = await computeFaceDescriptor(img);
        if (desc) {
          descriptors = [desc];
          addToast('✅ Đã trích xuất thành công Face Descriptor 128 chiều!', 'success');
        } else {
          addToast('⚠️ Đã lưu ảnh nhưng chưa trích xuất được vector AI (hãy chọn ảnh chụp thẳng mặt, rõ nét).', 'info');
        }
      } catch (err) {
        console.warn('Lỗi trích xuất vector từ ảnh upload:', err);
      }

      if (isEdit) {
        setEditingStudent(prev => ({
          ...prev,
          avatar: dataUrl,
          faceStatus: descriptors.length > 0 ? 'registered' : 'not_registered',
          faceDescriptors: descriptors,
        }));
      } else {
        setNewStudent(prev => ({
          ...prev,
          avatar: dataUrl,
          faceStatus: descriptors.length > 0 ? 'registered' : 'not_registered',
          faceDescriptors: descriptors,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Start Webcam for photo capture
  const startWebcam = async (target = 'add') => {
    setIsCapturingFor(target);
    setShowWebcamModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
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
    setShowWebcamModal(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    let descriptors = [];

    // Trích xuất vector đặc trưng 128 chiều trực tiếp từ canvas bằng faceLandmark68Net + faceRecognitionNet
    const desc = await computeFaceDescriptor(canvas);
    if (desc) {
      descriptors = [desc];
    }

    if (isCapturingFor === 'edit') {
      setEditingStudent(prev => ({
        ...prev,
        avatar: dataUrl,
        faceStatus: descriptors.length > 0 ? 'registered' : 'not_registered',
        faceDescriptors: descriptors,
      }));
    } else {
      setNewStudent(prev => ({
        ...prev,
        avatar: dataUrl,
        faceStatus: descriptors.length > 0 ? 'registered' : 'not_registered',
        faceDescriptors: descriptors,
      }));
    }

    stopWebcam();
    if (descriptors.length > 0) {
      addToast('✅ Đã chụp & trích xuất Face Descriptor 128 chiều thành công!', 'success');
    } else {
      addToast('⚠️ Đã chụp ảnh nhưng chưa trích xuất được vector AI (hãy nhìn thẳng vào camera).', 'info');
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
      addToast(`Đã thêm sinh viên ${newStudent.name} (${newStudent.id}) thành công!`, 'success');
      setNewStudent({ id: '', name: '', lop: '', avatar: null, faceDescriptors: [] });
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

      // Nếu có faceDescriptors mới được trích xuất khi chụp/tải ảnh
      if (editingStudent.faceDescriptors && editingStudent.faceDescriptors.length > 0) {
        for (const desc of editingStudent.faceDescriptors) {
          await addStudentDescriptor(editingStudent.id, desc);
        }
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
              Đã đăng ký ({students.filter(s => s.faceStatus === 'registered').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('not_registered')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filterStatus === 'not_registered' ? 'bg-slate-700 text-white shadow-xs' : 'hover:bg-slate-100'}`}
            >
              Chưa đăng ký ({students.filter(s => s.faceStatus === 'not_registered').length})
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
                <th scope="col">Dữ liệu khuôn mặt</th>
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
                    <StatusBadge status={student.faceStatus} />
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(student)}
                        aria-label={`Chỉnh sửa thông tin ${student.name}`}
                        title="Chỉnh sửa thông tin"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(student)}
                        aria-label={`Xóa sinh viên ${student.name}`}
                        title="Xóa sinh viên"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 outline-none cursor-pointer"
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
            onChange={(e) => handleImageFile(e, false)}
            accept="image/*"
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
              <span>Đăng ký khuôn mặt AI (128-d Descriptor)</span>
              {extractingFace && (
                <span className="text-blue-600 text-[11px] font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang trích xuất AI...
                </span>
              )}
            </span>
            
            {newStudent.avatar ? (
              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${newStudent.faceDescriptors?.length > 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                <img src={newStudent.avatar} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-slate-200 shadow-xs" />
                <div className="flex-1 min-w-0">
                  {newStudent.faceDescriptors?.length > 0 ? (
                    <>
                      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> Đã nạp Face Descriptor 128 chiều
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">faceLandmark68Net + faceRecognitionNet</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" /> Chưa có vector AI
                      </p>
                      <p className="text-[11px] text-amber-600">Hãy chọn ảnh chụp rõ mặt để trích xuất 128 chiều</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setNewStudent(prev => ({ ...prev, avatar: null, faceDescriptors: [], faceStatus: 'not_registered' }))}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 cursor-pointer transition-colors"
                  title="Xóa ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer group"
                >
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors mb-1" />
                  <p className="text-xs font-bold text-slate-700">Tải ảnh từ máy tính</p>
                  <p className="text-[10px] text-slate-400">Tự trích xuất 128-d AI vector</p>
                </button>

                <button
                  type="button"
                  onClick={() => startWebcam('add')}
                  className="border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer text-slate-700 group"
                >
                  <Camera className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                  <p className="text-xs font-bold text-slate-700">Chụp qua Webcam</p>
                  <p className="text-[10px] text-slate-400">Quét 68 landmarks & 128-d</p>
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
              Hủy bỏ
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
              onChange={(e) => handleImageFile(e, true)}
              accept="image/*"
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

            {/* Face Status Toggle */}
            <div>
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Dữ liệu khuôn mặt AI (128-d Descriptor)</span>
                {extractingFace && (
                  <span className="text-blue-600 text-[11px] font-semibold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang trích xuất AI...
                  </span>
                )}
              </span>

              {editingStudent.avatar ? (
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${editingStudent.faceStatus === 'registered' || editingStudent.faceDescriptors?.length > 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                  <img src={editingStudent.avatar} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-slate-200 shadow-xs" />
                  <div className="flex-1 min-w-0">
                    {editingStudent.faceStatus === 'registered' || editingStudent.faceDescriptors?.length > 0 ? (
                      <>
                        <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> Khuôn mặt đã đăng ký
                        </p>
                        <p className="text-[11px] text-emerald-600 font-medium">Đã nạp 128-d Face Descriptor</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" /> Chưa có vector AI
                        </p>
                        <p className="text-[11px] text-amber-600">Hãy cập nhật ảnh mới để trích xuất 128 chiều</p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingStudent(prev => ({ ...prev, avatar: null, faceDescriptors: [], faceStatus: 'not_registered' }))}
                    className="p-1.5 rounded-lg hover:bg-slate-200/60 text-rose-600 cursor-pointer transition-colors"
                    title="Xóa dữ liệu khuôn mặt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer group"
                  >
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors mb-1" />
                    <p className="text-xs font-bold text-slate-700">Tải ảnh mới</p>
                    <p className="text-[10px] text-slate-400">Trích xuất vector 128-d</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => startWebcam('edit')}
                    className="border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3.5 text-center transition-colors flex flex-col items-center justify-center cursor-pointer text-slate-700 group"
                  >
                    <Camera className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <p className="text-xs font-bold text-slate-700">Chụp Webcam</p>
                    <p className="text-[10px] text-slate-400">Quét landmark & vector</p>
                  </button>
                </div>
              )}
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

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deletingStudent && (
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Xác nhận xóa sinh viên" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bạn có chắc chắn muốn xóa sinh viên <b className="text-slate-900">{deletingStudent.name}</b> (Mã SV: <span className="font-mono font-bold text-blue-600">{deletingStudent.id}</span>)?
            </p>
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg font-medium">
              Hành động này sẽ xóa dữ liệu sinh viên và toàn bộ lịch sử điểm danh liên quan khỏi hệ thống.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/25 cursor-pointer"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: WEBCAM SNAPSHOT ================= */}
      <Modal isOpen={showWebcamModal} onClose={stopWebcam} title="Chụp ảnh khuôn mặt từ Webcam" size="md">
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
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-56 border-2 border-dashed border-cyan-400/80 rounded-2xl flex items-center justify-center">
                <span className="text-[10px] text-cyan-300 font-mono bg-slate-900/80 px-2 py-0.5 rounded">Căn chỉnh khuôn mặt vào khung</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={stopWebcam}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/25 cursor-pointer"
            >
              <Camera className="w-4 h-4" /> Chụp & Nạp ảnh
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
