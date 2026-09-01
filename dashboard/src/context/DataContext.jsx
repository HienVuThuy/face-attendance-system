import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

const DataContext = createContext(null);

const API_BASE = '/api';
const POLLING_INTERVAL_MS = 3500; // Tần suất quét ngầm 3.5 giây khi tab đang mở

export function DataProvider({ children }) {
  // State from backend
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    shiftStart: '07:00',
    lateThreshold: '07:15',
    espCamIp: '192.168.100.178',
    faceThreshold: 0.4,
    language: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
  });

  const [stats, setStats] = useState({
    totalStudents: 0,
    todayCheckins: 0,
    onTimeToday: 0,
    lateToday: 0,
    absentToday: 0,
    trends: {
      totalStudents: 0,
      todayCheckins: 0,
      absentToday: 0,
      lateToday: 0,
    },
  });

  const [weeklyData, setWeeklyData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  // Sessions (Ca học / Thời khoá biểu)
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null); // Ca học đang diễn ra

  // 🚀 Real-time Auto Sync States
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(() => Date.now());
  const [newestLogId, setNewestLogId] = useState(null);
  const [syncMode, setSyncMode] = useState('connecting'); // 'sse' | 'polling' | 'offline'

  const newestTimeoutRef = useRef(null);

  // ===== FETCH METHODS (SILENT & STANDARD) =====
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, []);

  const fetchLogs = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(prev => {
          // Kiểm tra nếu có log mới nhất xuất hiện
          if (data && data.length > 0) {
            const latest = data[0];
            if (prev.length > 0 && latest.id !== prev[0]?.id) {
              setNewestLogId(latest.id);
              if (newestTimeoutRef.current) clearTimeout(newestTimeoutRef.current);
              newestTimeoutRef.current = setTimeout(() => setNewestLogId(null), 5000);
            }
          }
          return data;
        });
        setLastSyncTime(Date.now());
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [dashRes, weekRes, distRes] = await Promise.all([
        fetch(`${API_BASE}/stats/dashboard`),
        fetch(`${API_BASE}/stats/weekly`),
        fetch(`${API_BASE}/stats/distribution`),
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setStats(data);
      }
      if (weekRes.ok) {
        const data = await weekRes.json();
        setWeeklyData(data);
      }
      if (distRes.ok) {
        const data = await distRes.json();
        setPieData(data);
      }
      setBackendOnline(true);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, []);

  const fetchCurrentSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions/current`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSession(data);
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Error fetching current session:', err);
    }
  }, []);

  // Làm mới ngầm (không set loading = true, không giật màn hình)
  const triggerSilentSync = useCallback(async () => {
    try {
      await Promise.all([fetchLogs(), fetchStats(), fetchCurrentSession()]);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, [fetchLogs, fetchStats, fetchCurrentSession]);

  // Làm mới toàn diện (khởi tạo lần đầu)
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStudents(), fetchLogs(), fetchSettings(), fetchStats(), fetchSessions(), fetchCurrentSession()]);
      setBackendOnline(true);
      setLastSyncTime(Date.now());
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, [fetchStudents, fetchLogs, fetchSettings, fetchStats, fetchSessions, fetchCurrentSession]);

  // Initial Load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ═══════════════════════════════════════════════════════════════
  // 🚀 1. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM LISTENER
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;

    function connectSSE() {
      try {
        eventSource = new EventSource(`${API_BASE}/attendance/events`);

        eventSource.addEventListener('connected', () => {
          setSyncMode('sse');
          setBackendOnline(true);
        });

        // Khi có điểm danh mới
        eventSource.addEventListener('attendance_created', (e) => {
          try {
            const newLog = JSON.parse(e.data);
            if (newLog?.id) {
              setNewestLogId(newLog.id);
              if (newestTimeoutRef.current) clearTimeout(newestTimeoutRef.current);
              newestTimeoutRef.current = setTimeout(() => setNewestLogId(null), 5000);
            }
          } catch (parseErr) {
            console.error('Error parsing SSE attendance_created:', parseErr);
          }
          triggerSilentSync();
        });

        // Khi cập nhật trạng thái điểm danh
        eventSource.addEventListener('attendance_updated', () => {
          triggerSilentSync();
        });

        // Khi xóa bản ghi điểm danh
        eventSource.addEventListener('attendance_deleted', () => {
          triggerSilentSync();
        });

        // Khi xóa tất cả lịch sử
        eventSource.addEventListener('attendance_cleared', () => {
          setLogs([]);
          triggerSilentSync();
        });

        // Khi sinh viên thay đổi
        eventSource.addEventListener('students_updated', () => {
          fetchStudents();
          fetchStats();
        });

        eventSource.onerror = () => {
          setSyncMode('polling');
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Thử kết nối lại sau 6 giây
          reconnectTimeout = setTimeout(connectSSE, 6000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setSyncMode('polling');
      }
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (newestTimeoutRef.current) clearTimeout(newestTimeoutRef.current);
    };
  }, [triggerSilentSync, fetchStudents, fetchStats]);

  // ═══════════════════════════════════════════════════════════════
  // 🚀 2. SMART BACKGROUND POLLING & VISIBILITY / FOCUS LISTENER
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    // Polling định kỳ khi tab đang mở
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerSilentSync();
      }
    }, POLLING_INTERVAL_MS);

    // Kích hoạt đồng bộ ngay lập tức khi người dùng quay lại tab hoặc focus cửa sổ
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSilentSync();
      }
    };

    const handleFocus = () => {
      triggerSilentSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAutoSyncEnabled, triggerSilentSync]);

  // ===== STUDENT ACTIONS =====
  const addStudent = useCallback(async (newStudent) => {
    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      });
      if (!res.ok) {
        let errMsg = 'Lỗi thêm sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('addStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchStats]);

  const updateStudent = useCallback(async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        let errMsg = 'Lỗi cập nhật sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('updateStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchLogs, fetchStats]);

  const deleteStudent = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        let errMsg = 'Lỗi xóa sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('deleteStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchLogs, fetchStats]);

  const addStudentDescriptor = useCallback(async (id, descriptor) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: Array.from(descriptor) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu vector khuôn mặt');
      }
      await fetchStudents();
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchStudents]);

  const addStudentDescriptors = useCallback(async (id, descriptors) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptors: descriptors.map(d => Array.from(d)) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu các vector khuôn mặt');
      }
      const data = await res.json();
      await fetchStudents();
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchStudents]);

  const deleteStudentDescriptors = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}/descriptors`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa vector khuôn mặt');
      }
      await fetchStudents();
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchStudents]);

  // ===== ATTENDANCE LOG ACTIONS =====
  const addAttendanceLog = useCallback(async (logData) => {
    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi ghi nhận điểm danh');
      }
      const data = await res.json();
      await Promise.all([fetchLogs(), fetchStats()]);
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const updateAttendanceLog = useCallback(async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE}/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi cập nhật lịch sử');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const deleteAttendanceLog = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/attendance/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa bản ghi');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const clearAttendanceLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa tất cả');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  // ===== SETTINGS ACTIONS =====
  const updateSettings = useCallback(async (newSettings) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu cấu hình');
      }
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchSettings]);

  const resetSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/reset`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi đặt lại cài đặt');
      }
      const data = await res.json();
      setSettings(data.settings);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  // ===== SESSION ACTIONS =====
  const addSession = useCallback(async (sessionData) => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi tạo ca học');
      }
      await Promise.all([fetchSessions(), fetchCurrentSession()]);
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [fetchSessions, fetchCurrentSession]);

  const updateSession = useCallback(async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi cập nhật ca học');
      }
      await Promise.all([fetchSessions(), fetchCurrentSession()]);
      return true;
    } catch (err) {
      throw err;
    }
  }, [fetchSessions, fetchCurrentSession]);

  const deleteSession = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa ca học');
      }
      await Promise.all([fetchSessions(), fetchCurrentSession()]);
      return true;
    } catch (err) {
      throw err;
    }
  }, [fetchSessions, fetchCurrentSession]);

  // ===== DEVICE ACTIONS =====
  const checkDeviceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/device/status`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  }, []);

  // ===== TIMESHEET REPORT METHOD =====
  const getTimesheet = useCallback(async (month, year) => {
    try {
      const res = await fetch(`${API_BASE}/stats/timesheet?month=${month}&year=${year}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error('Error fetching timesheet:', err);
      return [];
    }
  }, []);

  // Computed today's logs from logs list
  const todayLogs = useMemo(() => {
    const todayStr = new Date().toDateString();
    return logs.filter(l => new Date(l.timestamp).toDateString() === todayStr);
  }, [logs]);

  const value = {
    students,
    logs,
    settings,
    stats,
    todayLogs,
    weeklyData,
    pieData,
    loading,
    backendOnline,
    isAutoSyncEnabled,
    setIsAutoSyncEnabled,
    lastSyncTime,
    newestLogId,
    syncMode,
    sessions,
    currentSession,
    triggerSilentSync,
    refreshAll,
    fetchStudents,
    fetchLogs,
    fetchStats,
    fetchSessions,
    fetchCurrentSession,
    addStudent,
    updateStudent,
    deleteStudent,
    addStudentDescriptor,
    addStudentDescriptors,
    deleteStudentDescriptors,
    addAttendanceLog,
    updateAttendanceLog,
    deleteAttendanceLog,
    clearAttendanceLogs,
    updateSettings,
    resetSettings,
    addSession,
    updateSession,
    deleteSession,
    checkDeviceStatus,
    getTimesheet,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

