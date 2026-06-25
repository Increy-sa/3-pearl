import { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { SeoProposalsSection } from './SeoProposalsSection';
import { CheckCircle2, FileText } from 'lucide-react';

const API = API_URL;

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
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [proposal, setProposal] = useState<any>(null);

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

  const completed = SETUP_TASKS.filter(t => !!checklist[t.key]).length;
  const pct = Math.round((completed / SETUP_TASKS.length) * 100);

  return (
    <div className="space-y-6">
      {/* AM Brief */}
      {ticket.intakeBrief && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> بريف مدير الحساب</h4>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.intakeBrief}</p>
        </div>
      )}

      {/* Approved name & domain banner */}
      {proposal?.isFinalized && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] text-emerald-600 font-bold mb-1">الاسم المعتمد</p><p className="text-sm font-extrabold text-emerald-900">{proposal.selectedName}</p></div>
            <div><p className="text-[10px] text-emerald-600 font-bold mb-1">الدومين المعتمد</p><p className="text-sm font-extrabold text-emerald-900 ltr text-left">{proposal.selectedDomain}</p></div>
          </div>
          {ticket.aiProposal?.generatedLogoUrl && (
            <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-emerald-100">
              <img src={ticket.aiProposal.generatedLogoUrl} alt="الشعار" className="w-14 h-14 object-contain rounded-lg border bg-slate-50 p-1" />
              <div>
                <p className="text-[10px] text-emerald-600 font-bold">الشعار المعتمد</p>
                {ticket.aiProposal.selectedLogoTypeName && <p className="text-xs font-bold text-slate-700 mt-0.5">🎨 {ticket.aiProposal.selectedLogoTypeName}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proposals — always visible */}
      <SeoProposalsSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />

      {/* Store Setup Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-teal-600 uppercase tracking-wider">🏪 مهام إعداد المتجر</h3>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>}
            {saveOk && <span className="text-[10px] text-emerald-600 font-bold">✓ تم الحفظ</span>}
            <span className="text-sm font-extrabold text-teal-700">{pct}%</span>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
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
                <button onClick={() => toggle(task.key)} className="w-full flex items-center gap-3 text-right group cursor-pointer">
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
      </div>
    </div>
  );
}
