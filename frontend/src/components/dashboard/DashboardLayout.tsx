import { useEffect, useState, useRef, useCallback } from 'react';
import { Users, FileText, Settings, LogOut, LayoutDashboard, Bell, BarChart3, Menu, X, UserPlus, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../config/api';

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO',
};

interface NotifItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  isPriority: boolean;
  ticketId?: string;
  shortId?: string;
  createdAt: string;
}

export function DashboardLayout() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── Fetch unread count ──────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread-count`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch {}
  }, [token]);

  // ── Fetch notifications list ────────────────────────────────────
  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=30`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {} finally { setLoadingNotifs(false); }
  };

  // ── Mark single as read ─────────────────────────────────────────
  const markRead = async (notifId: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notifId}/read`, { method: 'PUT', headers });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  // ── Mark all as read ────────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/mark-all-read`, { method: 'PUT', headers });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  // ── Toggle panel ────────────────────────────────────────────────
  const togglePanel = () => {
    if (!showNotifPanel) fetchNotifications();
    setShowNotifPanel(!showNotifPanel);
  };

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); setShowNotifPanel(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'ADMIN';
  const isAM = user?.role === 'ACCOUNT_MANAGER';

  const navLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
      location.pathname === path
        ? 'bg-indigo-500/10 text-indigo-400'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `منذ ${diffHrs} ساعة`;
    const diffDays = Math.floor(diffHrs / 24);
    return `منذ ${diffDays} يوم`;
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 lg:p-6 border-b border-slate-800">
        <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 lg:w-6 lg:h-6 text-indigo-400 shrink-0" /> Dot Media Operation
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 lg:px-4 space-y-1 mt-4 overflow-y-auto">
        <Link to="/dashboard" className={navLinkClass('/dashboard')}>
          <FileText className="w-5 h-5 shrink-0" /> لوحة الطلبات
        </Link>
        {(isAdmin || isAM) && (
          <Link to="/dashboard/add-client" className={navLinkClass('/dashboard/add-client')}>
            <UserPlus className="w-5 h-5 shrink-0" /> ➕ إضافة عميل
          </Link>
        )}
        {(isAdmin || isAM) && (
          <Link to="/dashboard/staff" className={navLinkClass('/dashboard/staff')}>
            <Users className="w-5 h-5 shrink-0" /> إدارة فريق العمل
          </Link>
        )}

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <Link to="/dashboard/reports" className={navLinkClass('/dashboard/reports')}>
              <BarChart3 className="w-5 h-5 shrink-0" /> التقارير والإحصائيات
            </Link>
          </div>
        )}

        {/* Settings — visible to ALL staff */}
        <div className={`${!isAdmin ? 'pt-4 mt-4 border-t border-slate-800' : ''} space-y-1`}>
          <Link to="/dashboard/settings" className={navLinkClass('/dashboard/settings')}>
            <Settings className="w-5 h-5 shrink-0" /> الإعدادات
          </Link>
        </div>
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500">{ROLE_DISPLAY[user?.role || '']}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2.5 hover:text-white hover:bg-slate-800 text-slate-400 text-sm rounded-xl transition-all duration-200">
          <LogOut className="w-4 h-4 shrink-0" /> تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50" dir="rtl">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile Sidebar Overlay ──────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute top-0 right-0 h-full w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="bg-white border-b px-4 sm:px-6 lg:px-8 py-3 lg:py-4 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 truncate">إدارة خط الإنتاج</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* ── Notification Bell ──────────────────────────── */}
            <div className="relative" ref={panelRef}>
              <button
                onClick={togglePanel}
                className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* ── Notification Dropdown ────────────────────── */}
              {showNotifPanel && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden" style={{ maxHeight: '70vh' }}>
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-800">🔔 الإشعارات</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> قراءة الكل
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 50px)' }}>
                    {loadingNotifs ? (
                      <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-slate-400 mt-2">جاري التحميل...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            if (!n.isRead) markRead(n.id);
                            setShowNotifPanel(false);
                            if (n.ticketId) {
                              navigate(`/dashboard?ticket=${n.ticketId}`);
                            }
                          }}
                          className={`w-full text-right px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                            !n.isRead ? 'bg-indigo-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Unread dot */}
                            <div className="mt-1.5 shrink-0">
                              {!n.isRead ? (
                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-transparent" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className={`text-xs font-bold truncate flex-1 ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                                  {n.title}
                                </p>
                                {n.shortId && (
                                  <span className="text-[9px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0 ltr">
                                    #{n.shortId}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                              <p className="text-[9px] text-slate-400 mt-1">{fmtTime(n.createdAt)}</p>
                            </div>
                            {n.isPriority && (
                              <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">مهم</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="hidden sm:inline bg-emerald-50 text-emerald-600 font-bold px-2.5 py-1 rounded-full text-xs">{user?.role}</span>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}
