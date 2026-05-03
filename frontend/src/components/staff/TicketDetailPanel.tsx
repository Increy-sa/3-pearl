import { useEffect, useMemo, useState } from 'react';
import {
  X, Clock, AlertTriangle, Shield, Lock, User, Mail, Phone,
  CreditCard, Palette, Globe, ExternalLink, CheckSquare, Square,
  FileText, Eye, EyeOff, MessageSquare, Link2, Download, XCircle,
  Timer
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
const canSeePassword = (r: string) => ['ADMIN','DEVELOPER'].includes(r);
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدير النظام',
  ACCOUNT_MANAGER: 'مدير حساب',
  DESIGNER: 'مصمم',
  DEVELOPER: 'مطوّر',
  QA: 'مراجع جودة',
};
const ASSIGNABLE_ROLES = ['ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'QA'] as const;
const INSTRUCTION_LABELS: Record<string, string> = {
  ACCOUNT_MANAGER: 'توجيهات لمدير الحساب',
  DESIGNER: 'توجيهات للمصمم',
  DEVELOPER: 'توجيهات للمطور',
  QA: 'توجيهات لمراجع الجودة',
};

// ── Consistent date+time formatter ───────────────────────────
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  let hh = dt.getHours();
  const min = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${yyyy}/${mm}/${dd} - ${String(hh).padStart(2,'0')}:${min} ${ampm}`;
}

const AUDIT_LABELS: Record<string,string> = {
  ASSIGNED_STAFF: 'تعيين موظف',
  TOGGLED_PASSWORD: 'تغيير صلاحية كلمة المرور',
  STAFF_ACCEPTED: 'قبول المهمة',
  UPDATED_NOTES: 'تحديث الملاحظات',
  STAGE_CHANGED: 'تغيير المرحلة',
};

interface Props {
  ticket: any;
  staff: any[];
  userRole: string;
  userId: string;
  headers: Record<string, string>;
  onClose: () => void;
  onRefresh: () => void;
}

export function TicketDetailPanel({ ticket, staff, userRole, userId, headers, onClose, onRefresh }: Props) {
  const [checklist, setChecklist] = useState<any[]>([]);
  const [notes, setNotes] = useState(ticket.staffNotes || '');
  const [assets, setAssets] = useState(ticket.assetsUrl || '');
  const [slaInput, setSlaInput] = useState<string>(ticket.customSlaHours?.toString() || '');
  const [roleInstructions, setRoleInstructions] = useState<Record<string, string>>({});
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [pickerId, setPickerId] = useState<string>('');

  useEffect(() => {
    try { setChecklist(JSON.parse(ticket.checklists || '[]')); } catch { setChecklist([]); }
    setNotes(ticket.staffNotes || '');
    setAssets(ticket.assetsUrl || '');
    setSlaInput(ticket.customSlaHours?.toString() || '');
    setRoleInstructions({
      ACCOUNT_MANAGER: ticket.amInstructions || '',
      DESIGNER: ticket.designerInstructions || '',
      DEVELOPER: ticket.developerInstructions || '',
      QA: ticket.qaInstructions || '',
    });
    setSelectedAssigneeIds(
      [ticket.accountManagerId, ticket.designerId, ticket.developerId, ticket.qaId].filter(Boolean)
    );
    setPickerId('');
  }, [ticket]);

  const cfg = STAGE_CONFIG[ticket.stage] || STAGE_CONFIG.INTAKE;

  const changeStage = async (stage: string) => {
    const res = await fetch(`${API}/api/tickets/${ticket.id}/stage`, {
      method: 'PUT', headers, body: JSON.stringify({ stage }),
    });
    if (res.ok) onRefresh();
    else { const err = await res.json(); alert(err.error || 'فشل'); }
  };

  const saveAssignmentBundle = async () => {
    const selectedUsers = selectedAssigneeIds
      .map((id) => staff.find((s: any) => s.id === id))
      .filter(Boolean);

    const payload: Record<string, any> = {
      accountManagerId: selectedUsers.find((u: any) => u.role === 'ACCOUNT_MANAGER')?.id || null,
      designerId: selectedUsers.find((u: any) => u.role === 'DESIGNER')?.id || null,
      developerId: selectedUsers.find((u: any) => u.role === 'DEVELOPER')?.id || null,
      qaId: selectedUsers.find((u: any) => u.role === 'QA')?.id || null,
      customSlaHours: slaInput ? parseInt(slaInput) : null,
      amInstructions: roleInstructions.ACCOUNT_MANAGER?.trim() || null,
      designerInstructions: roleInstructions.DESIGNER?.trim() || null,
      developerInstructions: roleInstructions.DEVELOPER?.trim() || null,
      qaInstructions: roleInstructions.QA?.trim() || null,
    };

    const res = await fetch(`${API}/api/staff/tickets/${ticket.id}/assign`, {
      method: 'PUT', headers, body: JSON.stringify(payload),
    });
    if (res.ok) onRefresh();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'فشل حفظ التعيين');
    }
  };

  const togglePassword = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/toggle-password`, { method: 'PUT', headers });
    onRefresh();
  };

  const acceptTask = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/accept`, { method: 'PUT', headers });
    onRefresh();
  };

  const saveNotes = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/notes`, {
      method: 'PUT', headers, body: JSON.stringify({ staffNotes: notes, assetsUrl: assets }),
    });
    onRefresh();
  };

  const toggleCheck = async (idx: number) => {
    const next = [...checklist];
    next[idx] = { ...next[idx], completed: !next[idx].completed };
    setChecklist(next);
    await fetch(`${API}/api/tickets/${ticket.id}/checklist`, {
      method: 'PUT', headers, body: JSON.stringify({ checklist: next }),
    });
    onRefresh();
  };

  const isAssignedToMe =
    ticket.accountManagerId === userId ||
    ticket.designerId === userId ||
    ticket.developerId === userId ||
    ticket.qaId === userId;
  const assignableStaff = useMemo(
    () => staff.filter((s: any) => ASSIGNABLE_ROLES.includes(s.role) && s.isActive),
    [staff]
  );
  const selectedAssignees = useMemo(
    () => selectedAssigneeIds.map((id) => assignableStaff.find((s: any) => s.id === id)).filter(Boolean),
    [assignableStaff, selectedAssigneeIds]
  );
  const selectedRoles = useMemo(
    () => Array.from(new Set(selectedAssignees.map((u: any) => u.role))),
    [selectedAssignees]
  );

  // Parse colors once
  let brandColors: string[] = [];
  try { brandColors = JSON.parse(ticket.aiProposal?.selectedColors || '[]'); } catch {}
  let referenceLogos: string[] = [];
  try { referenceLogos = JSON.parse(ticket.aiProposal?.referenceLogos || '[]'); } catch {}

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg">{ticket.client?.customerName}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">أُنشئ: {fmtDate(ticket.createdAt)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {ticket.amPasswordVisibility && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-50 border border-green-200 text-green-700">
                  <Eye className="w-3 h-3" /> مفعّلة
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* SLA */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${ticket.slaBreached ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
            {ticket.slaBreached ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" /> : <Clock className="w-5 h-5 text-slate-400 shrink-0" />}
            <div className="flex-1">
              <p className={`text-xs font-bold ${ticket.slaBreached ? 'text-red-700' : 'text-slate-600'}`}>
                {ticket.slaBreached ? '⚠️ تجاوز الـ SLA' : `متبقي: ${ticket.slaRemainingHours}h`}
                {ticket.customSlaHours && <span className="text-[10px] font-normal mr-2">(SLA مخصص: {ticket.customSlaHours}h)</span>}
              </p>
              <p className="text-[10px] text-slate-400">دخل المرحلة: {fmtDate(ticket.stageEnteredAt)}</p>
              {ticket.staffAcceptedAt && <p className="text-[10px] text-emerald-600">✓ تم القبول: {fmtDate(ticket.staffAcceptedAt)}</p>}
            </div>
          </div>

          {/* Accept Task */}
          {isAssignedToMe && !ticket.staffAcceptedAt && (
            <button onClick={acceptTask} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
              <CheckSquare className="w-4 h-4" /> قبول المهمة
            </button>
          )}

          {(() => {
            const allInstructions: Array<{ role: string; text?: string | null }> = [
              { role: 'ACCOUNT_MANAGER', text: ticket.amInstructions },
              { role: 'DESIGNER', text: ticket.designerInstructions },
              { role: 'DEVELOPER', text: ticket.developerInstructions },
              { role: 'QA', text: ticket.qaInstructions },
            ];
            const visibleInstructions = userRole === 'ADMIN'
              ? allInstructions.filter((x) => x.text)
              : allInstructions.filter((x) => x.role === userRole && x.text);
            if (visibleInstructions.length === 0) return null;
            return (
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-700">توجيهات الإدارة للمختصين</h3>
                {visibleInstructions.map((item) => (
                  <div key={item.role}>
                    <p className="text-[11px] font-bold text-indigo-700 mb-1">{INSTRUCTION_LABELS[item.role] || item.role}</p>
                    <p className="text-xs leading-relaxed text-indigo-900 whitespace-pre-wrap">{item.text}</p>
                  </div>
                ))}
              </section>
            );
          })()}

          {/* Stage Transition */}
          {canChangeStage(userRole) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">تغيير المرحلة</h3>
              <div className="flex flex-wrap gap-2">
                {STAGES_ORDER.map(s => (
                  <button key={s} onClick={() => changeStage(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${ticket.stage === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    {STAGE_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Assignment + SLA + Admin Instructions */}
          {canAssign(userRole) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">تعيين الفريق</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={pickerId}
                    onChange={(e) => setPickerId(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">اختر عضو لإضافته</option>
                    {assignableStaff
                      .filter((s: any) => !selectedAssigneeIds.includes(s.id))
                      .map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {ROLE_LABELS[s.role] || s.role}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!pickerId || selectedAssigneeIds.includes(pickerId)) return;
                      setSelectedAssigneeIds((prev) => [...prev, pickerId]);
                      setPickerId('');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  >
                    إضافة
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedAssignees.length === 0 && (
                    <span className="text-[11px] text-slate-400">لا يوجد أعضاء محددين</span>
                  )}
                  {selectedAssignees.map((user: any) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-indigo-50 border-indigo-200 text-indigo-700"
                    >
                      {user.name} - {ROLE_LABELS[user.role] || user.role}
                      <button
                        onClick={() => setSelectedAssigneeIds((prev) => prev.filter((id) => id !== user.id))}
                        className="text-indigo-500 hover:text-red-500"
                        aria-label="remove"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 w-24 shrink-0 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> SLA (ساعات)</span>
                  <input type="number" min="1" value={slaInput} onChange={e => setSlaInput(e.target.value)}
                    placeholder="مثال: 48"
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {userRole === 'ADMIN' && selectedRoles.map((role) => (
                  <div key={role}>
                    <h4 className="text-xs font-bold text-slate-500 mb-1.5">{INSTRUCTION_LABELS[role] || role}</h4>
                    <textarea
                      rows={3}
                      value={roleInstructions[role] || ''}
                      onChange={(e) => setRoleInstructions((prev) => ({ ...prev, [role]: e.target.value }))}
                      placeholder="اكتب توجيهات واضحة لهذا الدور..."
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    />
                  </div>
                ))}

                <div className="flex justify-end">
                  <button onClick={saveAssignmentBundle} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shrink-0">
                    حفظ التعيين والإعدادات
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Password Toggle */}
          {canAssign(userRole) && ticket.storeDetails && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">صلاحية كلمة المرور</h3>
              <button onClick={togglePassword}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                  ticket.amPasswordVisibility ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}>
                <span className="flex items-center gap-2">
                  {ticket.amPasswordVisibility ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {ticket.amPasswordVisibility ? 'مفعّلة للمطورين' : 'مخفية عن المطورين'}
                </span>
                <span className="text-[10px] px-2 py-1 rounded-lg bg-white/50">{ticket.amPasswordVisibility ? 'إخفاء' : 'تفعيل'}</span>
              </button>
            </section>
          )}

          {/* Store Details */}
          {ticket.storeDetails && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">بيانات المتجر</h3>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">الرابط</span>
                  {ticket.storeDetails.sallaStoreUrl
                    ? <a href={ticket.storeDetails.sallaStoreUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1 truncate">{ticket.storeDetails.sallaStoreUrl} <ExternalLink className="w-3 h-3 shrink-0" /></a>
                    : <span className="text-xs text-slate-400">—</span>}
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">كلمة المرور</span>
                  {canSeePassword(userRole) && ticket.amPasswordVisibility ? (
                    <span className="text-xs font-mono text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200 select-all">{ticket.storeDetails.storePasswordEncrypted || '—'}</span>
                  ) : (
                    <span className="text-xs text-red-500 italic flex items-center gap-1"><Shield className="w-3 h-3" /> {canSeePassword(userRole) ? 'يحتاج تفعيل من AM' : 'صلاحية مقيّدة'}</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Client Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">بيانات العميل</h3>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
              {[
                { icon: User, label: 'الاسم', value: ticket.client?.customerName },
                { icon: Mail, label: 'البريد', value: ticket.client?.email },
                { icon: Phone, label: 'الجوال', value: ticket.client?.phone },
                { icon: CreditCard, label: 'الهوية', value: ticket.client?.nationalId },
                { icon: Palette, label: 'المجال', value: ticket.client?.industry },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
                  <span className="text-xs font-semibold text-slate-800 truncate">{value || '—'}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Brand Identity — Task 3: Full display */}
          {ticket.aiProposal && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">الهوية التجارية</h3>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-[10px] text-slate-400 block">الاسم المختار</span><span className="text-sm font-black text-slate-800">{ticket.aiProposal.selectedName || '—'}</span></div>
                  <div><span className="text-[10px] text-slate-400 block">اسم النشاط</span><span className="text-sm font-bold text-slate-700">{ticket.aiProposal.businessName || '—'}</span></div>
                </div>
                {ticket.aiProposal.brandVision && (
                  <div><span className="text-[10px] text-slate-400 block mb-1">الرؤية</span><p className="text-xs text-slate-700 leading-relaxed">{ticket.aiProposal.brandVision}</p></div>
                )}
                {ticket.aiProposal.brandDescription && (
                  <div><span className="text-[10px] text-slate-400 block mb-1">الوصف</span><p className="text-xs text-slate-700 leading-relaxed">{ticket.aiProposal.brandDescription}</p></div>
                )}
                {ticket.aiProposal.brandVoice && (
                  <div><span className="text-[10px] text-slate-400 block mb-1">نبرة الصوت</span><p className="text-xs text-slate-700">{ticket.aiProposal.brandVoice}</p></div>
                )}
                {/* Colors with hex codes */}
                {brandColors.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">الألوان</span>
                    <div className="flex flex-wrap gap-2">
                      {brandColors.map((c: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                          <div className="w-5 h-5 rounded-md shadow-sm border border-black/10" style={{ backgroundColor: c }} />
                          <span className="text-[10px] font-mono text-slate-600">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Logo */}
                {ticket.aiProposal.generatedLogoUrl && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">الشعار</span>
                    <div className="flex items-center gap-3">
                      <img src={ticket.aiProposal.generatedLogoUrl} alt="logo" className="w-16 h-16 object-contain rounded-xl border bg-white p-2" />
                      <a href={ticket.aiProposal.generatedLogoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1 hover:underline"><Download className="w-3.5 h-3.5" /> عرض / تحميل</a>
                    </div>
                  </div>
                )}
                {referenceLogos.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">صور الإلهام المرفوعة</span>
                    <div className="flex flex-wrap gap-2">
                      {referenceLogos.map((url: string, i: number) => (
                        <a
                          key={`${url}-${i}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-20 h-20 rounded-xl border border-slate-200 bg-white p-1 hover:shadow-sm transition-shadow"
                        >
                          <img src={url} alt={`reference-${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Legal Doc Link — Task 3 */}
          {ticket.client?.legalDocUrl && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">المستندات القانونية</h3>
              <a href={ticket.client.legalDocUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-800">الوثيقة القانونية</p>
                  <p className="text-[10px] text-blue-600 truncate">{ticket.client.legalDocUrl}</p>
                </div>
                <Download className="w-4 h-4 text-blue-500 shrink-0" />
              </a>
            </section>
          )}

          {/* Internal Notes — Task 6: renamed */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> ملاحظات الفريق الداخلية
            </h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="أضف ملاحظاتك هنا..."
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <input value={assets} onChange={e => setAssets(e.target.value)} placeholder="رابط الملفات / التسليمات"
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button onClick={saveNotes} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">حفظ الملاحظات</button>
          </section>

          {/* Checklist */}
          {checklist.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                قائمة المهام ({checklist.filter((c: any) => c.completed).length}/{checklist.length})
              </h3>
              <div className="space-y-2">
                {checklist.map((item: any, idx: number) => (
                  <button key={idx} onClick={() => toggleCheck(idx)}
                    className="flex items-center gap-3 w-full text-right p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                    {item.completed ? <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    <span className={`text-xs font-medium ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Audit Log — Task 6: scrollable with clear times */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">سجل العمليات</h3>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-3 bg-slate-50">
              {ticket.auditLogs?.length > 0 ? ticket.auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 bg-white rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700">{AUDIT_LABELS[log.action] || log.action}</p>
                    <p className="text-[10px] text-slate-500">{log.user?.name} • {fmtDate(log.createdAt)}</p>
                    {log.details && (() => {
                      try {
                        const d = JSON.parse(log.details);
                        if (d.assignments) return <p className="text-[10px] text-slate-400 mt-0.5">{d.assignments.join(' | ')}</p>;
                        if (d.newValue !== undefined) return <p className="text-[10px] text-slate-400 mt-0.5">{d.newValue ? 'مفعّل' : 'معطّل'}</p>;
                      } catch { return null; }
                    })()}
                  </div>
                </div>
              )) : (
                <p className="text-center text-[11px] text-slate-400 py-4">لا توجد عمليات مسجلة بعد</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
