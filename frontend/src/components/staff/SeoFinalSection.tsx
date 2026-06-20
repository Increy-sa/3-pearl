import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { CheckCircle2, AlertCircle, Send, Clock, Globe, Mail, Lock, ExternalLink, Link2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';

const API = API_URL;

const TASK_GROUPS = [
  { title: '💳 وسائل الدفع', tasks: [
    { key: 'paymentActivated', label: 'تفعيل وسائل الدفع المناسبة' },
    { key: 'paymentTested', label: 'اختبار عمليات الدفع' },
    { key: 'paymentGatewaysOk', label: 'التأكد من عمل جميع البوابات بشكل صحيح' },
  ]},
  { title: '🚚 إعدادات الشحن', tasks: [
    { key: 'shippingLinked', label: 'ربط شركات الشحن المناسبة' },
    { key: 'shippingZonesSet', label: 'إعداد مناطق وأسعار الشحن' },
    { key: 'shippingTested', label: 'اختبار عملية الشحن' },
  ]},
  { title: '🔍 تحسينات SEO', tasks: [
    { key: 'pageTitlesSet', label: 'إعداد عناوين الصفحات' },
    { key: 'metaDescSet', label: 'إعداد الوصف التعريفي (Meta Description)' },
    { key: 'urlsOptimized', label: 'تحسين الروابط (URLs)' },
    { key: 'productsOptimized', label: 'تحسين الأقسام والمنتجات لمحركات البحث' },
    { key: 'contentReviewed', label: 'مراجعة المحتوى' },
    { key: 'finalInspection', label: 'إجراء فحص نهائي للمتجر' },
  ]},
];
const ALL_TASKS = TASK_GROUPS.flatMap(g => g.tasks);

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS: { label: 'قيد التنفيذ', cls: 'bg-slate-100 text-slate-600' },
  SENT_TO_AM: { label: 'بانتظار مدير الحساب', cls: 'bg-blue-100 text-blue-700' },
  AM_APPROVED: { label: 'معتمد من مدير الحساب', cls: 'bg-emerald-100 text-emerald-700' },
  AM_REVISION: { label: 'طلب تعديل من مدير الحساب', cls: 'bg-red-100 text-red-700' },
  SENT_TO_CLIENT: { label: 'بانتظار العميل', cls: 'bg-blue-100 text-blue-700' },
  CLIENT_APPROVED: { label: 'معتمد من العميل ✅', cls: 'bg-emerald-100 text-emerald-700' },
  CLIENT_REVISION: { label: 'طلب تعديل من العميل', cls: 'bg-red-100 text-red-700' },
};

