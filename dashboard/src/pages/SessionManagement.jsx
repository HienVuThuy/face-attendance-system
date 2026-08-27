import { useState, useMemo } from 'react';
import { CalendarDays, PlusCircle, Edit3, Trash2, BookOpen, Clock, MapPin, Search, Filter, AlertTriangle, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';

const DAY_OPTIONS = [
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
  { value: 7, label: 'Chủ nhật', short: 'CN' },
];

const EMPTY_SESSION = {
  name: 'Ca Sáng',
  subject: '',
  room: '',
  day_of_week: 1,
  start_time: '07:00',
  end_time: '09:30',
  late_after: '07:15',
  is_active: 1,
};

export default function SessionManagement() {
  const { sessions, currentSession, addSession, updateSession, deleteSession, fetchSessions, fetchCurrentSession } = useData();
  const { addToast } = useToast();

  const [selectedDayFilter, setSelectedDayFilter] = useState('all'); // 'all' | 1..7
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null = add, object = edit
  const [form, setForm] = useState({ ...EMPTY_SESSION });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mở modal thêm ca: tự động tìm ngày & khung giờ trống làm mặc định
  const openAdd = (presetDay = null) => {
    setEditing(null);

    let targetDay = presetDay !== null && presetDay !== 'all' ? Number(presetDay) : null;
    if (!targetDay) {
      const dayCounts = [1, 2, 3, 4, 5, 6, 7].map(day => ({
        day,
        count: sessions.filter(s => s.day_of_week === day).length,
      })).sort((a, b) => a.count - b.count);
      targetDay = dayCounts[0]?.day || 6;
    }

    const existingOnDay = sessions.filter(s => s.day_of_week === targetDay);

    let defaultStart = '07:00';
    let defaultEnd = '09:30';
    let defaultLate = '07:15';
    let defaultName = 'Ca Sáng';

    if (existingOnDay.some(s => s.start_time <= '09:30' && s.end_time >= '07:00')) {
      if (!existingOnDay.some(s => s.start_time <= '15:30' && s.end_time >= '13:00')) {
        defaultStart = '13:00';
        defaultEnd = '15:30';
        defaultLate = '13:15';
        defaultName = 'Ca Chiều';
      } else {
        defaultStart = '18:00';
        defaultEnd = '20:30';
        defaultLate = '18:15';
        defaultName = 'Ca Tối';
      }
    }

    setForm({
      name: defaultName,
      subject: '',
      room: '',
      day_of_week: targetDay,
      start_time: defaultStart,
      end_time: defaultEnd,
      late_after: defaultLate,
      is_active: 1,
    });
    setShowModal(true);
  };

  const openEdit = (sess) => {
    setEditing(sess);
    setForm({
      name: sess.name,
      subject: sess.subject,
      room: sess.room || '',
      day_of_week: sess.day_of_week,
      start_time: sess.start_time,
      end_time: sess.end_time,
      late_after: sess.late_after || '',
      is_active: sess.is_active,
    });
    setShowModal(true);
  };

  // Kiểm tra trùng giờ trực tiếp trên form thời gian thực
  const conflictingSession = useMemo(() => {
    if (!form.start_time || !form.end_time || !form.day_of_week) return null;
    return sessions.find(s => {
      if (editing && s.id === editing.id) return false;
      if (s.day_of_week !== Number(form.day_of_week)) return false;
      if (!s.is_active) return false;
      return form.start_time < s.end_time && form.end_time > s.start_time;
    });
  }, [sessions, form.start_time, form.end_time, form.day_of_week, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (conflictingSession) {
      addToast(`Không thể lưu: Bị trùng giờ với "${conflictingSession.name} - ${conflictingSession.subject}" (${conflictingSession.start_time}–${conflictingSession.end_time})`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateSession(editing.id, form);
        addToast('✅ Đã cập nhật ca học thành công', 'success');
      } else {
        await addSession(form);
        addToast('✅ Đã tạo ca học mới thành công', 'success');
      }
      setShowModal(false);
    } catch (err) {
      addToast(err.message || 'Lỗi xử lý ca học', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSession(id);
      addToast('Đã xóa ca học thành công', 'info');
    } catch (err) {
      addToast('Lỗi xóa: ' + err.message, 'error');
    }
    setDeleteConfirm(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchSessions(), fetchCurrentSession()]);
      addToast('Đã làm mới dữ liệu ca học', 'success');
    } catch {
      addToast('Lỗi khi làm mới dữ liệu', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Filter & Search logic
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (selectedDayFilter !== 'all' && s.day_of_week !== Number(selectedDayFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = s.subject?.toLowerCase().includes(q);
        const matchName = s.name?.toLowerCase().includes(q);
        const matchRoom = s.room?.toLowerCase().includes(q);
        return matchSubject || matchName || matchRoom;
      }
      return true;
    });
  }, [sessions, selectedDayFilter, searchQuery]);

  // Nhóm theo thứ
  const groupedDays = useMemo(() => {
    return DAY_OPTIONS.map(day => {
      const daySessions = filteredSessions
        .filter(s => s.day_of_week === day.value)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      return {
        ...day,
        sessions: daySessions,
      };
    }).filter(g => selectedDayFilter === 'all' ? g.sessions.length > 0 : g.value === Number(selectedDayFilter));
  }, [filteredSessions, selectedDayFilter]);

  // Stats
  const morningCount = sessions.filter(s => s.name.includes('Sáng')).length;
  const afternoonCount = sessions.filter(s => s.name.includes('Chiều')).length;
  const eveningCount = sessions.filter(s => s.name.includes('Tối')).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Active Session Hero Banner ── */}
      {currentSession && currentSession.active && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between flex-wrap gap-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Ca học đang diễn ra</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                {currentSession.session.name}: {currentSession.session.subject}
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5 flex items-center gap-3">
                <span>📅 {currentSession.currentDayName}</span>
                <span>⏰ {currentSession.session.start_time} – {currentSession.session.end_time}</span>
                <span>📍 Phòng {currentSession.session.room || 'Chưa định'}</span>
                <span>⏳ Trễ sau {currentSession.session.late_after || 'auto'}</span>
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-black shadow-xs">
            HỆ THỐNG ĐANG KHỚP CA NÀY
          </span>
        </div>
      )}

      {/* ── Top Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Tổng số ca học</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><CalendarDays className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{sessions.length}</p>
          <span className="text-[11px] text-slate-400">Thời khóa biểu tuần</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Ca Sáng</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Clock className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{morningCount}</p>
          <span className="text-[11px] text-slate-400">Khung giờ 07:00 – 11:30</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Ca Chiều</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><Clock className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{afternoonCount}</p>
          <span className="text-[11px] text-slate-400">Khung giờ 13:00 – 17:30</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Ca Tối</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><Clock className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{eveningCount}</p>
          <span className="text-[11px] text-slate-400">Khung giờ 18:00 – 21:00</span>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Day Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedDayFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Tất cả các thứ ({sessions.length})
          </button>
          {DAY_OPTIONS.map(d => {
            const count = sessions.filter(s => s.day_of_week === d.value).length;
            const isSelected = selectedDayFilter === String(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setSelectedDayFilter(String(d.value))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <span>{d.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    isSelected ? 'bg-white/30 text-white' : 'bg-slate-300/80 text-slate-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm môn học, phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Làm mới ca học"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => openAdd(selectedDayFilter)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20 cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" /> Thêm ca học
          </button>
        </div>
      </div>

      {/* ── Main Schedule Content ── */}
      {groupedDays.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/80">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">Chưa có ca học nào được tìm thấy</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `Không có ca học nào khớp với từ khóa "${searchQuery}". Hãy thử tìm từ khác.`
              : 'Hãy bấm "Thêm ca học" để tạo thời khóa biểu điểm danh cho ngày này.'}
          </p>
          <button
            type="button"
            onClick={() => openAdd(selectedDayFilter)}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Thêm ca mới ngay
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDays.map(group => (
            <div key={group.value} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              {/* Day Header */}
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {group.short}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{group.label}</h3>
                    <p className="text-[11px] text-slate-400">{group.sessions.length} ca học trong ngày</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openAdd(group.value)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Thêm ca vào {group.label}
                </button>
              </div>

              {/* Sessions Table / Cards */}
              <div className="divide-y divide-slate-100">
                {group.sessions.map(sess => {
                  const isCurrent = currentSession && currentSession.active && currentSession.session.id === sess.id;
                  return (
                    <div
                      key={sess.id}
                      className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition-colors ${
                        isCurrent
                          ? 'bg-emerald-50/80 ring-1 ring-emerald-400 ring-inset'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Time box */}
                        <div className="w-24 px-2.5 py-2 rounded-xl bg-slate-100 text-center flex-shrink-0 border border-slate-200/60 font-mono">
                          <p className="text-xs font-black text-slate-800">{sess.start_time}</p>
                          <p className="text-[10px] text-slate-400 leading-none my-0.5">đến</p>
                          <p className="text-xs font-black text-slate-800">{sess.end_time}</p>
                        </div>

                        {/* Subject & details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{sess.subject}</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                              {sess.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white animate-pulse">
                                ĐANG DIỄN RA
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Phòng {sess.room || '—'}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> Ngưỡng trễ: {sess.late_after || `${sess.start_time} + 15m`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(sess)}
                          title="Chỉnh sửa ca học"
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(sess)}
                          title="Xóa ca học"
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT SESSION ================= */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Sửa Ca học' : 'Thêm Ca học mới'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tên ca</label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold bg-white cursor-pointer"
              >
                <option value="Ca Sáng">Ca Sáng</option>
                <option value="Ca Chiều">Ca Chiều</option>
                <option value="Ca Tối">Ca Tối</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Thứ trong tuần <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold bg-white cursor-pointer"
              >
                {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tên môn học <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="VD: Lập trình di động"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phòng học</label>
            <input
              type="text"
              placeholder="VD: A2-301"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bắt đầu <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Kết thúc <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ngưỡng trễ</label>
              <input
                type="time"
                value={form.late_after}
                onChange={(e) => setForm({ ...form, late_after: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Trống = auto (+15 phút)</p>
            </div>
          </div>

          {/* Cảnh báo trùng giờ trực tiếp thời gian thực */}
          {conflictingSession && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Trùng giờ với ca học đã có!</p>
                <p className="text-amber-700 mt-0.5 leading-relaxed">
                  Khoảng giờ này đang trùng với <strong>"{conflictingSession.name} — {conflictingSession.subject}"</strong> ({conflictingSession.start_time}–{conflictingSession.end_time}) vào <strong>{DAY_OPTIONS.find(d => d.value === form.day_of_week)?.label}</strong>. Vui lòng đổi khoảng giờ hoặc chọn thứ khác.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !!conflictingSession}
              title={conflictingSession ? 'Không thể lưu vì bị trùng giờ học' : ''}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {submitting ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo ca học'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: DELETE CONFIRM ================= */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Xác nhận xóa ca học" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bạn chắc chắn muốn xóa ca <strong>"{deleteConfirm.name} — {deleteConfirm.subject}"</strong> vào <strong>{DAY_OPTIONS.find(d => d.value === deleteConfirm.day_of_week)?.label}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer"
              >
                Xóa ca học
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
