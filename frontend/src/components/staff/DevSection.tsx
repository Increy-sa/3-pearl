import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { CheckCircle2, AlertCircle, ExternalLink, FileText, Image as ImageIcon, Link2, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';

const API = API_URL;

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
  const [storeCreds, setStoreCreds] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [seoChecklist, setSeoChecklist] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const credDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();

  // ─── Role helpers ───────────────────────────────────────────────────
  const isDeveloper = userRole === 'DEVELOPER' || userRole === 'ADMIN';
  const isAdminOrAM = ['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole);
  const canSeeCredentials = ticket.showCredentialsToDev === true || ['ADMIN', 'ACCOUNT_MANAGER', 'SEO'].includes(userRole);

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/dev-checklist`, { headers })
      .then(r => r.json()).then(d => { if (d && !d.error) setChecklist(d); }).catch(() => { });
    fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers })
      .then(r => r.json()).then(d => { if (d && d.id) setDelivery(d); }).catch(() => { });
    // Fetch seo-checklist (for store credentials)
    fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, { headers })
      .then(r => r.json()).then(d => {
        if (d && !d.error) {
          setSeoChecklist(d);
          setStoreEmail(d.storeEmail || '');
          setStorePassword(d.storePassword || '');
          if (canSeeCredentials) {
            setStoreCreds({ email: d.newGmail || d.storeEmail || '', password: d.newGmailPassword || d.storePassword || '' });
          }
        }
      }).catch(() => { });
    // Fetch dynamic tasks
    fetch(`${API}/api/tickets/${ticket.id}/tasks`, { headers })
      .then(r => r.json()).then(d => {
        if (d && d.DEVELOPER) setDynamicTasks(d.DEVELOPER);
      }).catch(() => { });
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
      } catch { } finally { setSaving(false); }
    }, 500);
  }, [ticket.id, headers]);

  const toggleTask = async (taskId: string, currentCompleted: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/tasks/${taskId}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !currentCompleted })
      });
      if (res.ok) {
        setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentCompleted } : t));
        setSaveOk(true); setTimeout(() => setSaveOk(false), 2000);
      }
    } catch { } finally { setSaving(false); }
  };

  // Save store credentials to seo-checklist (debounced)
  const saveStoreField = (field: 'storeEmail' | 'storePassword', value: string) => {
    if (field === 'storeEmail') setStoreEmail(value);
    else setStorePassword(value);
    if (credDebounceRef.current) clearTimeout(credDebounceRef.current);
    credDebounceRef.current = setTimeout(async () => {
      const payload = field === 'storeEmail'
        ? { storeEmail: value, storePassword }
        : { storeEmail, storePassword: value };
      try {
        await fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, {
          method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch { }
    }, 600);
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

  const completed = dynamicTasks.filter(t => t.isCompleted).length;
  const totalTasks = dynamicTasks.length || 1;
  const pct = Math.round((completed / totalTasks) * 100);
  const allDone = completed === dynamicTasks.length && dynamicTasks.length > 0;
  const reviewStatus = checklist?.seoReviewStatus || 'PENDING';
  const reviewBadge = REVIEW_BADGES[reviewStatus] || REVIEW_BADGES.PENDING;
  const isSubmitted = !!checklist?.isSubmittedToSeo;

  // Developer can edit checkboxes only when not yet approved and not submitted (or in revision)
  const canDevEdit = isDeveloper && reviewStatus !== 'APPROVED' && (!isSubmitted || reviewStatus === 'REVISION');

  let imgs: string[] = [];
  try { imgs = JSON.parse(delivery?.images || '[]'); } catch { }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Dev Brief */}
      {ticket.devBrief && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> بريف المطور</h4>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.devBrief}</p>
        </div>
      )}

      {/* Store Credentials — only if allowed */}
      {canSeeCredentials && storeCreds && (storeCreds.email || storeCreds.password) && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> بيانات دخول المتجر</h4>
          <div className="space-y-1.5 text-xs">
            {storeCreds.email && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-20 shrink-0">إيميل:</span>
                <span className="font-mono text-slate-700">{storeCreds.email}</span>
              </div>
            )}
            {storeCreds.password && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-20 shrink-0">كلمة المرور:</span>
                <span className="font-mono text-slate-700">{showPassword ? storeCreds.password : '••••••••'}</span>
                <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            )}
          </div>
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
                <a key={i} href={normalizeUrl(url) || ''} target="_blank" rel="noreferrer">
                  <img src={normalizeUrl(url) || ''} alt={`تصميم ${i + 1}`} className="w-full h-20 object-cover rounded-xl border border-violet-200 hover:opacity-80 transition-opacity" />
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
          <div><p className="text-xs font-bold text-red-800">ملاحظات المراجع:</p><p className="text-xs text-red-700 mt-1">{checklist.seoReviewNotes}</p></div>
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
        <p className="text-[10px] text-slate-400">{completed} / {dynamicTasks.length} مهمة</p>
      </div>

      {/* Task checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
        {dynamicTasks.map((task, idx) => {
          const isInteractive = canDevEdit;
          // First task is "إنشاء المتجر على سلة" — show credential fields when completed
          const isStoreCreationTask = idx === 0 && task.name?.includes('إنشاء المتجر');
          return (
            <div key={task.id} className="px-4 py-3 space-y-2">
              <button onClick={() => isInteractive && toggleTask(task.id, task.isCompleted)} disabled={!isInteractive}
                className="w-full flex items-center gap-3 text-right group disabled:cursor-default cursor-pointer">
                {task.isCompleted
                  ? <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  : <div className="w-4 h-4 border-2 border-slate-300 rounded shrink-0 group-hover:border-slate-400" />
                }
                <span className={`text-xs font-medium flex-1 text-right ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.name}</span>
              </button>
              {/* Store credential fields — appear when first task (store creation) is completed */}
              {isStoreCreationTask && task.isCompleted && isDeveloper && (
                <div className="mr-7 space-y-2">
                  <input type="email" value={storeEmail} onChange={e => saveStoreField('storeEmail', e.target.value)}
                    placeholder="إيميل المتجر" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="text" value={storePassword} onChange={e => saveStoreField('storePassword', e.target.value)}
                    placeholder="باسورد المتجر" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Developer's brief to SEO — shown when submitted */}
      {checklist?.devBriefToSeo && reviewStatus === 'PENDING' && isSubmitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
          <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-blue-500 mb-1">بريف المطور لفريق SEO</p>
            <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{checklist.devBriefToSeo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