interface Props {
  ticket: any;
  headers: Record<string, string>;
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function SeoFinalSection({ ticket, headers, userRole, onRefresh, setErrorModal }: Props) {
  const [checklist, setChecklist] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [brief, setBrief] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [showRevForm, setShowRevForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  // Delivery states
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [delivering, setDelivering] = useState(false);
  // Related data
  const [proposal, setProposal] = useState<any>(null);
  const [seoChecklist, setSeoChecklist] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAM = ['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole);
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/seo-final`, { headers })
      .then(r => r.json()).then(d => { if (d && !d.error) setChecklist(d); }).catch(() => {});
    fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, { headers })
      .then(r => r.json()).then(d => { if (d?.id) setProposal(d); }).catch(() => {});
    fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, { headers })
      .then(r => r.json()).then(d => { if (d && !d.error) setSeoChecklist(d); }).catch(() => {});
    fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers })
      .then(r => r.json()).then(d => { if (d?.id) setDelivery(d); }).catch(() => {});
  }, [ticket.id]);

  const saveChecklist = useCallback((data: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-final`, {
          method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (res.ok) { const s = await res.json(); setChecklist(s); setSaveOk(true); setTimeout(() => setSaveOk(false), 2000); }
      } catch {} finally { setSaving(false); }
    }, 500);
  }, [ticket.id, headers]);

  const toggle = (key: string) => {
    const next = { ...checklist, [key]: !checklist?.[key] };
    setChecklist(next);
    saveChecklist(next);
  };

  const sendToAm = async () => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-final/send-to-am`, {
        method: 'PUT', headers, body: JSON.stringify({ brief })
      });
      if (res.ok) { setChecklist(await res.json()); showToast('تم إرسال المهام لمدير الحساب ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const amReview = async (action: string) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-final/am-review`, {
        method: 'PUT', headers, body: JSON.stringify({ action, notes: revNotes })
      });
      if (res.ok) {
        setChecklist(await res.json());
        setShowRevForm(false);
        setRevNotes('');
        showToast(action === 'APPROVE' ? 'تم الاعتماد ✅' : 'تم إرسال طلب التعديل');
      }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const sendToClient = async () => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-final/send-to-client`, { method: 'PUT', headers });
      if (res.ok) { setChecklist(await res.json()); showToast('تم عرض المهام على العميل ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const finalDeliver = async () => {
    setDelivering(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/final-delivery`, {
        method: 'PUT', headers, body: JSON.stringify({ notes: deliveryNotes })
      });
      if (res.ok) { showToast('تم تسليم المتجر بنجاح 🎉'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setDelivering(false); }
  };

  const status = checklist?.status || 'IN_PROGRESS';
  const badge = STATUS_BADGES[status] || STATUS_BADGES.IN_PROGRESS;
  const completed = ALL_TASKS.filter(t => !!checklist?.[t.key]).length;
  const pct = Math.round((completed / ALL_TASKS.length) * 100);
  const allDone = completed === ALL_TASKS.length;
  const canEdit = ['IN_PROGRESS', 'AM_REVISION', 'CLIENT_REVISION'].includes(status);

  let imgs: string[] = [];
  try { imgs = JSON.parse(delivery?.images || '[]'); } catch {}

  return (
    <div className="space-y-4" dir="rtl">
      {/* Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-teal-600 uppercase tracking-wider">📋 المراجعة النهائية وSEO</h3>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>}
          {saveOk && <span className="text-[10px] text-emerald-600 font-bold">✓ تم الحفظ</span>}
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      {/* Revision notes */}
      {status === 'AM_REVISION' && checklist?.amNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات مدير الحساب:</p><p className="text-xs text-red-700 mt-1">{checklist.amNotes}</p></div>
        </div>
      )}
      {status === 'CLIENT_REVISION' && checklist?.clientNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات العميل:</p><p className="text-xs text-red-700 mt-1">{checklist.clientNotes}</p></div>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">نسبة الإكمال الكلية</span>
          <span className="text-sm font-extrabold text-teal-700">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-slate-400">{completed} / {ALL_TASKS.length} مهمة</p>
      </div>

      {/* Task groups */}
      {TASK_GROUPS.map(group => {
        const gc = group.tasks.filter(t => !!checklist?.[t.key]).length;
        return (
          <div key={group.title} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">{group.title}</span>
              <span className="text-[10px] font-bold text-slate-500">{gc}/{group.tasks.length}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {group.tasks.map(task => {
                const checked = !!checklist?.[task.key];
                return (
                  <div key={task.key} className="px-4 py-3">
                    <button onClick={() => canEdit && toggle(task.key)} disabled={!canEdit}
                      className="w-full flex items-center gap-3 text-right group disabled:cursor-default cursor-pointer">
                      {checked ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" /> : <div className="w-4 h-4 border-2 border-slate-300 rounded shrink-0" />}
                      <span className={`text-xs font-medium flex-1 ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Send to AM */}
      {allDone && status === 'IN_PROGRESS' && (
        <div className="bg-teal-50 rounded-2xl border border-teal-200 p-4 space-y-3">
          <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="بريف لمدير الحساب..." rows={3}
            className="w-full text-xs border border-teal-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
          <button onClick={sendToAm} disabled={reviewLoading}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
            <Send className="w-4 h-4" /> {reviewLoading ? 'جاري الإرسال...' : 'إرسال لمدير الحساب للمراجعة'}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          AM Review — with comprehensive store details
         ═══════════════════════════════════════════════════════════════ */}
      {isAM && status === 'SENT_TO_AM' && (
        <div className="space-y-4">
          {/* Store Details Dashboard for AM */}
          <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-4">
            <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> بيانات المتجر للمراجعة</h4>
            <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
              {proposal?.selectedName && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">اسم المتجر</span>
                  <span className="text-xs font-bold text-slate-800">{proposal.selectedName}</span>
                </div>
              )}
              {proposal?.selectedDomain && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">الدومين</span>
                  <span className="text-xs font-bold text-slate-800 ltr text-left">{proposal.selectedDomain}</span>
                </div>
              )}
              {ticket.storeDetails?.sallaStoreUrl && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">رابط المتجر</span>
                  <a href={ensureUrl(ticket.storeDetails.sallaStoreUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate">{ticket.storeDetails.sallaStoreUrl}</a>
                </div>
              )}
              {seoChecklist?.storeEmail && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">إيميل المتجر</span>
                  <span className="text-xs font-medium text-slate-800">{seoChecklist.storeEmail}</span>
                </div>
              )}
              {seoChecklist?.storePassword && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">كلمة المرور</span>
                  <span className="text-xs font-mono text-slate-800">{showPassword ? seoChecklist.storePassword : '•'.repeat(10)}</span>
                  <button onClick={() => setShowPassword(!showPassword)} className="text-[10px] text-blue-600 font-bold px-2 py-0.5 rounded-lg hover:bg-blue-50 cursor-pointer">
                    {showPassword ? <><EyeOff className="w-3 h-3 inline" /> إخفاء</> : <><Eye className="w-3 h-3 inline" /> عرض</>}
                  </button>
                </div>
              )}
            </div>

            {/* Figma + Design Images */}
            {(delivery?.figmaLink || imgs.length > 0) && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase">التصاميم المعتمدة</h5>
                {delivery?.figmaLink && (
                  <a href={ensureUrl(delivery.figmaLink)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 px-3 py-2 rounded-xl border border-violet-200 hover:bg-violet-100 cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" /> فتح في Figma
                  </a>
                )}
                {imgs.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imgs.map((url: string, i: number) => (
                      <a key={i} href={normalizeUrl(url) || ''} target="_blank" rel="noreferrer">
                        <img src={normalizeUrl(url) || ''} alt={`تصميم ${i + 1}`} className="w-full h-16 object-cover rounded-xl border border-slate-200 hover:opacity-80" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logo */}
            {ticket.aiProposal?.generatedLogoUrl && (
              <div className="flex items-center gap-3">
                <img src={normalizeUrl(ticket.aiProposal.generatedLogoUrl) || ''} alt="الشعار" className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1" />
                <span className="text-[10px] text-slate-500">الشعار المعتمد</span>
              </div>
            )}
          </div>

          {/* SEO brief + Review actions */}
          <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4 space-y-3">
            <p className="text-xs font-bold text-blue-800">بانتظار مراجعتك</p>
            {checklist?.seoBriefToAm && <p className="text-xs text-blue-700 bg-white rounded-xl p-3 border border-blue-100">{checklist.seoBriefToAm}</p>}
            {showRevForm ? (
              <div className="space-y-2">
                <textarea value={revNotes} onChange={e => setRevNotes(e.target.value)} placeholder="ملاحظات..." rows={3}
                  className="w-full text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => amReview('REVISION')} disabled={reviewLoading} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">إرسال طلب التعديل</button>
                  <button onClick={() => setShowRevForm(false)} className="px-3 py-2 text-slate-500 text-xs font-bold cursor-pointer">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => amReview('APPROVE')} disabled={reviewLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" /> اعتماد</button>
                <button onClick={() => setShowRevForm(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200 cursor-pointer">طلب تعديل</button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAM && status === 'AM_APPROVED' && (
        <button onClick={sendToClient} disabled={reviewLoading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
          <Send className="w-4 h-4" /> عرض على العميل
        </button>
      )}

      {/* Final delivery section */}
      {isAM && status === 'CLIENT_APPROVED' && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 space-y-4">
          <p className="text-sm font-bold text-emerald-800">✅ العميل اعتمد — جاهز للتسليم</p>
          <div className="bg-white rounded-xl p-4 space-y-2 border border-emerald-100 text-xs text-slate-700">
            {proposal?.selectedName && <p><strong>اسم المتجر:</strong> {proposal.selectedName}</p>}
            {proposal?.selectedDomain && <p><strong>الدومين:</strong> {proposal.selectedDomain}</p>}
            {seoChecklist?.storeEmail && <p><strong>إيميل المتجر:</strong> {seoChecklist.storeEmail}</p>}
            {seoChecklist?.storePassword && <p><strong>كلمة المرور:</strong> {'•'.repeat(8)}</p>}
            {delivery?.figmaLink && <p><strong>رابط فيجما:</strong> <a href={ensureUrl(delivery.figmaLink)} target="_blank" rel="noreferrer" className="text-violet-600 underline">فتح</a></p>}
          </div>
          <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="ملاحظات التسليم (اختياري)..." rows={3}
            className="w-full text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
          <button onClick={finalDeliver} disabled={delivering}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
            {delivering ? <><Clock className="w-5 h-5 animate-spin" /> جاري التسليم...</> : <>🎉 تسليم المتجر للعميل</>}
          </button>
        </div>
      )}
    </div>
  );
}
