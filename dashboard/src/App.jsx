import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';
import { DataProvider } from './context/DataContext';
import Dashboard from './pages/Dashboard';
import LiveCamera from './pages/LiveCamera';
import StudentManagement from './pages/StudentManagement';
import SessionManagement from './pages/SessionManagement';
import AttendanceLogs from './pages/AttendanceLogs';
import TimesheetReports from './pages/TimesheetReports';
import Settings from './pages/Settings';

const pages = {
  dashboard: Dashboard,
  camera: LiveCamera,
  students: StudentManagement,
  sessions: SessionManagement,
  logs: AttendanceLogs,
  timesheet: TimesheetReports,
  settings: Settings,
};

const tabOrder = ['dashboard', 'camera', 'students', 'sessions', 'logs', 'timesheet', 'settings'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Responsive Viewport Detection (Mobile / Tablet / Desktop)
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Power User Keyboard Navigation (Alex Persona)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is actively typing in an input, textarea or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Shortcut '/' to focus first search input
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // Keys 1 - 7 to quickly switch tabs
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7) {
        setActiveTab(tabOrder[num - 1]);
        if (isMobile) {
          setMobileDrawerOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  const ActivePage = pages[activeTab] || Dashboard;
  const sidebarWidth = sidebarCollapsed ? 72 : 260;

  return (
    <DataProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-100">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            isMobile={isMobile}
            mobileOpen={mobileDrawerOpen}
            onCloseMobile={() => setMobileDrawerOpen(false)}
          />
          <Header
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sidebarWidth={`${sidebarWidth}px`}
            isMobile={isMobile}
            onToggleMobileMenu={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          />

          {/* Main Content */}
          <main
            className="pt-16 min-h-screen transition-all duration-300"
            style={{ marginLeft: isMobile ? 0 : `${sidebarWidth}px` }}
          >
            <div className="p-3.5 sm:p-6 max-w-7xl mx-auto">
              <ActivePage key={activeTab} />
            </div>
          </main>
        </div>
      </ToastProvider>
    </DataProvider>
  );
}
