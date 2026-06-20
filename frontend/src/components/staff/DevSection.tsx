import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { CheckCircle2, AlertCircle, ExternalLink, FileText, Clock, Send, Image as ImageIcon, Link2 } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';

const API = API_URL;
const DEV_TASKS = [
  { key: 'designApplied', label: 'تطبيق التصميم المعتمد على المتجر' },
  { key: 'pagesSetup', label: 'ضبط الصفحات والأقسام' },
  { key: 'uiTested', label: 'اختبار الواجهة والتأكد من عملها بشكل صحيح' },
  { key: 'deliveredToSeo', label: 'تسليم العمل لفريق SEO' },
];

const REVIEW_BADGES: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'بانتظار المراجعة', cls: 'bg-slate-100 text-slate-600' },
  APPROVED: { label: 'معتمد ✅', cls: 'bg-emerald-100 text-emerald-700' },
  REVISION: { label: 'مطلوب تعديل', cls: 'bg-red-100 text-red-700' },
};

interface Props {
  ticket: any;
  headers: Record<string, string>;
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function DevSection({ ticket, headers, userRole, onRefresh, setErrorModal }: Props) {
  const [checklist, setChecklist] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [revNotes, setRevNotes] = useState('');
  const [showRevForm, setShowRevForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [submittingToSeo, setSubmittingToSeo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();

  // ─── Role helpers ───────────────────────────────────────────────────
  const isDeveloper = userRole === 'DEVELOPER';
  const isSEO = userRole === 'SEO';
  const isAdminOrAM = userRole === 'ADMIN' || userRole === 'ACCOUNT_MANAGER';

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/dev-checklist`, { headers })
      .then(r => r.json()).then(d => { if (d && !d.error) setChecklist(d); }).catch(() => {});
    fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers })
      .then(r => r.json()).then(d => { if (d && d.id) setDelivery(d); }).catch(() => {});
  }, [ticket.id]);

  const saveChecklist = useCallback((data: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`${API}/api/tickets/${ticket.id}/dev-checklist`, {
          method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) { const saved = await res.json(); setChecklist(saved); setSaveOk(true); setTimeout(() => setSaveOk(false), 2000); }
      } catch {} finally { setSaving(false); }
    }, 500);
  }, [ticket.id, headers]);

  const toggle = (key: string) => {
    const next = { ...checklist, [key]: !checklist?.[key] };
    setChecklist(next);
    saveChecklist(next);
  };

  // Developer explicitly submits to SEO
  const submitToSeo = async () => {
    setSubmittingToSeo(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/dev-checklist`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSubmittedToSeo: true })
      });
      if (res.ok) {
        const saved = await res.json();
        setChecklist(saved);
        showToast('تم تسليم العمل لفريق SEO بنجاح ✅');
      } else {
        showToast('فشل التسليم، حاول مرة أخرى', 'error');
      }
    } catch { showToast('تعذر الاتصال بالخادم', 'error'); }
    finally { setSubmittingToSeo(false); }
  };

  const seoReview = async (action: string) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/dev-checklist/seo-review`, {
        method: 'PUT', headers, body: JSON.stringify({ action, notes: revNotes })
      });
      if (res.ok) {
        setChecklist(await res.json());
        setShowRevForm(false);
        setRevNotes('');
        if (action === 'APPROVE') {
          showToast('تم اعتماد عمل المطور بنجاح ✅');
          // Auto-refresh to show SEO_FINAL stage
          onRefresh();
        } else {
          showToast('تم إرسال طلب التعديل');
        }
      }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const completed = DEV_TASKS.filter(t => !!checklist?.[t.key]).length;
  const pct = Math.round((completed / DEV_TASKS.length) * 100);
  const allDone = completed === DEV_TASKS.length;
  const reviewStatus = checklist?.seoReviewStatus || 'PENDING';
  const reviewBadge = REVIEW_BADGES[reviewStatus] || REVIEW_BADGES.PENDING;
  const isSubmitted = !!checklist?.isSubmittedToSeo;

  // Developer can edit checkboxes only when not yet approved and not submitted (or in revision)
  const canDevEdit = isDeveloper && reviewStatus !== 'APPROVED' && (!isSubmitted || reviewStatus === 'REVISION');

  let imgs: string[] = [];
  try { imgs = JSON.parse(delivery?.images || '[]'); } catch {}

  return (
    <div className="space-y-4" dir="rtl">
      {/* Dev Brief */}
      {ticket.devBrief && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> بريف المطور</h4>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.devBrief}</p>
        </div>
      )}

      {/* Design references */}
      {delivery && (
        <div className="bg-violet-50 rounded-2xl border border-violet-200 p-4 space-y-3">
          <h4 className="text-xs font-bold text-violet-700 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> التصميم المعتمد</h4>
          {delivery.figmaLink && (
            <a href={ensureUrl(delivery.figmaLink)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-white px-3 py-2 rounded-xl border border-violet-200 hover:bg-violet-100 cursor-pointer">
              <Link2 className="w-3.5 h-3.5" /> فتح في Figma <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {imgs.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {imgs.map((url, i) => (
                <a key={i} href={normalizeUrl(url)} target="_blank" rel="noreferrer">
                  <img src={normalizeUrl(url)} alt={`تصميم ${i + 1}`} className="w-full h-20 object-cover rounded-xl border border-violet-200 hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review status header + badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">🔧 مهام التطوير</h3>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>}
          {saveOk && <span className="text-[10px] text-emerald-600 font-bold">✓ تم الحفظ</span>}
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${reviewBadge.cls}`}>{reviewBadge.label}</span>
        </div>
      </div>

      {/* Revision notes — visible to everyone */}
      {reviewStatus === 'REVISION' && checklist?.seoReviewNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات SEO:</p><p className="text-xs text-red-700 mt-1">{checklist.seoReviewNotes}</p></div>
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">نسبة الإكمال</span>
          <span className="text-sm font-extrabold text-blue-700">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-l from-blue-500 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-slate-400">{completed} / {DEV_TASKS.length} مهمة</p>
      </div>

      {/* Task checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
        {DEV_TASKS.map(task => {
          const checked = !!checklist?.[task.key];
          const isInteractive = canDevEdit;
          return (
            <div key={task.key} className="px-4 py-3">
              <button onClick={() => isInteractive && toggle(task.key)} disabled={!isInteractive}
                className="w-full flex items-center gap-3 text-right group disabled:cursor-default cursor-pointer">
                {checked
                  ? <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  : <div className="w-4 h-4 border-2 border-slate-300 rounded shrink-0 group-hover:border-slate-400" />
                }
                <span className={`text-xs font-medium flex-1 text-right ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Developer: Submit to SEO button — shows when all done but not yet submitted
         ═══════════════════════════════════════════════════════════════ */}
      {allDone && !isSubmitted && isDeveloper && reviewStatus !== 'APPROVED' && (
        <button onClick={submitToSeo} disabled={submittingToSeo}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
          {submittingToSeo
            ? <><Clock className="w-4 h-4 animate-spin" /> جاري التسليم...</>
            : <><Send className="w-4 h-4" /> تسليم العمل لفريق SEO</>
          }
        </button>
      )}

      {/* Developer: After submitting — waiting message */}
      {allDone && isSubmitted && !isSEO && reviewStatus === 'PENDING' && (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4">
          <p className="text-xs font-bold text-blue-800">تم تسليم جميع المهام — بانتظار مراجعة فريق SEO</p>
        </div>
      )}

      {/* SEO Review (Approve / Revision) — SEO role ONLY, after dev submitted */}
      {allDone && isSubmitted && reviewStatus === 'PENDING' && isSEO && (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4 space-y-3">
          <p className="text-xs font-bold text-blue-800">المطور أنهى جميع المهام - بانتظار مراجعتك</p>
          {showRevForm ? (
            <div className="space-y-2">
              <textarea value={revNotes} onChange={e => setRevNotes(e.target.value)} placeholder="ملاحظات التعديل..." rows={3}
                className="w-full text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => seoReview('REVISION')} disabled={reviewLoading} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">إرسال طلب التعديل</button>
                <button onClick={() => setShowRevForm(false)} className="px-3 py-2 text-slate-500 text-xs font-bold cursor-pointer">إلغاء</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => seoReview('APPROVE')} disabled={reviewLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد عمل المطور
              </button>
              <button onClick={() => setShowRevForm(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200 cursor-pointer">طلب تعديل</button>
            </div>
          )}
        </div>
      )}

      {/* Approved status — visible to all */}
      {reviewStatus === 'APPROVED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-emerald-800">تم اعتماد عمل المطور من فريق SEO ✅</p>
        </div>
      )}
    </div>
  );
}
