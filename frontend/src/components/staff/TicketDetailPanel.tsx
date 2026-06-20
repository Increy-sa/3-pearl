import { useEffect, useState } from 'react';
import {
  X, Clock, AlertTriangle, Shield, Lock, User, Mail, Phone,
  CreditCard, Palette, Globe, ExternalLink, CheckSquare, Square,
  FileText, Eye, EyeOff, MessageSquare, Link2, Download,
  AlertCircle, Send, CheckCircle2, Users, ArrowRight
} from 'lucide-react';

import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { SeoChecklistPanel } from './SeoChecklistPanel';
import { SeoStageSection } from './SeoStageSection';
import { DesignSection } from './DesignSection';
import { DevSection } from './DevSection';
import { SeoFinalSection } from './SeoFinalSection';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';

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


const canAssign      = (r: string) => ['ADMIN','ACCOUNT_MANAGER','DESIGNER'].includes(r);
const canSeePassword = (r: string) => ['ADMIN','DEVELOPER'].includes(r);
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدير النظام',
  ACCOUNT_MANAGER: 'مدير حساب',
  DESIGNER: 'مصمم',
  DEVELOPER: 'مطوّر',
  SEO: 'مختص SEO',
};
const INSTRUCTION_LABELS: Record<string, string> = {
  ACCOUNT_MANAGER: 'توجيهات لمدير الحساب',
  DESIGNER: 'توجيهات للمصمم',
  DEVELOPER: 'توجيهات للمطور',
  SEO: 'توجيهات لمختص SEO',
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
  DESIGN_SUBMITTED_FOR_APPROVAL: 'إرسال التصاميم للعميل',
  MOVED_TO_DEVELOPMENT: 'تحويل للتطوير',
  DEVELOPER_COMPLETED: 'إنهاء المطوّر للعمل',
  AM_APPROVED_DEVELOPMENT: 'موافقة مدير الحساب',
  AM_APPROVED_DELIVERED: 'موافقة نهائية وتسليم',
  AM_REQUESTED_REVISION: 'طلب تعديل من مدير الحساب',
  EMERGENCY_TRANSFER: '⚠️ تحويل طوارئ',
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

// ═══════ INTAKE Section Component ═══════
function IntakeSection({ ticket, headers, staff, userRole, onRefresh, setErrorModal }: {
  ticket: any; headers: Record<string, string>; staff: any[]; userRole: string;
  onRefresh: () => void; setErrorModal: (msg: string | null) => void;
}) {
  const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isApprovingIntake, setIsApprovingIntake] = useState(false);

  // Document states
  const [freelanceDocUrl, setFreelanceDocUrl] = useState(ticket.freelanceDocUrl || '');
  const [commercialRegUrl, setCommercialRegUrl] = useState(ticket.commercialRegUrl || '');
  const [isUploadingFreelance, setIsUploadingFreelance] = useState(false);
  const [isUploadingCommercial, setIsUploadingCommercial] = useState(false);
  const [isSavingDocs, setIsSavingDocs] = useState(false);

  // Transfer states
  const [selectedSeoId, setSelectedSeoId] = useState(ticket.assignedSeoId || '');
  const [intakeBrief, setIntakeBrief] = useState(ticket.intakeBrief || '');
  const [isTransferring, setIsTransferring] = useState(false);
  const [customSlaHours, setCustomSlaHours] = useState('');

  const hasAtLeastOneDoc = !!(freelanceDocUrl || commercialRegUrl || ticket.freelanceDocUrl || ticket.commercialRegUrl);
  const staffList = staff.filter((s: any) => s.role === 'SEO' && s.isActive);

  // Fetch data requests
  useEffect(() => {
    const fetchDataRequests = async () => {
      try {
        const res = await fetch(`${API}/api/tickets/${ticket.id}/data-requests`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDataRequests(data);
        }
      } catch {}
    };
    fetchDataRequests();
  }, [ticket.id]);

  const sendDataRequest = async () => {
    if (!newMessage.trim()) return;
    setIsSendingRequest(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/data-request`, {
        method: 'POST', headers, body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        const dr = await res.json();
        setDataRequests(prev => [...prev, dr]);
        setNewMessage('');
        setShowRequestForm(false);
      } else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل إرسال الطلب');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setIsSendingRequest(false); }
  };

  const approveIntake = async () => {
    setIsApprovingIntake(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/approve-intake`, {
        method: 'PUT', headers,
      });
      if (res.ok) {
        onRefresh();
        // Refresh data requests to show resolved status
        const drRes = await fetch(`${API}/api/tickets/${ticket.id}/data-requests`, { headers });
        if (drRes.ok) setDataRequests(await drRes.json());
      } else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل الاعتماد');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setIsApprovingIntake(false); }
  };

  const uploadFile = async (file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const fileData = await base64Promise;
      const res = await fetch(`${API}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData })
      });
      if (res.ok) {
        const { url } = await res.json();
        setter(url);
      }
    } finally { setUploading(false); }
  };

  const saveDocuments = async () => {
    setIsSavingDocs(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/upload-documents`, {
        method: 'PUT', headers,
        body: JSON.stringify({ freelanceDocUrl, commercialRegUrl }),
      });
      if (res.ok) { onRefresh(); }
      else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل حفظ الوثائق');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setIsSavingDocs(false); }
  };

  const transferToNextStage = async () => {
    if (!selectedSeoId) return setErrorModal('يجب اختيار شخص SEO');
    if (!intakeBrief.trim()) return setErrorModal('يجب كتابة البريف');
    if (!freelanceDocUrl && !commercialRegUrl && !ticket.freelanceDocUrl && !ticket.commercialRegUrl) {
      return setErrorModal('يجب رفع وثيقة واحدة على الأقل');
    }

    setIsTransferring(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/stage`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          stage: 'SEO_STORE_SETUP',
          assignedSeoId: selectedSeoId,
          intakeBrief: intakeBrief.trim(),
          customSlaHours: customSlaHours ? Number(customSlaHours) : undefined,
        }),
      });
      if (res.ok) { onRefresh(); }
      else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل التحويل');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setIsTransferring(false); }
  };

  return (
    <>
      {/* ب- قسم طلب بيانات إضافية */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" /> طلب بيانات إضافية
        </h3>
        <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 space-y-4">
          {/* Chat history */}
          {dataRequests.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-2 p-3 bg-white rounded-xl border border-slate-100">
              {dataRequests.map((dr: any) => (
                <div key={dr.id} className={`flex ${dr.fromRole === 'ACCOUNT_MANAGER' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    dr.fromRole === 'ACCOUNT_MANAGER'
                      ? 'bg-blue-50 border border-blue-100 text-blue-900'
                      : 'bg-slate-100 border border-slate-200 text-slate-800'
                  }`}>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{dr.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-slate-400">
                        {dr.fromRole === 'ACCOUNT_MANAGER' ? 'مدير الحساب' : 'العميل'}
                      </span>
                      <span className="text-[9px] text-slate-400">{fmtDate(dr.createdAt)}</span>
                      {dr.isResolved && (
                        <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> معتمد
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Send request form */}
          {showRequestForm ? (
            <div className="space-y-2">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="اكتب ما تحتاجه من العميل..."
                rows={3}
                className="w-full text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={sendDataRequest}
                  disabled={isSendingRequest || !newMessage.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingRequest ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
                <button
                  onClick={() => { setShowRequestForm(false); setNewMessage(''); }}
                  className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRequestForm(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> طلب بيانات إضافية
              </button>
              {dataRequests.some((dr: any) => !dr.isResolved && dr.fromRole === 'CUSTOMER') && (
                <button
                  onClick={approveIntake}
                  disabled={isApprovingIntake}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isApprovingIntake ? 'جاري الاعتماد...' : 'اعتماد بيانات العميل'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ج- قسم الوثائق الرسمية */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> الوثائق الرسمية
        </h3>
        <div className="bg-sky-50/50 rounded-2xl border border-sky-200 p-4 space-y-4">
          {/* Freelance Doc */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              وثيقة العمل الحر
              {(freelanceDocUrl || ticket.freelanceDocUrl) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> تم الرفع
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={freelanceDocUrl}
                onChange={e => setFreelanceDocUrl(e.target.value)}
                placeholder="رابط الوثيقة أو ارفع ملف"
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                {isUploadingFreelance ? 'جاري الرفع...' : 'رفع ملف'}
                <input type="file" accept=".pdf,image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], setFreelanceDocUrl, setIsUploadingFreelance)}
                  disabled={isUploadingFreelance} />
              </label>
            </div>
            {normalizeUrl(freelanceDocUrl) && (
              <a href={normalizeUrl(freelanceDocUrl)!} target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-600 underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> عرض الوثيقة
              </a>
            )}
          </div>

          {/* Commercial Registration */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              السجل التجاري
              {(commercialRegUrl || ticket.commercialRegUrl) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> تم الرفع
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commercialRegUrl}
                onChange={e => setCommercialRegUrl(e.target.value)}
                placeholder="رابط السجل أو ارفع ملف"
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                {isUploadingCommercial ? 'جاري الرفع...' : 'رفع ملف'}
                <input type="file" accept=".pdf,image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], setCommercialRegUrl, setIsUploadingCommercial)}
                  disabled={isUploadingCommercial} />
              </label>
            </div>
            {normalizeUrl(commercialRegUrl) && (
              <a href={normalizeUrl(commercialRegUrl)!} target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-600 underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> عرض السجل
              </a>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={saveDocuments} disabled={isSavingDocs}
              className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors disabled:opacity-50">
              {isSavingDocs ? 'جاري الحفظ...' : 'حفظ الوثائق'}
            </button>
          </div>
        </div>
      </section>

      {/* د- قسم تحويل الطلب */}
      {hasAtLeastOneDoc && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5" /> تحويل الطلب للمرحلة التالية
          </h3>
          <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200 p-4 space-y-4">
            {/* SEO Person selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> اختيار مختص SEO
              </label>
              <select
                value={selectedSeoId}
                onChange={e => setSelectedSeoId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">اختر مختص SEO...</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - {ROLE_LABELS[s.role] || s.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Brief textarea */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">البريف (ملخص الطلب)</label>
              <textarea
                value={intakeBrief}
                onChange={e => setIntakeBrief(e.target.value)}
                placeholder="اكتب ملخصاً شاملاً عن الطلب وما يجب الانتباه له..."
                rows={4}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
              />
            </div>

            {/* Custom SLA */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> SLA مخصص (بالساعات)
              </label>
              <input
                type="number"
                min={1}
                value={customSlaHours}
                onChange={e => setCustomSlaHours(e.target.value)}
                placeholder="اتركه فارغاً لاستخدام الافتراضي (168 ساعة)"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                dir="ltr"
              />
            </div>

            {/* Transfer button */}
            <button
              onClick={transferToNextStage}
              disabled={isTransferring || !selectedSeoId || !intakeBrief.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTransferring ? (
                <><Clock className="w-4 h-4 animate-spin" /> جاري التحويل...</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> تحويل للمرحلة التالية (إعدادات SEO)</>
              )}
            </button>
          </div>
        </section>
      )}
    </>
  );
}



export function TicketDetailPanel({ ticket, staff, userRole, userId, headers, onClose, onRefresh }: Props) {
  const [checklist, setChecklist] = useState<any[]>([]);
  const [notes, setNotes] = useState(ticket.staffNotes || '');
  const [assets, setAssets] = useState(ticket.assetsUrl || '');


  // Legal Processing states
  const [legalDocUrl, setLegalDocUrl] = useState('');
  const [domainName, setDomainName] = useState('');
  const [sallaStoreUrl, setSallaStoreUrl] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [isUploadingLegal, setIsUploadingLegal] = useState(false);

  // Design Files states
  const [designLogoUrl, setDesignLogoUrl] = useState('');
  const [designBanners, setDesignBanners] = useState<string[]>([]);
  const [designCategoriesUrl, setDesignCategoriesUrl] = useState('');
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [isUploadingDesign, setIsUploadingDesign] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Designer approval workflow states
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isMovingToDev, setIsMovingToDev] = useState(false);
  const [designerActionError, setDesignerActionError] = useState<string | null>(null);
  const [designerActionSuccess, setDesignerActionSuccess] = useState<string | null>(null);

  // Developer complete-work states
  const [isCompletingWork, setIsCompletingWork] = useState(false);
  const [devCompleteError, setDevCompleteError]   = useState<string | null>(null);
  const [devCompleteSuccess, setDevCompleteSuccess] = useState<string | null>(null);

  // Account Manager review states
  const [amReviewAction, setAmReviewAction]   = useState<'APPROVE' | 'REVISE' | null>(null);
  const [amFeedback, setAmFeedback]           = useState('');
  const [amSiteUrl, setAmSiteUrl]             = useState('');
  const [isAmReviewing, setIsAmReviewing]     = useState(false);
  const [amReviewError, setAmReviewError]     = useState<string | null>(null);
  const [amReviewSuccess, setAmReviewSuccess] = useState<string | null>(null);

  // Emergency Transfer state (ADMIN only)
  const [emergencyStage, setEmergencyStage] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [isEmergencyTransferring, setIsEmergencyTransferring] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  // Document approval state (ADMIN / ACCOUNT_MANAGER only)
  const [isApprovingDocs, setIsApprovingDocs] = useState(false);
  const [docsApproved, setDocsApproved]       = useState<boolean>(ticket.client?.docsApproved ?? false);

  // Logo type image
  const [logoTypeImageUrl, setLogoTypeImageUrl] = useState<string | null>(null);

  useEffect(() => {
    try { setChecklist(JSON.parse(ticket.checklists || '[]')); } catch { setChecklist([]); }
    setNotes(ticket.staffNotes || '');
    setAssets(ticket.assetsUrl || '');

    // Init legal states
    setLegalDocUrl(ticket.client?.documentFileUrl || ticket.client?.legalDocUrl || '');
    setDomainName(ticket.storeDetails?.domainName || '');
    setSallaStoreUrl(ticket.storeDetails?.sallaStoreUrl || '');
    setStoreEmail(ticket.storeDetails?.storeEmail || '');
    setStorePassword('');

    // Init design states
    setDesignLogoUrl(ticket.designLogoUrl || '');
    try {
      setDesignBanners(JSON.parse(ticket.designBannersUrl || '[]'));
    } catch {
      setDesignBanners(ticket.designBannersUrl ? [ticket.designBannersUrl] : []);
    }
    setDesignCategoriesUrl(ticket.designCategoriesUrl || '');

    // Fetch logo type image
    if (ticket.aiProposal?.selectedLogoType) {
      fetch(`${API}/api/logo-types`, { headers }).then(r => r.json()).then((types: any[]) => {
        const match = types.find((t: any) => t.id === ticket.aiProposal.selectedLogoType);
        if (match?.imageUrl) setLogoTypeImageUrl(match.imageUrl);
      }).catch(() => {});
    }
  }, [ticket]);

  const cfg = STAGE_CONFIG[ticket.stage] || STAGE_CONFIG.INTAKE;


  const { showToast } = useToast();

  const togglePassword = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/toggle-password`, { method: 'PUT', headers });
    showToast(ticket.amPasswordVisibility ? 'تم إخفاء كلمة المرور' : 'تم تفعيل كلمة المرور للمطورين');
    onRefresh();
  };

  const acceptTask = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/accept`, { method: 'PUT', headers });
    showToast('تم قبول المهمة بنجاح ✅');
    onRefresh();
  };

  const saveNotes = async () => {
    await fetch(`${API}/api/staff/tickets/${ticket.id}/notes`, {
      method: 'PUT', headers, body: JSON.stringify({ staffNotes: notes, assetsUrl: assets }),
    });
    showToast('تم حفظ الملاحظات بنجاح ✅');
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

  const uploadLegalDoc = async (file: File) => {
    setIsUploadingLegal(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const fileData = await base64Promise;

      const res = await fetch(`${API}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData })
      });
      if (res.ok) {
        const { url } = await res.json();
        setLegalDocUrl(url);
      }
    } finally {
      setIsUploadingLegal(false);
    }
  };

  const saveLegalData = async () => {
    const missing = [];
    if (!legalDocUrl) missing.push('وثيقة العمل الحر');
    if (!domainName) missing.push('اسم الدومين');
    if (!sallaStoreUrl) missing.push('رابط متجر سلة / زد');
    if (!storeEmail) missing.push('إيميل المتجر');
    
    if (missing.length > 0) {
      return setErrorModal(`الرجاء تعبئة الحقول التالية قبل الحفظ:\n- ${missing.join('\n- ')}`);
    }

    setIsSavingLegal(true);
    try {
      const res = await fetch(`${API}/api/staff/tickets/${ticket.id}/legal-processing`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          documentFileUrl: legalDocUrl,
          domainName,
          sallaStoreUrl,
          storeEmail,
          storePassword
        })
      });
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل الحفظ');
      }
    } finally {
      setIsSavingLegal(false);
    }
  };

  const uploadDesignFile = async (file: File, setter: (url: string) => void) => {
    setIsUploadingDesign(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const fileData = await base64Promise;

      const res = await fetch(`${API}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData })
      });
      if (res.ok) {
        const { url } = await res.json();
        setter(url);
      }
    } finally {
      setIsUploadingDesign(false);
    }
  };

  const saveDesignFiles = async () => {
    const missing = [];
    if (!designLogoUrl) missing.push('شعار المتجر');
    const validBanners = designBanners.filter(b => b.trim() !== '');
    if (validBanners.length === 0) missing.push('البنرات');
    // Categories are optional

    if (missing.length > 0) {
      return setErrorModal(`الرجاء تعبئة الحقول التالية قبل الحفظ:\n- ${missing.join('\n- ')}`);
    }

    setIsSavingDesign(true);
    try {
      const res = await fetch(`${API}/api/staff/tickets/${ticket.id}/design-files`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          designLogoUrl,
          designBannersUrl: JSON.stringify(validBanners),
          designCategoriesUrl
        })
      });
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        setErrorModal(err.error || 'فشل الحفظ');
      }
    } finally {
      setIsSavingDesign(false);
    }
  };

  const submitForApproval = async () => {
    setIsSubmittingApproval(true);
    setDesignerActionError(null);
    setDesignerActionSuccess(null);
    try {
      const res = await fetch(`${API}/api/designer/submit-for-approval`, {
        method: 'POST', headers, body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDesignerActionSuccess('تم إرسال التصاميم للعميل بنجاح. الحالة الآن: بانتظار اعتماد العميل.');
        onRefresh();
      } else {
        setDesignerActionError(data.error || 'فشل الإرسال');
      }
    } catch {
      setDesignerActionError('تعذر الاتصال بالخادم');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const moveToDevelopment = async () => {
    setIsMovingToDev(true);
    setDesignerActionError(null);
    setDesignerActionSuccess(null);
    try {
      const res = await fetch(`${API}/api/designer/move-to-development`, {
        method: 'POST', headers, body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDesignerActionSuccess('تم تحويل الطلب إلى مرحلة التطوير بنجاح!');
        onRefresh();
      } else {
        setDesignerActionError(data.error || 'فشل التحويل');
      }
    } catch {
      setDesignerActionError('تعذر الاتصال بالخادم');
    } finally {
      setIsMovingToDev(false);
    }
  };

  // ── Developer: complete work → send to AM ──────────────────
  const completeWork = async () => {
    setIsCompletingWork(true);
    setDevCompleteError(null);
    setDevCompleteSuccess(null);
    try {
      const res = await fetch(`${API}/api/developer/complete-work`, {
        method: 'POST', headers, body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDevCompleteSuccess('تم إرسال الطلب لمدير الحساب للمراجعة بنجاح!');
        onRefresh();
      } else {
        setDevCompleteError(data.error || 'فشل الإرسال');
      }
    } catch {
      setDevCompleteError('تعذر الاتصال بالخادم');
    } finally {
      setIsCompletingWork(false);
    }
  };

  // ── Account Manager: approve or revise developer work ──────
  const submitAmReview = async () => {
    if (!amReviewAction) return;
    if (amReviewAction === 'REVISE' && !amFeedback.trim()) {
      setAmReviewError('يرجى كتابة ملاحظات التعديل المطلوبة.');
      return;
    }
    setIsAmReviewing(true);
    setAmReviewError(null);
    setAmReviewSuccess(null);
    try {
      const res = await fetch(`${API}/api/am/review-development`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ticketId: ticket.id,
          action: amReviewAction,
          feedback: amFeedback,
          siteUrl: amSiteUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAmReviewSuccess(
          amReviewAction === 'APPROVE'
            ? '🎉 تمت الموافقة النهائية! تم تسليم الطلب للعميل وإغلاقه.'
            : 'تم إرسال ملاحظات التعديل للمطوّر بنجاح.'
        );
        setAmReviewAction(null);
        setAmFeedback('');
        setAmSiteUrl('');
        onRefresh();
      } else {
        setAmReviewError(data.error || 'فشل الإرسال');
      }
    } catch {
      setAmReviewError('تعذر الاتصال بالخادم');
    } finally {
      setIsAmReviewing(false);
    }
  };

  // ── Approve extraction documents (ADMIN / AM only) ──────────────────────
  const approveDocuments = async () => {
    setIsApprovingDocs(true);
    try {
      const res = await fetch(`${API}/api/staff/tickets/${ticket.id}/approve-docs`, {
        method: 'PUT', headers,
      });
      if (res.ok) {
        setDocsApproved(true);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorModal(err.error || 'فشل اعتماد الوثائق');
      }
    } catch {
      setErrorModal('تعذر الاتصال بالخادم');
    } finally {
      setIsApprovingDocs(false);
    }
  };

  const isAssignedToMe =

    ticket.accountManagerId === userId ||
    ticket.designerId === userId ||
    ticket.developerId === userId ||
    ticket.seoSpecialistId === userId;

  // Parse colors once
  let brandColors: string[] = [];
  try { brandColors = JSON.parse(ticket.aiProposal?.selectedColors || '[]'); } catch {}
  let referenceLogos: string[] = [];
  try { referenceLogos = JSON.parse(ticket.aiProposal?.referenceLogos || '[]'); } catch {}

  return (
    <>
      {errorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">تنبيه</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{errorModal}</p>
            </div>
            <button
              onClick={() => setErrorModal(null)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md"
            >
              حسنًا، فهمت
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex" dir="rtl">
        <div className="hidden sm:block flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full sm:max-w-xl lg:max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col font-sans relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-900 text-base sm:text-lg truncate">{ticket.client?.customerName}</h2>
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
          <button onClick={onClose} className="p-2.5 sm:p-2 hover:bg-slate-100 rounded-xl transition-colors shrink-0"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1">
          {/* SLA */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${ticket.slaBreached ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
            {ticket.slaBreached ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" /> : <Clock className="w-5 h-5 text-slate-400 shrink-0" />}
            <div className="flex-1">
              <p className={`text-xs font-bold ${ticket.slaBreached ? 'text-red-700' : 'text-slate-600'}`}>
                {ticket.slaBreached ? '⚠️ تجاوز الـ SLA' : `متبقي: ${ticket.slaRemainingHours}h`}
                {ticket.customSlaHours
                  ? <span className="text-[10px] font-normal mr-2">(SLA مخصص: {ticket.customSlaHours} ساعة)</span>
                  : <span className="text-[10px] font-normal mr-2">(SLA افتراضي)</span>
                }
              </p>
              <p className="text-[10px] text-slate-400">دخل المرحلة: {fmtDate(ticket.stageEnteredAt)}</p>
              {ticket.staffAcceptedAt && <p className="text-[10px] text-emerald-600">✓ تم القبول: {fmtDate(ticket.staffAcceptedAt)}</p>}
            </div>
          </div>

          {/* Accept Task */}
          {isAssignedToMe && !ticket.staffAcceptedAt && (
            <button onClick={acceptTask} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <CheckSquare className="w-4 h-4" /> قبول المهمة
            </button>
          )}

          {(() => {
            const allInstructions: Array<{ role: string; text?: string | null }> = [
              { role: 'ACCOUNT_MANAGER', text: ticket.amInstructions },
              { role: 'DESIGNER', text: ticket.designerInstructions },
              { role: 'DEVELOPER', text: ticket.developerInstructions },
              { role: 'SEO', text: ticket.seoInstructions },
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

          {/* ══════════ INTAKE STAGE — AM Tools ══════════ */}
          {ticket.stage === 'INTAKE' && ['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole) && (() => {
            // INTAKE management states are declared inside the IIFE to avoid conditional hook rules
            return <IntakeSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />;
          })()}





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




          {/* Display Design Files for others (AM, ADMIN, SEO, etc) if they exist */}
          {(ticket.designLogoUrl || ticket.designBannersUrl || ticket.designCategoriesUrl) && (

            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">التصاميم المعتمدة</h3>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {normalizeUrl(ticket.designLogoUrl) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400">شعار المتجر</span>
                    <a href={normalizeUrl(ticket.designLogoUrl)!} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
                      <Palette className="w-5 h-5 text-violet-400 group-hover:text-violet-600" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1">استعراض الملف</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                )}
                
                {(() => {
                  let banners: string[] = [];
                  try { banners = JSON.parse(ticket.designBannersUrl || '[]'); } catch { banners = ticket.designBannersUrl ? [ticket.designBannersUrl] : []; }
                  return banners.map((b, idx) => {
                    const bannerUrl = normalizeUrl(b);
                    return bannerUrl ? (
                    <div key={`banner-${idx}`} className="space-y-1.5">
                      <span className="text-[10px] text-slate-400">البنرات {banners.length > 1 ? `(${idx + 1})` : ''}</span>
                      <a href={bannerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
                        <Palette className="w-5 h-5 text-violet-400 group-hover:text-violet-600" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1">استعراض الملف</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    </div>
                  ) : null;
                  });
                })()}

                {normalizeUrl(ticket.designCategoriesUrl) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400">صور الأقسام</span>
                    <a href={normalizeUrl(ticket.designCategoriesUrl)!} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
                      <Palette className="w-5 h-5 text-violet-400 group-hover:text-violet-600" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1">استعراض الملف</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                )}
              </div>
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
                    ? <a href={ensureUrl(ticket.storeDetails.sallaStoreUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1 truncate">{ticket.storeDetails.sallaStoreUrl} <ExternalLink className="w-3 h-3 shrink-0" /></a>
                    : <span className="text-xs text-slate-400">—</span>}
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">الدومين</span>
                  {ticket.storeDetails.domainName
                    ? <span className="text-xs font-medium text-slate-800 truncate">{ticket.storeDetails.domainName}</span>
                    : <span className="text-xs text-slate-400">—</span>}
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">إيميل المتجر</span>
                  {ticket.storeDetails.storeEmail
                    ? <span className="text-xs font-medium text-slate-800 truncate">{ticket.storeDetails.storeEmail}</span>
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


          {/* ── Client Info + Legal Documents ─────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">بيانات العميل</h3>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
              {[
                { icon: User,       label: 'الاسم',    value: ticket.client?.customerName },
                { icon: Mail,       label: 'البريد',   value: ticket.client?.email },
                { icon: Phone,      label: 'الجوال',   value: ticket.client?.phone },
                { icon: CreditCard, label: 'الهوية',   value: ticket.client?.nationalId },
                { icon: CreditCard, label: 'الآيبان',  value: ticket.client?.iban },
                { icon: Palette,    label: 'المجال',   value: ticket.client?.industry },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
                  <span className="text-xs font-semibold text-slate-800 truncate">{value || '—'}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Legal Documents Section (ADMIN + AM only) ────────── */}
          {['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole) && (() => {
            const c = ticket.client;
            if (!c) return null;

            // Smart detection: even if needsLegalExtraction wasn't saved correctly,
            // if client has nationalIdUrl or fullNameInId, they need extraction
            const hasExtractionData = !!(c.nationalIdUrl || c.fullNameInId || c.absherPhone);
            const needsExtract = c.needsLegalExtraction === true || (hasExtractionData && !c.hasLegalDoc);
            const hasDoc       = c.hasLegalDoc === true || c.hasDocument === true;
            const docUrl       = c.legalDocUrl || c.documentFileUrl;
            const idUrl        = c.nationalIdUrl;
            const approved     = docsApproved || c.docsApproved;

            // Don't show section if there's nothing to display
            if (!needsExtract && !docUrl) return null;

            return (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">الوثائق القانونية</h3>
                  {needsExtract && (
                    approved
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> تم الاعتماد</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> قيد المراجعة</span>
                  )}
                </div>

                {/* Has legal doc → show link */}
                {hasDoc && normalizeUrl(docUrl) && (
                  <a href={normalizeUrl(docUrl)!} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-800">الوثيقة / السجل التجاري</p>
                      <p className="text-[10px] text-blue-500 truncate">{docUrl}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                  </a>
                )}

                {/* Needs extraction → show extraction fields */}
                {needsExtract && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
                    <p className="text-xs font-bold text-amber-700">⚠️ العميل يحتاج استخراج وثيقة — البيانات المقدَّمة:</p>
                    {[
                      { label: 'الاسم في الهوية', value: c.fullNameInId },
                      { label: 'جوال أبشر',       value: c.absherPhone },
                    ].map(({ label, value }) => value ? (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-[10px] text-amber-600 w-28 shrink-0">{label}</span>
                        <span className="text-xs font-semibold text-amber-900">{value}</span>
                      </div>
                    ) : null)}

                    {normalizeUrl(idUrl) && (
                      <a href={normalizeUrl(idUrl)!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors mt-1">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-800">صورة الهوية المرفوعة</p>
                          <p className="text-[10px] text-amber-500 truncate">{idUrl}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      </a>
                    )}

                    {/* Approve Docs Button */}
                    {!approved && (
                      <button
                        onClick={approveDocuments}
                        disabled={isApprovingDocs}
                        className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isApprovingDocs ? 'جاري الاعتماد...' : 'اعتماد الوثائق والموافقة عليها'}
                      </button>
                    )}
                  </div>
                )}

                {/* Has doc, not extraction */}
                {!needsExtract && !docUrl && (
                  <p className="text-xs text-slate-400 italic">لا توجد وثائق مرفوعة حتى الآن.</p>
                )}
              </section>
            );
          })()}

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
                {ticket.aiProposal.selectedLogoTypeName && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">نوع الشعار المفضل</span>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200">
                      {logoTypeImageUrl && <img src={logoTypeImageUrl} alt="" className="w-8 h-8 rounded-md object-contain bg-slate-900 p-0.5" />}
                      <span className="text-xs font-bold text-violet-700">🎨 {ticket.aiProposal.selectedLogoTypeName}</span>
                    </div>
                  </div>
                )}
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
                {normalizeUrl(ticket.aiProposal.generatedLogoUrl) && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">الشعار</span>
                    <div className="flex items-center gap-3">
                      <img src={normalizeUrl(ticket.aiProposal.generatedLogoUrl)!} alt="logo" className="w-16 h-16 object-contain rounded-xl border bg-white p-2" />
                      <a href={normalizeUrl(ticket.aiProposal.generatedLogoUrl)!} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1 hover:underline"><Download className="w-3.5 h-3.5" /> عرض / تحميل</a>
                    </div>
                  </div>
                )}
                {referenceLogos.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">صور الإلهام المرفوعة</span>
                    <div className="flex flex-wrap gap-2">
                      {referenceLogos.map((url: string, i: number) => {
                        const nUrl = normalizeUrl(url);
                        if (!nUrl) return null;
                        return (
                        <a
                          key={`${url}-${i}`}
                          href={nUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-20 h-20 rounded-xl border border-slate-200 bg-white p-1 hover:shadow-sm transition-shadow"
                        >
                          <img src={nUrl} alt={`reference-${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                        </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Legal Doc Link — Task 3 */}
          {normalizeUrl(ticket.client?.legalDocUrl) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">المستندات القانونية</h3>
              <a href={normalizeUrl(ticket.client.legalDocUrl)!} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors">
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
            <button onClick={saveNotes} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer">حفظ الملاحظات</button>
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


          {ticket.stage === 'SEO_STORE_SETUP' && (
            <SeoStageSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* ── DESIGN Stage — Designer Upload / SEO & Client Review ──── */}
          {ticket.stage === 'DESIGN' && (
            <DesignSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* ── DEVELOPMENT Stage — Dev Checklist / SEO Review ─────── */}
          {ticket.stage === 'DEVELOPMENT' && (
            <DevSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* ── SEO_FINAL Stage — Final Checklist / Delivery ────────── */}
          {ticket.stage === 'SEO_FINAL' && (
            <SeoFinalSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* ── Emergency Transfer — ADMIN Only ────────────────── */}
          {userRole === 'ADMIN' && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> تحويل طوارئ (مدير النظام)
              </h3>
              <div className="bg-slate-50 rounded-2xl border border-red-200/60 p-4 space-y-3">
                <select
                  value={emergencyStage}
                  onChange={e => setEmergencyStage(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="">اختر المرحلة...</option>
                  {STAGES_ORDER.filter(s => s !== ticket.stage).map(s => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </select>
                <textarea
                  value={emergencyReason}
                  onChange={e => setEmergencyReason(e.target.value)}
                  placeholder="سبب التحويل الطارئ (مطلوب)..."
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
                {emergencyError && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-700">{emergencyError}</p>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!emergencyStage || !emergencyReason.trim()) return;
                    setIsEmergencyTransferring(true);
                    setEmergencyError(null);
                    try {
                      const res = await fetch(`${API}/api/tickets/${ticket.id}/emergency-transfer`, {
                        method: 'PUT', headers,
                        body: JSON.stringify({ stage: emergencyStage, reason: emergencyReason.trim() }),
                      });
                      if (res.ok) {
                        setEmergencyStage('');
                        setEmergencyReason('');
                        onRefresh();
                      } else {
                        const err = await res.json();
                        setEmergencyError(err.error || 'فشل التحويل');
                      }
                    } catch {
                      setEmergencyError('تعذر الاتصال بالخادم');
                    } finally {
                      setIsEmergencyTransferring(false);
                    }
                  }}
                  disabled={isEmergencyTransferring || !emergencyStage || !emergencyReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {isEmergencyTransferring ? 'جاري التحويل...' : 'تحويل طوارئ'}
                </button>
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
                        if (d.reason) return <p className="text-[10px] text-red-500 mt-0.5">السبب: {d.reason}</p>;
                        if (d.from && d.to) return <p className="text-[10px] text-slate-400 mt-0.5">{STAGE_CONFIG[d.from]?.label || d.from} ← {STAGE_CONFIG[d.to]?.label || d.to}</p>;
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
    </>
  );
}
