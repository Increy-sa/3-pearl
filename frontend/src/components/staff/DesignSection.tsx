import { useEffect, useState, useRef } from 'react';
import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { Send, CheckCircle2, AlertCircle, ExternalLink, Upload, X, Image as ImageIcon, Link2, Users, Clock, FileText } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';
const API = API_URL;
const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'bg-slate-100 text-slate-600' },
  SENT_TO_SEO: { label: 'بانتظار مراجعة SEO', cls: 'bg-blue-100 text-blue-700' },
  SEO_APPROVED: { label: 'معتمد من SEO', cls: 'bg-emerald-100 text-emerald-700' },
  SEO_REVISION: { label: 'طلب تعديل من SEO', cls: 'bg-red-100 text-red-700' },
  SENT_TO_CLIENT: { label: 'بانتظار العميل', cls: 'bg-blue-100 text-blue-700' },
  CLIENT_APPROVED: { label: 'معتمد من العميل ✅', cls: 'bg-emerald-100 text-emerald-700' },
  CLIENT_REVISION: { label: 'طلب تعديل من العميل', cls: 'bg-red-100 text-red-700' },
};
const ROLE_LABELS: Record<string, string> = { ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO' };

interface Props {
  ticket: any;
  headers: Record<string, string>;
  staff: any[];
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function DesignSection({ ticket, headers, staff, userRole, onRefresh, setErrorModal }: Props) {
  const [delivery, setDelivery] = useState<any>(null);
  const [figmaLink, setFigmaLink] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [revNotes, setRevNotes] = useState('');
  const [showRevForm, setShowRevForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Transfer states
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedDevId, setSelectedDevId] = useState('');
  const [devBrief, setDevBrief] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [customSlaHours, setCustomSlaHours] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const developers = staff.filter(s => s.role === 'DEVELOPER' && s.isActive);
  const proposal = ticket.aiProposal;
  const { showToast } = useToast();
  const [logoTypeImageUrl, setLogoTypeImageUrl] = useState<string | null>(null);

  // ─── Role helpers ───────────────────────────────────────────────────
  const isDesigner = userRole === 'DESIGNER';
  const isSEO = userRole === 'SEO';
  const isAdminOrAM = userRole === 'ADMIN' || userRole === 'ACCOUNT_MANAGER';

  useEffect(() => {
    fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers })
      .then(r => r.json()).then(d => {
        if (d && d.id) {
          setDelivery(d);
          setFigmaLink(d.figmaLink || '');
          try { setImages(JSON.parse(d.images || '[]')); } catch { setImages([]); }
        }
      }).catch(() => {});
    // Fetch logo type image
    if (proposal?.selectedLogoType) {
      fetch(`${API}/api/logo-types`).then(r => r.json()).then((types: any[]) => {
        const match = types.find((t: any) => t.id === proposal.selectedLogoType);
        if (match?.imageUrl) setLogoTypeImageUrl(match.imageUrl);
      }).catch(() => {});
    }
  }, [ticket.id]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await fetch(`${API}/api/tickets/${ticket.id}/design-image`, {
          method: 'POST', headers,
          body: JSON.stringify({ fileName: file.name, fileData: reader.result })
        });
        if (res.ok) { const { url } = await res.json(); setImages(prev => [...prev, url]); }
        else setErrorModal('فشل رفع الصورة');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setErrorModal('فشل رفع الصورة'); setUploading(false); }
  };

  const save = async (send = false) => {
    send ? setSending(true) : setSaving(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, {
        method: 'PUT', headers, body: JSON.stringify({ figmaLink, images })
      });
      if (!res.ok) { setErrorModal('فشل الحفظ'); return; }
      const saved = await res.json();
      setDelivery(saved);
      if (send) {
        const r2 = await fetch(`${API}/api/tickets/${ticket.id}/design-delivery/send-to-seo`, { method: 'PUT', headers });
        if (r2.ok) { setDelivery(await r2.json()); showToast('تم إرسال التصميم لفريق SEO ✅'); onRefresh(); }
        else { const e = await r2.json(); setErrorModal(e.error); }
      } else {
        showToast('تم حفظ التصميم بنجاح ✅');
      }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setSaving(false); setSending(false); }
  };

  const seoReview = async (action: string) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/design-delivery/seo-review`, {
        method: 'PUT', headers, body: JSON.stringify({ action, notes: revNotes })
      });
      if (res.ok) {
        setDelivery(await res.json());
        setShowRevForm(false);
        setRevNotes('');
        showToast(action === 'APPROVE' ? 'تم اعتماد التصميم ✅' : 'تم إرسال طلب التعديل');
      }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const sendToClient = async () => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/design-delivery/send-to-client`, { method: 'PUT', headers });
      if (res.ok) { setDelivery(await res.json()); showToast('تم إرسال التصميم للعميل ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setReviewLoading(false); }
  };

  const transfer = async () => {
    if (!selectedDevId) return setErrorModal('يجب اختيار المطور');
    setTransferring(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/transfer-to-dev`, {
        method: 'PUT', headers, body: JSON.stringify({
          developerId: selectedDevId,
          devBrief: devBrief.trim(),
          customSlaHours: customSlaHours ? Number(customSlaHours) : undefined,
        })
      });
      if (res.ok) { showToast('تم تحويل المهمة للمطور ✅'); onRefresh(); }
      else { const e = await res.json(); setErrorModal(e.error); }
    } catch { setErrorModal('تعذر الاتصال'); }
    finally { setTransferring(false); }
  };

  const status = delivery?.status || 'DRAFT';
  const badge = STATUS_BADGES[status] || STATUS_BADGES.DRAFT;

  // Designer can edit only in DRAFT / revision statuses
  const canDesignerEdit = isDesigner && ['DRAFT', 'SEO_REVISION', 'CLIENT_REVISION'].includes(status);

  // Get approved proposal data
  let approvedName = '', approvedDomain = '';
  const fetchProposal = async () => {
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, { headers });
      const p = await res.json();
      if (p?.selectedName) { approvedName = p.selectedName; approvedDomain = p.selectedDomain; }
    } catch {}
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Brief from SEO */}
      {ticket.seoBrief && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> بريف فريق SEO</h4>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.seoBrief}</p>
          {proposal?.generatedLogoUrl && (
            <div className="mt-3 flex items-center gap-2">
              <img src={normalizeUrl(proposal.generatedLogoUrl)} alt="الشعار" className="w-10 h-10 rounded-lg object-contain bg-white border" />
              <span className="text-[10px] text-blue-600">الشعار المعتمد</span>
            </div>
          )}
          {proposal?.selectedLogoTypeName && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs font-bold text-violet-700">
                {logoTypeImageUrl && <img src={logoTypeImageUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-slate-900 p-0.5" />}
                🎨 نوع الشعار المطلوب: {proposal.selectedLogoTypeName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> تسليم التصميم</h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Revision notes — visible to DESIGNER (to know what to fix)
          and everyone else for context
         ═══════════════════════════════════════════════════════════════ */}
      {status === 'SEO_REVISION' && delivery?.seoNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات SEO:</p><p className="text-xs text-red-700 mt-1">{delivery.seoNotes}</p></div>
        </div>
      )}
      {status === 'CLIENT_REVISION' && delivery?.clientNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-xs font-bold text-red-800">ملاحظات العميل:</p><p className="text-xs text-red-700 mt-1">{delivery.clientNotes}</p></div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Figma Link
          - DESIGNER: editable (when canDesignerEdit)
          - SEO / ADMIN / AM: read-only
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> رابط Figma</label>
        {isDesigner ? (
          <input type="url" value={figmaLink} onChange={e => setFigmaLink(e.target.value)} disabled={!canDesignerEdit}
            placeholder="https://www.figma.com/file/..." dir="ltr"
            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 text-left" />
        ) : (
          /* SEO / ADMIN / AM — read-only display */
          figmaLink ? (
            <a href={ensureUrl(figmaLink)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 hover:bg-violet-100 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> فتح رابط Figma
            </a>
          ) : (
            <p className="text-xs text-slate-400">لم يتم إضافة رابط Figma بعد</p>
          )
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Design Images
          - DESIGNER: upload/remove (when canDesignerEdit)
          - SEO / ADMIN / AM: view only
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> صور التصميم</label>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative group">
                <a href={normalizeUrl(url)} target="_blank" rel="noreferrer">
                  <img src={normalizeUrl(url)} alt={`تصميم ${i + 1}`} className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                </a>
                {/* Only DESIGNER can remove images */}
                {canDesignerEdit && (
                  <button onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !isDesigner && <p className="text-xs text-slate-400">لم يتم رفع صور بعد</p>
        )}
        {/* Only DESIGNER can upload */}
        {canDesignerEdit && (
          <>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = ''; }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-violet-100 disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> {uploading ? 'جاري الرفع...' : 'رفع صورة'}
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Save / Send to SEO — DESIGNER only
         ═══════════════════════════════════════════════════════════════ */}
      {canDesignerEdit && (
        <div className="flex items-center gap-2">
          <button onClick={() => save(false)} disabled={saving} className="px-4 py-2 bg-slate-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={() => save(true)} disabled={sending} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <Send className="w-3.5 h-3.5" /> {sending ? 'جاري الإرسال...' : 'إرسال لفريق SEO'}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEO Review (Approve / Revision) — SEO role ONLY
         ═══════════════════════════════════════════════════════════════ */}
      {status === 'SENT_TO_SEO' && isSEO && (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4 space-y-3">
          <p className="text-xs font-bold text-blue-800">التصميم بانتظار مراجعتك</p>
          {showRevForm ? (
            <div className="space-y-2">
              <textarea value={revNotes} onChange={e => setRevNotes(e.target.value)} placeholder="ملاحظات التعديل..." rows={3}
                className="w-full text-xs border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => seoReview('REVISION')} disabled={reviewLoading} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50">إرسال طلب التعديل</button>
                <button onClick={() => setShowRevForm(false)} className="px-3 py-2 text-slate-500 text-xs font-bold">إلغاء</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => seoReview('APPROVE')} disabled={reviewLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد التصميم
              </button>
              <button onClick={() => setShowRevForm(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200 cursor-pointer">طلب تعديل</button>
            </div>
          )}
        </div>
      )}

      {/* SENT_TO_SEO info for non-SEO roles (DESIGNER / ADMIN / AM) — badge only, no buttons */}
      {status === 'SENT_TO_SEO' && !isSEO && (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-4">
          <p className="text-xs font-bold text-blue-800">التصميم بانتظار مراجعة SEO</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Send to client — SEO + ADMIN + ACCOUNT_MANAGER
         ═══════════════════════════════════════════════════════════════ */}
      {status === 'SEO_APPROVED' && (isSEO || isAdminOrAM) && (
        <button onClick={sendToClient} disabled={reviewLoading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
          <Send className="w-4 h-4" /> {reviewLoading ? 'جاري الإرسال...' : 'إرسال التصميم للعميل'}
        </button>
      )}

      {/* SEO_APPROVED info for DESIGNER — read-only */}
      {status === 'SEO_APPROVED' && isDesigner && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> التصميم تم اعتماده من SEO — بانتظار الإرسال للعميل
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Client approved — Transfer to dev
          Visible to SEO + ADMIN + ACCOUNT_MANAGER
         ═══════════════════════════════════════════════════════════════ */}
      {status === 'CLIENT_APPROVED' && (isSEO || isAdminOrAM) && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 space-y-4">
          <p className="text-xs font-bold text-emerald-800">✅ التصميم معتمد من العميل</p>
          {/* عرض ملاحظات العميل */}
          {delivery?.clientNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div><p className="text-xs font-bold text-amber-800">ملاحظات العميل:</p><p className="text-xs text-amber-700 mt-1">{delivery.clientNotes}</p></div>
            </div>
          )}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-violet-700 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> تحويل للمطور</h4>
            <select value={selectedDevId} onChange={e => setSelectedDevId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
              <option value="">اختر المطور...</option>
              {developers.map(d => <option key={d.id} value={d.id}>{d.name} - {ROLE_LABELS[d.role]}</option>)}
            </select>
            <textarea value={devBrief} onChange={e => setDevBrief(e.target.value)} placeholder="بريف المطور (اختياري)..." rows={3}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none resize-none" />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> SLA مخصص (بالساعات)
              </label>
              <input type="number" min={1} value={customSlaHours} onChange={e => setCustomSlaHours(e.target.value)}
                placeholder="اتركه فارغاً لاستخدام الافتراضي (72 ساعة)" dir="ltr"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <button onClick={transfer} disabled={transferring || !selectedDevId}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {transferring ? <><Clock className="w-4 h-4 animate-spin" /> جاري التحويل...</> : <><Send className="w-4 h-4" /> تحويل للمطور (مرحلة التطوير)</>}
            </button>
          </div>
        </div>
      )}

      {/* CLIENT_APPROVED info for DESIGNER — read-only */}
      {status === 'CLIENT_APPROVED' && isDesigner && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> ✅ التصميم معتمد من العميل — بانتظار التحويل للمطور
          </p>
        </div>
      )}
    </div>
  );
}
