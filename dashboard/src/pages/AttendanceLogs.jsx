import { useState, useMemo } from 'react';
import { Download, Search, Filter, CalendarDays, PlusCircle, Edit3, Trash2, RotateCcw } from 'lucide-react';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { formatDate, formatTime, getInitials } from '../utils/helpers';

export default function AttendanceLogs() {
  const { logs, students, addAttendanceLog, updateAttendanceLog, deleteAttendanceLog, clearAttendanceLogs, fetchLogs } = useData();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc | asc

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchLogs();
      addToast('✅ Đã làm mới dữ liệu lịch sử điểm danh!', 'success');
    } catch {
      addToast('Không thể làm mới lịch sử từ máy chủ', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Form states
  const [newLog, setNewLog] = useState({
    studentId: '',
    status: 'on-time',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
  });

  const [editingLog, setEditingLog] = useState(null);

  // Sorted & Filtered logs
  const filtered = useMemo(() => {
    return logs
      .filter(log => {
        // Search filter
        const keyword = search.toLowerCase();
        const matchesSearch = !keyword ||
          (log.name && log.name.toLowerCase().includes(keyword)) ||
          (log.studentId && log.studentId.toLowerCase().includes(keyword)) ||
          (log.lop && log.lop.toLowerCase().includes(keyword));

        // Status filter
        const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

        // Date filter
        let matchesDate = true;
        if (dateFrom) {
          matchesDate = matchesDate && new Date(log.timestamp) >= new Date(dateFrom);
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && new Date(log.timestamp) <= to;
        }

        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        return sortOrder === 'desc'
          ? b.timestamp - a.timestamp
          : a.timestamp - b.timestamp;
      });
  }, [logs, search, statusFilter, dateFrom, dateTo, sortOrder]);

  // Handle Manual Log Creation
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newLog.studentId) {
      addToast('Vui lòng chọn sinh viên điểm danh!', 'error');
      return;
    }

    const targetStudent = students.find(s => s.id === newLog.studentId);
    if (!targetStudent) {
      addToast('Sinh viên không tồn tại!', 'error');
      return;
    }

    const [year, month, day] = newLog.date.split('-').map(Number);
    const [hours, minutes] = newLog.time.split(':').map(Number);
    const timestamp = new Date(year, month - 1, day, hours, minutes, 0).getTime();

    try {
      await addAttendanceLog({
        studentId: targetStudent.id,
        status: newLog.status,
        timestamp,
        allowDuplicate: true,
      });

      setShowAddModal(false);
      addToast(`Đã ghi nhận điểm danh thủ công cho ${targetStudent.name}`, 'success');
    } catch (err) {
      addToast('Lỗi ghi nhận: ' + err.message, 'error');
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingLog) return;

    try {
      await updateAttendanceLog(editingLog.id, {
        status: editingLog.status,
        timestamp: editingLog.timestamp,
      });

      setShowEditModal(false);
      addToast(`Đã cập nhật trạng thái điểm danh cho ${editingLog.name}`, 'success');
    } catch (err) {
      addToast('Lỗi cập nhật: ' + err.message, 'error');
    }
  };

  // Handle Delete
  const handleDeleteLog = async (id, name) => {
    try {
      await deleteAttendanceLog(id);
      addToast(`Đã xóa bản ghi điểm danh của ${name}`, 'info');
    } catch (err) {
      addToast('Lỗi xóa: ' + err.message, 'error');
    }
  };

  // Handle Export CSV
  const handleExport = () => {
    if (filtered.length === 0) {
      addToast('Không có dữ liệu để xuất', 'error');
      return;
    }
    let csv = "data:text/csv;charset=utf-8,\uFEFFThời gian,Ngày,Mã SV,Họ Tên,Lớp,Trạng thái\n";
    filtered.forEach(row => {
      csv += `"${formatTime(row.timestamp)}","${formatDate(row.timestamp)}","${row.studentId}","${row.name || ''}","${row.lop || ''}","${row.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn'}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Lich_Su_Diem_Danh_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    addToast(`Đã xuất ${filtered.length} bản ghi ra file CSV!`, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="w-4 h-4 text-blue-600" /> Bộ lọc & Tìm kiếm dữ liệu
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Ghi nhận thủ công
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" /> Xuất file CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search */}
          <div className="relative">
            <label htmlFor="log-search-input" className="sr-only">Tìm theo tên hoặc Mã SV</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="log-search-input"
              type="search"
              placeholder="Tên, mã SV, lớp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-slate-400"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <label htmlFor="log-status-select" className="sr-only">Lọc theo trạng thái</label>
            <select
              id="log-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 font-semibold appearance-none bg-white cursor-pointer pr-8"
            >
              <option value="all">Tất cả trạng thái ({logs.length})</option>
              <option value="on-time">Đúng giờ ({logs.filter(l => l.status === 'on-time').length})</option>
              <option value="late">Đi muộn ({logs.filter(l => l.status === 'late').length})</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Date From */}
          <div className="relative">
            <label htmlFor="log-date-from" className="sr-only">Từ ngày</label>
            <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="log-date-from"
              type="date"
              aria-label="Từ ngày"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 font-medium"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <label htmlFor="log-date-to" className="sr-only">Đến ngày</label>
            <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="log-date-to"
              type="date"
              aria-label="Đến ngày"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-500 font-medium">
          Hiển thị <span className="font-bold text-slate-800 tabular-nums">{filtered.length}</span> / <span className="tabular-nums">{logs.length}</span> lượt điểm danh
        </p>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 cursor-pointer"
            >
              Xóa tất cả
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Làm mới lịch sử"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Bảng lịch sử điểm danh">
            <thead>
              <tr>
                <th scope="col">Sinh viên</th>
                <th scope="col">Mã SV</th>
                <th scope="col">Lớp</th>
                <th scope="col">Ngày điểm danh</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={log.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs">
                        {getInitials(log.name)}
                      </div>
                      <span className="font-bold text-slate-800">{log.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-sm text-slate-700 font-bold tabular-nums">{log.studentId}</td>
                  <td className="text-slate-600 font-medium">{log.lop}</td>
                  <td className="text-slate-600 font-medium tabular-nums">{formatDate(log.timestamp)}</td>
                  <td className="text-slate-700 font-mono font-bold tabular-nums">{formatTime(log.timestamp)}</td>
                  <td><StatusBadge status={log.status} /></td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditingLog({ ...log }); setShowEditModal(true); }}
                        aria-label={`Sửa trạng thái của ${log.name}`}
                        title="Sửa trạng thái"
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-blue-100/80 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id, log.name)}
                        aria-label={`Xóa bản ghi của ${log.name}`}
                        title="Xóa bản ghi"
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-rose-100/80 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <p className="text-base font-semibold text-slate-600">Không có bản ghi điểm danh nào</p>
                    <p className="text-xs text-slate-400 mt-1">Bấm "Ghi nhận thủ công" hoặc đợi camera quét điểm danh.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD MANUAL ATTENDANCE ================= */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Ghi nhận Điểm danh Thủ công" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label htmlFor="manual-student-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Chọn Sinh viên <span className="text-red-500">*</span>
            </label>
            <select
              id="manual-student-select"
              required
              value={newLog.studentId}
              onChange={(e) => setNewLog({ ...newLog, studentId: e.target.value })}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold bg-white cursor-pointer"
            >
              <option value="">-- Chọn sinh viên từ danh sách ({students.length}) --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id}) - {s.lop}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="manual-log-date" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ngày điểm danh <span className="text-red-500">*</span>
              </label>
              <input
                id="manual-log-date"
                type="date"
                required
                value={newLog.date}
                onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
              />
            </div>
            <div>
              <label htmlFor="manual-log-time" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Giờ check-in <span className="text-red-500">*</span>
              </label>
              <input
                id="manual-log-time"
                type="time"
                required
                value={newLog.time}
                onChange={(e) => setNewLog({ ...newLog, time: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Trạng thái điểm danh
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${newLog.status === 'on-time' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'border-slate-200 text-slate-600'}`}>
                <input
                  type="radio"
                  name="manualStatus"
                  checked={newLog.status === 'on-time'}
                  onChange={() => setNewLog({ ...newLog, status: 'on-time' })}
                  className="text-emerald-600"
                />
                <span className="text-sm">Đúng giờ</span>
              </label>

              <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${newLog.status === 'late' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-slate-200 text-slate-600'}`}>
                <input
                  type="radio"
                  name="manualStatus"
                  checked={newLog.status === 'late'}
                  onChange={() => setNewLog({ ...newLog, status: 'late' })}
                  className="text-amber-600"
                />
                <span className="text-sm">Đi muộn</span>
              </label>
            </div>
          </div>

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
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              Lưu Điểm danh
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: EDIT LOG ================= */}
      {editingLog && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Chỉnh sửa: ${editingLog.name}`} size="sm">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 font-mono">Mã SV: <b className="text-slate-800">{editingLog.studentId}</b> • Lớp: <b className="text-slate-800">{editingLog.lop}</b></p>
              <p className="text-xs text-slate-500 mt-1">Thời gian: <span className="font-mono font-bold text-slate-700">{formatDate(editingLog.timestamp)} {formatTime(editingLog.timestamp)}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Trạng thái ghi nhận
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditingLog({ ...editingLog, status: 'on-time' })}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${editingLog.status === 'on-time' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  Đúng giờ
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLog({ ...editingLog, status: 'late' })}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${editingLog.status === 'late' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  Đi muộn
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/25 cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: CLEAR ALL CONFIRMATION ================= */}
      <Modal isOpen={showClearModal} onClose={() => setShowClearModal(false)} title="Xóa toàn bộ lịch sử điểm danh" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Bạn có chắc chắn muốn xóa toàn bộ <b className="text-slate-900">{logs.length}</b> bản ghi lịch sử điểm danh?
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowClearModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await clearAttendanceLogs();
                  setShowClearModal(false);
                  addToast('Đã xóa sạch lịch sử điểm danh', 'info');
                } catch (err) {
                  addToast('Lỗi xóa lịch sử: ' + err.message, 'error');
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/25 cursor-pointer"
            >
              Xác nhận xóa hết
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
