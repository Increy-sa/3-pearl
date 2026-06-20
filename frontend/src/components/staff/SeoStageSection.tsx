import { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { SeoProposalsSection } from './SeoProposalsSection';
import { SeoChecklistPanel } from './SeoChecklistPanel';
import { CheckCircle2, ArrowRight, Clock, Users, FileText, Send } from 'lucide-react';
import { useToast } from '../ui/Toast';
const API = API_URL;
const ROLE_LABELS: Record<string, string> = { ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO' };

const SUB_STEPS = [
  { id: 'PROPOSALS', label: 'مقترحات الاسم والدومين', icon: '📋' },
  { id: 'STORE_SETUP', label: 'إعداد المتجر', icon: '🏪' },
  { id: 'READY_TO_TRANSFER', label: 'تسليم للمصمم', icon: '🎨' },
];

// 5 simplified store-setup tasks
const SETUP_TASKS = [
  { key: 'sallaAccountCreated', label: 'إنشاء المتجر على منصة سلة', hasCredentials: true },
  { key: 'storeVerified', label: 'إعداد البيانات الأساسية للمتجر' },
  { key: 'domainLinked', label: 'توثيق المتجر' },
  { key: 'domainPurchased', label: 'ربط الدومين بعد شراء العميل له' },
  { key: 'productsUploaded', label: 'إضافة المنتجات إلى المتجر' },
];

interface Props {
  ticket: any;
  headers: Record<string, string>;
  staff: any[];
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function SeoStageSection({ ticket, headers, staff, userRole, onRefresh, setErrorModal }: Props) {
  const subStep = ticket.seoSubStep || 'PROPOSALS';
  const currentIdx = SUB_STEPS.findIndex(s => s.id === subStep);

  return (
    <div className="space-y-6">
      {/* AM Brief */}
      {ticket.intakeBrief && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> بريف مدير الحساب</h4>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.intakeBrief}</p>
        </div>
      )}

      {/* Sub-step stepper */}
      <div className="flex items-center gap-2">
        {SUB_STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              i < currentIdx ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              i === currentIdx ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' :
              'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              <span>{i < currentIdx ? '✅' : step.icon}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < SUB_STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Sub-step content */}
      {subStep === 'PROPOSALS' && (
        <SeoProposalsSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
      )}

      {(subStep === 'STORE_SETUP' || subStep === 'READY_TO_TRANSFER') && (
        <StoreSetupSubStep ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
      )}
    </div>
  );
}

// ══════ Store Setup Sub-Step ══════
function StoreSetupSubStep({ ticket, headers, staff, userRole, onRefresh, setErrorModal }: Props) {
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [proposal, setProposal] = useState<any>(null);

  // Transfer states
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [seoBrief, setSeoBrief] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [customSlaHours, setCustomSlaHours] = useState('');

  const designers = staff.filter(s => s.role === 'DESIGNER' && s.isActive);

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, { headers })
      .then(r => r.json()).then(d => { if (d && !d.error) setChecklist(d); }).catch(() => {});
    fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, { headers })
      .then(r => r.json()).then(d => { if (d && d.id) setProposal(d); }).catch(() => {});
  }, [ticket.id]);

  const toggle = (key: string) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    saveChecklist(next);
  };

  const setField = (key: string, val: string) => {
    const next = { ...checklist, [key]: val };
    setChecklist(next);
    saveChecklist(next);
  };

  const saveChecklist = async (data: any) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) { setSaveOk(true); setTimeout(() => setSaveOk(false), 2000); }
    } catch {} finally { setSaving(false); }
  };

  const allDone = SETUP_TASKS.every(t => !!checklist[t.key]);
  const completed = SETUP_TASKS.filter(t => !!checklist[t.key]).length;
  const pct = Math.round((completed / SETUP_TASKS.length) * 100);

  const { showToast } = useToast();

  const markReady = async () => {
    try {
      await fetch(`${API}/api/tickets/${ticket.id}/seo-substep`, {
        method: 'PUT', headers, body: JSON.stringify({ subStep: 'READY_TO_TRANSFER' })
      });
      showToast('تم إعداد المتجر بنجاح ✅');
      onRefresh();
    } catch { setErrorModal('تعذر الاتصال'); }
  };

  const transfer = async () => {
    if (!selectedDesignerId) return setErrorModal('يجب اختيار المصمم');
    if (!seoBrief.trim()) return setErrorModal('يجب كتابة البريف');
    setTransferring(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/transfer-to-designer`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          assignedDesignerId: selectedDesignerId,
          seoBrief: seoBrief.trim(),
          customSlaHours: customSlaHours ? Number(customSlaHours) : undefined,
        })
      });
      if (res.ok) { showToast('تم تحويل المهمة للمصمم ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setTransferring(false); }
  };

  return (
    <div className="space-y-4">
      {/* Approved name & domain banner */}
      {proposal?.isFinalized && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 grid grid-cols-2 gap-3">
          <div><p className="text-[10px] text-emerald-600 font-bold mb-1">الاسم المعتمد</p><p className="text-sm font-extrabold text-emerald-900">{proposal.selectedName}</p></div>
          <div><p className="text-[10px] text-emerald-600 font-bold mb-1">الدومين المعتمد</p><p className="text-sm font-extrabold text-emerald-900 ltr text-left">{proposal.selectedDomain}</p></div>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">نسبة الإكمال</span>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>}
            {saveOk && <span className="text-[10px] text-emerald-600 font-bold">✓ تم الحفظ</span>}
            <span className="text-sm font-extrabold text-teal-700">{pct}%</span>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-slate-400">{completed} / {SETUP_TASKS.length} مهمة</p>
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
        {SETUP_TASKS.map(task => {
          const checked = !!checklist[task.key];
          return (
            <div key={task.key} className="px-4 py-3 space-y-2">
              <button onClick={() => toggle(task.key)} className="w-full flex items-center gap-3 text-right group">
                {checked
                  ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  : <div className="w-4 h-4 border-2 border-slate-300 rounded shrink-0 group-hover:border-slate-400" />
                }
                <span className={`text-xs font-medium flex-1 text-right ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.label}</span>
              </button>
              {task.hasCredentials && checked && (
                <div className="mr-7 space-y-2">
                  <input type="email" value={checklist.storeEmail || ''} onChange={e => setField('storeEmail', e.target.value)}
                    placeholder="إيميل المتجر" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                  <input type="password" value={checklist.storePassword || ''} onChange={e => setField('storePassword', e.target.value)}
                    placeholder="باسورد المتجر" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transfer section */}
      {allDone && ticket.seoSubStep !== 'READY_TO_TRANSFER' && (
        <button onClick={markReady} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-700 transition-all">
          <CheckCircle2 className="w-4 h-4" /> تم التنفيذ - تحويل للمصمم
        </button>
      )}

      {ticket.seoSubStep === 'READY_TO_TRANSFER' && (
        <div className="bg-violet-50 rounded-2xl border border-violet-200 p-4 space-y-4">
          <h4 className="text-xs font-bold text-violet-700 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> تحويل الطلب للمصمم</h4>

          {proposal?.isFinalized && (
            <div className="bg-white rounded-xl p-3 border border-violet-100 text-xs text-slate-600 space-y-1">
              <p><strong>الاسم:</strong> {proposal.selectedName}</p>
              <p><strong>الدومين:</strong> {proposal.selectedDomain}</p>
              {ticket.aiProposal?.generatedLogoUrl && <p><strong>الشعار:</strong> متوفر ✅</p>}
            </div>
          )}

          <select value={selectedDesignerId} onChange={e => setSelectedDesignerId(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="">اختر المصمم...</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.name} - {ROLE_LABELS[d.role] || d.role}</option>)}
          </select>

          <textarea value={seoBrief} onChange={e => setSeoBrief(e.target.value)} placeholder="اكتب البريف للمصمم..." rows={4}
            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> SLA مخصص (بالساعات)
            </label>
            <input type="number" min={1} value={customSlaHours} onChange={e => setCustomSlaHours(e.target.value)}
              placeholder="اتركه فارغاً لاستخدام الافتراضي (48 ساعة)" dir="ltr"
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          <button onClick={transfer} disabled={transferring || !selectedDesignerId || !seoBrief.trim()}
            className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 transition-all disabled:opacity-50">
            {transferring ? <><Clock className="w-4 h-4 animate-spin" /> جاري التحويل...</> : <><Send className="w-4 h-4" /> تحويل للمصمم (مرحلة التصميم)</>}
          </button>
        </div>
      )}
    </div>
  );
}
