import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { TicketDetailPanel } from '../../components/staff/TicketDetailPanel';
import {
  Loader2, AlertTriangle, RefreshCw, Activity, Eye, EyeOff,
  ChevronDown, Shield
} from 'lucide-react';

const API = 'http://localhost:5000';

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  INTAKE:           { label: 'استلام الطلب',       color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200',       dot: 'bg-sky-500' },
  LEGAL_PROCESSING: { label: 'المعالجة القانونية', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500' },
  DESIGN:           { label: 'التصميم',            color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
  DEVELOPMENT:      { label: 'التطوير',            color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  REVIEW:           { label: 'المراجعة',           color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  DELIVERED:        { label: 'تم التسليم',         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
};
const STAGES_ORDER = ['INTAKE','LEGAL_PROCESSING','DESIGN','DEVELOPMENT','REVIEW','DELIVERED'];

const canChangeStage = (r: string) => ['ADMIN','ACCOUNT_MANAGER'].includes(r);
const canAssign      = (r: string) => ['ADMIN','ACCOUNT_MANAGER'].includes(r);

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

export function StaffDashboard() {
  const { token, user } = useAuthStore(); 
  const [tickets, setTickets]               = useState<any[]>([]);
  const [staff, setStaff]                   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [stageFilter, setStageFilter]       = useState('ALL');
  const selectedTicketIdRef = useRef<string | null>(null);

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
      const [tRes, sRes] = await Promise.all([
        fetch(`${API}/api/staff/tickets`, { headers }),
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

  const visibleTickets = useMemo(() => {
    if (stageFilter === 'ALL') return tickets;
    return tickets.filter(t => t.stage === stageFilter);
  }, [tickets, stageFilter]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">غرفة العمليات</h1>
          <p className="text-sm text-slate-500 mt-0.5">{visibleTickets.length} طلب • {user?.role}</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['ALL', ...STAGES_ORDER].map(s => {
          const cfg = STAGE_CONFIG[s];
          const isActive = stageFilter === s;
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}>
              {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {s === 'ALL' ? 'الكل' : cfg?.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {s === 'ALL' ? tickets.length : tickets.filter(t => t.stage === s).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {visibleTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">لا توجد طلبات في هذه المرحلة</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-right">رقم الطلب</th>
                  <th className="px-4 py-3 text-right">العميل</th>
                  <th className="px-4 py-3 text-right">المجال</th>
                  <th className="px-4 py-3 text-right">المرحلة</th>
                  <th className="px-4 py-3 text-right">المسؤول</th>
                  <th className="px-4 py-3 text-right">SLA</th>
                  {canAssign(user?.role || '') && <th className="px-4 py-3 text-right">كلمة المرور</th>}
                  <th className="px-4 py-3 text-right"></th>
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
                        <p className="font-bold text-slate-800 text-sm">{ticket.client?.customerName}</p>
                        <p className="text-[10px] text-slate-400">{ticket.client?.email}</p>
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
                      {canAssign(user?.role || '') && (
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
                        <button onClick={() => setSelectedTicket(ticket)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 font-bold text-xs px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100">
                          التفاصيل
                        </button>
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
    </div>
  );
}
