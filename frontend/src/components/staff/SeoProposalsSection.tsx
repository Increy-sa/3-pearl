import { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { Send, CheckCircle2, AlertCircle, MessageSquare, Plus, Minus, Globe, Type } from 'lucide-react';
import { useToast } from '../ui/Toast';
const API = API_URL;
const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'bg-slate-100 text-slate-600' },
  SENT_TO_AM: { label: 'بانتظار مدير الحساب', cls: 'bg-blue-100 text-blue-700' },
  AM_APPROVED: { label: 'معتمد من مدير الحساب', cls: 'bg-emerald-100 text-emerald-700' },
  AM_REVISION: { label: 'طلب تعديل من مدير الحساب', cls: 'bg-red-100 text-red-700' },
  SENT_TO_CLIENT: { label: 'بانتظار العميل', cls: 'bg-blue-100 text-blue-700' },
  CLIENT_APPROVED: { label: 'معتمد من العميل', cls: 'bg-emerald-100 text-emerald-700' },
  CLIENT_REVISION: { label: 'طلب تعديل من العميل', cls: 'bg-red-100 text-red-700' },
};

interface Props {
  ticket: any;
  headers: Record<string, string>;
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function SeoProposalsSection({ ticket, headers, userRole, onRefresh, setErrorModal }: Props) {
  const [proposal, setProposal] = useState<any>(null);
  const [names, setNames] = useState<string[]>(['', '']);
  const [domains, setDomains] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [amNotes, setAmNotes] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const isAM = ['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole);
  const { showToast } = useToast();

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d && d.id) {
          setProposal(d);
          const n = [d.storeName1, d.storeName2, d.storeName3, d.storeName4].filter(Boolean);
          setNames(n.length >= 2 ? n : [...n, ...Array(2 - n.length).fill('')]);
          const dm = [d.domain1, d.domain2, d.domain3, d.domain4].filter(Boolean);
          setDomains(dm.length >= 2 ? dm : [...dm, ...Array(2 - dm.length).fill('')]);
        }
      }).catch(() => {});
  }, [ticket.id]);

  const saveProposals = async (send = false) => {
    send ? setSending(true) : setSaving(true);
    try {
      const body: any = {};
      names.forEach((n, i) => { body[`storeName${i + 1}`] = n || null; });
      domains.forEach((d, i) => { body[`domain${i + 1}`] = d || null; });

      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, {
        method: 'PUT', headers, body: JSON.stringify(body)
      });
      if (!res.ok) { const e = await res.json(); setErrorModal(e.error); return; }
      const saved = await res.json();
      setProposal(saved);

      if (send) {
        const r2 = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals/send-to-am`, {
          method: 'PUT', headers
        });
        if (r2.ok) { setProposal(await r2.json()); showToast('تم إرسال المقترحات لمدير الحساب ✅'); onRefresh(); }
        else { const e = await r2.json(); setErrorModal(e.error); }
      } else {
        showToast('تم حفظ المقترحات بنجاح ✅');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); setSending(false); }
  };

  const amReview = async (action: string) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals/am-review`, {
        method: 'PUT', headers, body: JSON.stringify({ action, notes: amNotes })
      });
      if (res.ok) {
        setProposal(await res.json());
        setShowRevisionForm(false);
        setAmNotes('');
        showToast(action === 'APPROVE' ? 'تم اعتماد المقترحات ✅' : 'تم إرسال طلب التعديل');
        onRefresh();
      }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const sendToClient = async () => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals/send-to-client`, {
        method: 'PUT', headers
      });
      if (res.ok) { setProposal(await res.json()); showToast('تم عرض المقترحات على العميل ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const finalize = async () => {
    if (!proposal?.selectedName || !proposal?.selectedDomain) {
      setErrorModal('لم يتم تحديد الاسم والدومين بعد');
      return;
    }
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals/finalize`, {
        method: 'PUT', headers,
        body: JSON.stringify({ selectedName: proposal.selectedName, selectedDomain: proposal.selectedDomain })
      });
      if (res.ok) { showToast('تم الاعتماد النهائي وبدء إعداد المتجر ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const status = proposal?.status || 'DRAFT';
  const badge = STATUS_BADGES[status] || STATUS_BADGES.DRAFT;
  const canEdit = ['DRAFT', 'AM_REVISION', 'CLIENT_REVISION'].includes(status);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
          <Type className="w-3.5 h-3.5" /> مقترحات الاسم والدومين
        </h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* AM/Client revision notes */}
      {status === 'AM_REVISION' && proposal?.amNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات مدير الحساب:</p><p className="text-xs text-red-700 mt-1">{proposal.amNotes}</p></div>
        </div>
      )}
      {status === 'CLIENT_REVISION' && proposal?.clientNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات العميل:</p><p className="text-xs text-red-700 mt-1">{proposal.clientNotes}</p></div>
        </div>
      )}

      {/* Name inputs */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> مقترحات اسم المتجر</label>
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" value={n} onChange={e => { const c = [...names]; c[i] = e.target.value; setNames(c); }}
              disabled={!canEdit} placeholder={`اسم ${i + 1}`}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50" />
            {i >= 2 && canEdit && (
              <button onClick={() => setNames(names.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Minus className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        {names.length < 4 && canEdit && (
          <button onClick={() => setNames([...names, ''])} className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline">
            <Plus className="w-3.5 h-3.5" /> إضافة اسم آخر
          </button>
        )}
      </div>

      {/* Domain inputs */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> مقترحات الدومين</label>
        {domains.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" value={d} onChange={e => { const c = [...domains]; c[i] = e.target.value; setDomains(c); }}
              disabled={!canEdit} placeholder={`domain${i + 1}.com`}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ltr text-left" />
            {i >= 2 && canEdit && (
              <button onClick={() => setDomains(domains.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Minus className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        {domains.length < 4 && canEdit && (
          <button onClick={() => setDomains([...domains, ''])} className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline">
            <Plus className="w-3.5 h-3.5" /> إضافة دومين آخر
          </button>
        )}
      </div>

      {/* Save/Send buttons for SEO */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <button onClick={() => saveProposals(false)} disabled={saving}
            className="px-4 py-2 bg-slate-600 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? 'جاري الحفظ...' : 'حفظ المقترحات'}
          </button>
          <button onClick={() => saveProposals(true)} disabled={sending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
            <Send className="w-3.5 h-3.5" /> {sending ? 'جاري الإرسال...' : 'إرسال لمدير الحساب'}
          </button>
        </div>
      )}

      {/* AM Actions */}
      {isAM && status === 'SENT_TO_AM' && (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4 space-y-3">
          <p className="text-xs font-bold text-blue-800">المقترحات بانتظار مراجعتك</p>
          {showRevisionForm ? (
            <div className="space-y-2">
              <textarea value={amNotes} onChange={e => setAmNotes(e.target.value)} placeholder="اكتب ملاحظاتك للتعديل..." rows={3}
                className="w-full text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => amReview('REVISION')} disabled={reviewLoading} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50">إرسال طلب التعديل</button>
                <button onClick={() => setShowRevisionForm(false)} className="px-3 py-2 text-slate-500 text-xs font-bold">إلغاء</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => amReview('APPROVE')} disabled={reviewLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد المقترحات
              </button>
              <button onClick={() => setShowRevisionForm(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200">طلب تعديل</button>
            </div>
          )}
        </div>
      )}

      {isAM && status === 'AM_APPROVED' && (
        <button onClick={sendToClient} disabled={reviewLoading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          <Send className="w-4 h-4" /> {reviewLoading ? 'جاري الإرسال...' : 'عرض المقترحات على العميل'}
        </button>
      )}

      {isAM && status === 'CLIENT_APPROVED' && proposal && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 space-y-3">
          <p className="text-xs font-bold text-emerald-800">✅ العميل اعتمد المقترحات</p>
          {/* عرض ملاحظات العميل */}
          {proposal?.clientNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div><p className="text-xs font-bold text-amber-800">ملاحظات العميل:</p><p className="text-xs text-amber-700 mt-1">{proposal.clientNotes}</p></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-emerald-100">
              <p className="text-[10px] text-slate-400 mb-1">الاسم المعتمد</p>
              <p className="text-sm font-bold text-slate-900">{proposal.selectedName}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-emerald-100">
              <p className="text-[10px] text-slate-400 mb-1">الدومين المعتمد</p>
              <p className="text-sm font-bold text-slate-900 ltr text-left">{proposal.selectedDomain}</p>
            </div>
          </div>
          <button onClick={finalize} disabled={reviewLoading}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> {reviewLoading ? 'جاري التأكيد...' : 'تأكيد وإرسال لـ SEO (بدء إعداد المتجر)'}
          </button>
        </div>
      )}
    </section>
  );
}
