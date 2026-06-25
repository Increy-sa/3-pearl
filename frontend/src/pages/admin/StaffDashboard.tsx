import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { TicketDetailPanel } from '../../components/staff/TicketDetailPanel';
import {
  Loader2, AlertTriangle, RefreshCw, Activity, Eye, EyeOff,
  Trash2, Archive, ArchiveRestore, Search, Clock, Sparkles, CalendarDays, X
} from 'lucide-react';

import { API_URL } from '../../config/api';

const API = API_URL;

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  INTAKE:                   { label: 'استلام الطلب',           color: 'text-sky-700',      bg: 'bg-sky-50 border-sky-200',         dot: 'bg-sky-500' },
  SEO_STORE_SETUP:          { label: 'إعدادات الـ SEO',     color: 'text-teal-700',     bg: 'bg-teal-50 border-teal-200',       dot: 'bg-teal-500' },
  DESIGN:                   { label: 'التصميم',             color: 'text-violet-700',   bg: 'bg-violet-50 border-violet-200',   dot: 'bg-violet-500' },
  DEVELOPMENT:              { label: 'التطوير',            color: 'text-blue-700',     bg: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-500' },
  SEO_FINAL:                { label: 'المراجعة النهائية',  color: 'text-emerald-700',  bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  DELIVERED:                { label: 'تم التسليم',         color: 'text-emerald-700',  bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
};
const STAGES_ORDER = ['INTAKE','SEO_STORE_SETUP','DESIGN','DEVELOPMENT','SEO_FINAL','DELIVERED'];

const canAssign      = (r: string) => ['ADMIN','ACCOUNT_MANAGER'].includes(r);
const canManage      = (r: string) => ['ADMIN','ACCOUNT_MANAGER'].includes(r);

function SlaBadge({ breached, hours }: { breached: boolean; hours: number }) {
  if (breached) return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[10px] font-bold">
      <AlertTriangle className="w-3 h-3" /> تجاوز SLA
    </span>
  );
  if (hours === Infinity) return <span className="text-[10px] text-slate-400">—</span>;
  const color = hours < 6 ? 'text-orange-600' : 'text-slate-500';
  return <span className={`text-[11px] font-mono font-bold ${color}`}>{hours}h</span>;
}

/* ── Confirmation Modal ──────────────────────────────────────── */
function ConfirmModal({ open, title, message, onConfirm, onCancel, danger }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all duration-200 active:scale-95">
            إلغاء
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}>
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffDashboard() {
  const { token, user } = useAuthStore(); 
  const [tickets, setTickets]               = useState<any[]>([]);
  const [archivedTickets, setArchivedTickets] = useState<any[]>([]);
  const [staff, setStaff]                   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [stageFilter, setStageFilter]       = useState('ALL');
  const [viewMode, setViewMode]             = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery]       = useState('');
  const [slaFilter, setSlaFilter]           = useState<'ALL' | 'BREACHED' | 'OK'>('ALL');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const selectedTicketIdRef = useRef<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; danger: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', danger: false, onConfirm: () => {} });

  // Keep ref in sync
  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id || null;
  }, [selectedTicket]);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, aRes, sRes] = await Promise.all([
        fetch(`${API}/api/staff/tickets`, { headers }),
        fetch(`${API}/api/staff/tickets?archived=true`, { headers }),
        fetch(`${API}/api/staff/members`, { headers }),
      ]);
      if (tRes.ok) {
        const allTickets = await tRes.json();
        setTickets(allTickets);
        // Sync selected ticket from ref (avoids stale closure)
        const openId = selectedTicketIdRef.current;
        if (openId) {
          const updated = allTickets.find((t: any) => t.id === openId);
          if (updated) setSelectedTicket(updated);
        }
      }
      if (aRes.ok) setArchivedTickets(await aRes.json());
      if (sRes.ok) setStaff(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePasswordInline = async (ticketId: string) => {
    await fetch(`${API}/api/staff/tickets/${ticketId}/toggle-password`, {
      method: 'PUT', headers,
    });
    fetchData();
  };

  const handleArchive = async (ticketId: string) => {
    try {
      await fetch(`${API}/api/staff/tickets/${ticketId}/archive`, {
        method: 'PUT', headers,
      });
      fetchData();
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
    } catch (e) {
      console.error('Archive failed:', e);
    }
  };

  const handleDelete = async (ticketId: string) => {
    try {
      const res = await fetch(`${API}/api/staff/tickets/${ticketId}`, {
        method: 'DELETE', headers,
      });
      if (res.ok) {
        fetchData();
        if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      } else {
        const data = await res.json();
        alert(data.error || 'فشل الحذف');
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const currentList = viewMode === 'archived' ? archivedTickets : tickets;

  const visibleTickets = useMemo(() => {
    let list = currentList;
    // Stage filter
    if (stageFilter !== 'ALL') list = list.filter(t => t.stage === stageFilter);
    // SLA filter
    if (slaFilter === 'BREACHED') list = list.filter(t => t.slaBreached);
    else if (slaFilter === 'OK') list = list.filter(t => !t.slaBreached);
    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00').getTime();
      list = list.filter(t => new Date(t.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59').getTime();
      list = list.filter(t => new Date(t.createdAt).getTime() <= to);
    }
    // Search by name, email, or phone
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => {
        const name = (t.client?.customerName || '').toLowerCase();
        const email = (t.client?.email || '').toLowerCase();
        const phone = (t.client?.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });
    }
    // Sort: newest first (from new to old)
    return [...list].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [currentList, stageFilter, slaFilter, searchQuery, dateFrom, dateTo]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const userRole = user?.role || '';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900">غرفة العمليات</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{visibleTickets.length} طلب • {user?.role}</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-95">
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      {/* View Mode Tabs (Active / Archived) */}
      {canManage(userRole) && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit">
          <button onClick={() => { setViewMode('active'); setStageFilter('ALL'); }}
            className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
              viewMode === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Activity className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">الطلبات النشطة</span>
            <span className="xs:hidden">نشطة</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{tickets.length}</span>
          </button>
          <button onClick={() => { setViewMode('archived'); setStageFilter('ALL'); }}
            className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
              viewMode === 'archived'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Archive className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">أرشيف الطلبات</span>
            <span className="xs:hidden">أرشيف</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">{archivedTickets.length}</span>
          </button>
        </div>
      )}

      {/* Stage Filter */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {['ALL', ...STAGES_ORDER].map(s => {
          const cfg = STAGE_CONFIG[s];
          const isActive = stageFilter === s;
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap border transition-all duration-200 active:scale-95 ${
                isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}>
              {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {s === 'ALL' ? 'الكل' : cfg?.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {s === 'ALL' ? currentList.length : currentList.filter(t => t.stage === s).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & SLA Filter & Date Filter */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الإيميل أو رقم الجوال..."
              className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
            />
          </div>
          {/* Date Filter Toggle */}
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 shrink-0 ${
              (dateFrom || dateTo)
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                : showDateFilter
                  ? 'bg-white border-indigo-300 text-indigo-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>فلتر التاريخ</span>
            {(dateFrom || dateTo) && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </button>
          {/* SLA Filter */}
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            {([
              { key: 'ALL', label: 'الكل' },
              { key: 'BREACHED', label: '⚠️ تجاوز SLA' },
              { key: 'OK', label: '✅ ضمن SLA' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setSlaFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                  slaFilter === f.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Filter Panel */}
        {showDateFilter && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-white border border-slate-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                dir="ltr"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                dir="ltr"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                مسح الفلتر
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {visibleTickets.length === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 p-10 sm:p-16 text-center">
          <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm sm:text-base text-slate-400 font-medium">
            {viewMode === 'archived' ? 'لا توجد طلبات مؤرشفة' : 'لا توجد طلبات في هذه المرحلة'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-right">رقم الطلب</th>
                  <th className="px-4 py-3 text-right">التاريخ والوقت</th>
                  <th className="px-4 py-3 text-right">العميل</th>
                  <th className="px-4 py-3 text-right">المجال</th>
                  <th className="px-4 py-3 text-right">المرحلة</th>
                  <th className="px-4 py-3 text-right">المسؤول</th>
                  <th className="px-4 py-3 text-right">SLA</th>
                  {canAssign(userRole) && <th className="px-4 py-3 text-right">كلمة المرور</th>}
                  <th className="px-4 py-3 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleTickets.map(ticket => {
                  const cfg = STAGE_CONFIG[ticket.stage] || STAGE_CONFIG.INTAKE;
                  const assignee = ticket.accountManager || ticket.designer || ticket.developer;
                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] text-slate-400">#{ticket.id.slice(0,8)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <div>
                            <p className="font-medium">{new Date(ticket.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            <p className="text-[10px] text-slate-400">{new Date(ticket.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{ticket.client?.customerName}</p>
                            <p className="text-[10px] text-slate-400">{ticket.client?.email}</p>
                          </div>
                          {ticket.isNewClient && ticket.stage === 'INTAKE' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-700 rounded-md text-[9px] font-bold whitespace-nowrap">
                              <Sparkles className="w-2.5 h-2.5" /> عميل جديد
                            </span>
                          )}
                          {(() => {
                            const isNewForUser = !ticket.staffAcceptedAt && (() => {
                              if (['ADMIN', 'ACCOUNT_MANAGER'].includes(user?.role || '')) return true;
                              switch (ticket.stage) {
                                case 'INTAKE': return ticket.accountManagerId === user?.id;
                                case 'SEO_STORE_SETUP': return ticket.seoSpecialistId === user?.id || ticket.assignedSeoId === user?.id;
                                case 'DESIGN': return ticket.designerId === user?.id;
                                case 'DEVELOPMENT': return ticket.developerId === user?.id;
                                case 'SEO_FINAL': return ticket.seoSpecialistId === user?.id || ticket.assignedSeoId === user?.id;
                                default: return false;
                              }
                            })();
                            if (isNewForUser) {
                              return (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 rounded-md text-[9px] font-bold whitespace-nowrap">
                                  جديد
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-slate-600">{ticket.client?.industry}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {ticket.staffAcceptedAt && (
                          <span className="block text-[9px] text-emerald-600 mt-1">✓ مقبول</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {assignee
                          ? <span className="text-xs font-medium text-slate-700">{assignee.name}</span>
                          : <span className="text-[10px] text-slate-300">غير مُعيّن</span>
                        }
                      </td>
                      <td className="px-4 py-3.5">
                        <SlaBadge breached={ticket.slaBreached} hours={ticket.slaRemainingHours} />
                      </td>
                      {canAssign(userRole) && (
                        <td className="px-4 py-3.5">
                          {ticket.storeDetails ? (
                            <button onClick={() => togglePasswordInline(ticket.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                ticket.amPasswordVisibility
                                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}>
                              {ticket.amPasswordVisibility ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              {ticket.amPasswordVisibility ? 'مفعّل' : 'مخفي'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {/* Details button — always visible */}
                          <button onClick={() => setSelectedTicket(ticket)}
                            className="text-indigo-600 font-bold text-xs px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                            التفاصيل
                          </button>

                          {/* Archive/Unarchive — ADMIN + AM only */}
                          {canManage(userRole) && (
                            <button
                              onClick={() => {
                                const isArch = ticket.isArchived;
                                setConfirmModal({
                                  open: true,
                                  title: isArch ? 'إلغاء الأرشفة' : 'أرشفة الطلب',
                                  message: isArch
                                    ? `هل تريد إعادة الطلب #${ticket.id.slice(0,8)} إلى القائمة النشطة؟`
                                    : `هل تريد أرشفة الطلب #${ticket.id.slice(0,8)}؟ سيتم نقله إلى أرشيف الطلبات.`,
                                  danger: false,
                                  onConfirm: () => { handleArchive(ticket.id); setConfirmModal(m => ({ ...m, open: false })); },
                                });
                              }}
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                                ticket.isArchived
                                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                  : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                              }`}
                              title={ticket.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
                            >
                              {ticket.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Delete — ADMIN + AM only */}
                          {canManage(userRole) && (
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  open: true,
                                  title: 'حذف الطلب نهائياً',
                                  message: `⚠️ هل أنت متأكد من حذف الطلب #${ticket.id.slice(0,8)} (${ticket.client?.customerName})؟\n\nهذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة بالطلب.`,
                                  danger: true,
                                  onConfirm: () => { handleDelete(ticket.id); setConfirmModal(m => ({ ...m, open: false })); },
                                });
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {/* Detail Panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          staff={staff}
          userRole={user?.role || ''}
          userId={user?.id || ''}
          headers={headers}
          onClose={() => setSelectedTicket(null)}
          onRefresh={fetchData}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
}
