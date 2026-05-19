import { useEffect, useMemo, useState } from 'react';
import {
  X, Clock, AlertTriangle, Shield, Lock, User, Mail, Phone,
  CreditCard, Palette, Globe, ExternalLink, CheckSquare, Square,
  FileText, Eye, EyeOff, MessageSquare, Link2, Download, XCircle,
  Timer, AlertCircle, Send, CheckCircle2, Users, ArrowRight
} from 'lucide-react';

import { API_URL } from '../../config/api';

const API = API_URL;

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  INTAKE:                   { label: 'استلام الطلب',           color: 'text-sky-700',      bg: 'bg-sky-50 border-sky-200',         dot: 'bg-sky-500' },
  LEGAL_PROCESSING:         { label: 'المعالجة القانونية', color: 'text-amber-700',    bg: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-500' },
  DESIGN:                   { label: 'التصميم',             color: 'text-violet-700',   bg: 'bg-violet-50 border-violet-200',   dot: 'bg-violet-500' },
  PENDING_CLIENT_APPROVAL:  { label: 'بانتظار اعتماد العميل', color: 'text-purple-700',   bg: 'bg-purple-50 border-purple-200',   dot: 'bg-purple-500' },
  CLIENT_APPROVED:          { label: 'معتمد من العميل',      color: 'text-emerald-700',  bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  CLIENT_REVISION:          { label: 'طلب تعديل من العميل',  color: 'text-red-700',      bg: 'bg-red-50 border-red-200',         dot: 'bg-red-500' },
  DEVELOPMENT:              { label: 'التطوير',            color: 'text-blue-700',     bg: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-500' },
  PENDING_AM_REVIEW:        { label: 'بانتظار مراجعة مدير الحساب', color: 'text-orange-700',   bg: 'bg-orange-50 border-orange-200',   dot: 'bg-orange-500' },
  DEVELOPMENT_REVISION:     { label: 'تعديل من مدير الحساب',   color: 'text-red-700',      bg: 'bg-red-50 border-red-200',         dot: 'bg-red-500' },
  REVIEW:                   { label: 'المراجعة',           color: 'text-orange-700',   bg: 'bg-orange-50 border-orange-200',   dot: 'bg-orange-500' },
  DELIVERED:                { label: 'تم التسليم',         color: 'text-emerald-700',  bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
};
const STAGES_ORDER = ['INTAKE','LEGAL_PROCESSING','DESIGN','PENDING_CLIENT_APPROVAL','CLIENT_APPROVED','CLIENT_REVISION','DEVELOPMENT','PENDING_AM_REVIEW','DEVELOPMENT_REVISION','REVIEW','DELIVERED'];

const canChangeStage = (r: string) => ['ADMIN','ACCOUNT_MANAGER','DESIGNER'].includes(r);
const canAssign      = (r: string) => ['ADMIN','ACCOUNT_MANAGER','DESIGNER'].includes(r);
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
  DESIGN_SUBMITTED_FOR_APPROVAL: 'إرسال التصاميم للعميل',
  MOVED_TO_DEVELOPMENT: 'تحويل للتطوير',
  DEVELOPER_COMPLETED: 'إنهاء المطوّر للعمل',
  AM_APPROVED_DEVELOPMENT: 'موافقة مدير الحساب',
  AM_APPROVED_DELIVERED: 'موافقة نهائية وتسليم',
  AM_REQUESTED_REVISION: 'طلب تعديل من مدير الحساب',
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

  // Document approval state (ADMIN / ACCOUNT_MANAGER only)
  const [isApprovingDocs, setIsApprovingDocs] = useState(false);
  const [docsApproved, setDocsApproved]       = useState<boolean>(ticket.client?.docsApproved ?? false);

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
  }, [ticket]);

  const cfg = STAGE_CONFIG[ticket.stage] || STAGE_CONFIG.INTAKE;

  const changeStage = async (stage: string) => {
    const res = await fetch(`${API}/api/tickets/${ticket.id}/stage`, {
      method: 'PUT', headers, body: JSON.stringify({ stage }),
    });
    if (res.ok) onRefresh();
    else { const err = await res.json(); setErrorModal(err.error || 'فشل'); }
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
      setErrorModal(err.error || 'فشل حفظ التعيين');
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

          {/* Legal Processing Form for AM / ADMIN */}
          {canAssign(userRole) && ticket.stage === 'LEGAL_PROCESSING' && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider">البيانات القانونية وإعداد المتجر (مدير الحساب)</h3>
              <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">وثيقة العمل الحر</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={legalDocUrl} onChange={e => setLegalDocUrl(e.target.value)} placeholder="رابط الوثيقة" className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                      {isUploadingLegal ? 'جاري الرفع...' : 'رفع ملف'}
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLegalDoc(e.target.files[0])} disabled={isUploadingLegal} />
                    </label>
                  </div>
                  {legalDocUrl && <a href={legalDocUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">عرض الوثيقة الحالية</a>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">اسم الدومين</label>
                  <input type="text" value={domainName} onChange={e => setDomainName(e.target.value)} placeholder="مثال: mystore.com" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">رابط متجر سلة / زد</label>
                  <input type="url" value={sallaStoreUrl} onChange={e => setSallaStoreUrl(e.target.value)} placeholder="رابط المتجر" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">إيميل المتجر</label>
                  <input type="email" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="store@mystore.com" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">كلمة مرور المتجر</label>
                  <input type="text" value={storePassword} onChange={e => setStorePassword(e.target.value)} placeholder="أدخل كلمة المرور لتحديثها" className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  {ticket.storeDetails?.storePasswordEncrypted && <p className="text-[10px] text-slate-400">ملاحظة: المتجر لديه كلمة مرور محفوظة بالفعل. أدخل لتحديثها.</p>}
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={saveLegalData} disabled={isSavingLegal} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors">
                    {isSavingLegal ? 'جاري الحفظ...' : 'حفظ البيانات القانونية'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Design Files Form for Designer */}
          {(userRole === 'DESIGNER' || userRole === 'ADMIN') && ['DESIGN', 'CLIENT_REVISION'].includes(ticket.stage) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-violet-600 uppercase tracking-wider">ملفات التصميم للعميل</h3>
              <div className="bg-violet-50/50 rounded-2xl border border-violet-200 p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">شعار المتجر</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={designLogoUrl} onChange={e => setDesignLogoUrl(e.target.value)} placeholder="رابط الملف / مجلد درايف" className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                      {isUploadingDesign ? 'جاري الرفع...' : 'رفع ملف'}
                      <input type="file" accept="image/*,.pdf,.zip" className="hidden" onChange={e => e.target.files?.[0] && uploadDesignFile(e.target.files[0], setDesignLogoUrl)} disabled={isUploadingDesign} />
                    </label>
                    <button onClick={() => setDesignLogoUrl('')} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-xl" title="إلغاء الملف">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  {designLogoUrl && <a href={designLogoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-violet-600 underline">عرض الملف المرفق</a>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">البنرات</label>
                  {designBanners.map((banner, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input type="text" value={banner} onChange={e => { const nb = [...designBanners]; nb[idx] = e.target.value; setDesignBanners(nb); }} placeholder="رابط البنر" className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                      <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                        رفع
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadDesignFile(e.target.files[0], url => { const nb = [...designBanners]; nb[idx] = url; setDesignBanners(nb); })} disabled={isUploadingDesign} />
                      </label>
                      <button onClick={() => setDesignBanners(designBanners.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-xl">
                        <XCircle className="w-4 h-4" />
                      </button>
                      {banner && <a href={banner} target="_blank" rel="noreferrer" className="text-[10px] text-violet-600 underline shrink-0 w-12 text-center">عرض</a>}
                    </div>
                  ))}
                  <button onClick={() => setDesignBanners([...designBanners, ''])} className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100">
                    <span className="text-lg leading-none mb-0.5">+</span> إضافة بنر آخر
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">صور الأقسام <span className="text-slate-400 font-normal">(اختياري)</span></label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={designCategoriesUrl} onChange={e => setDesignCategoriesUrl(e.target.value)} placeholder="رابط الملف / مجلد درايف" className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    <label className="cursor-pointer bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                      {isUploadingDesign ? 'جاري الرفع...' : 'رفع ملف'}
                      <input type="file" accept="image/*,.pdf,.zip" className="hidden" onChange={e => e.target.files?.[0] && uploadDesignFile(e.target.files[0], setDesignCategoriesUrl)} disabled={isUploadingDesign} />
                    </label>
                    <button onClick={() => setDesignCategoriesUrl('')} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-xl" title="إلغاء الملف">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  {designCategoriesUrl && <a href={designCategoriesUrl} target="_blank" rel="noreferrer" className="text-[10px] text-violet-600 underline">عرض الملف المرفق</a>}
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={saveDesignFiles} disabled={isSavingDesign} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors">
                    {isSavingDesign ? 'جاري الحفظ...' : 'حفظ ملفات التصميم'}
                  </button>
                </div>

                {/* Submit to Client for Approval */}
                {(ticket.stage === 'DESIGN' || ticket.stage === 'CLIENT_REVISION') && ticket.designLogoUrl && (
                  <div className="pt-3 border-t border-violet-100">
                    {designerActionSuccess && (
                      <div className="mb-3 flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-xs text-emerald-700 font-bold">{designerActionSuccess}</p>
                      </div>
                    )}
                    {designerActionError && (
                      <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700">{designerActionError}</p>
                      </div>
                    )}
                    <button
                      onClick={submitForApproval}
                      disabled={isSubmittingApproval}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSubmittingApproval ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {isSubmittingApproval ? 'جاري الإرسال...' : '📤 إرسال التصاميم للعميل للاعتماد'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CLIENT_REVISION — Show client feedback to designer */}
          {ticket.stage === 'CLIENT_REVISION' && (userRole === 'DESIGNER' || userRole === 'ADMIN') && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" /> طلب تعديل من العميل
              </h3>
              <div className="bg-red-50/60 rounded-2xl border border-red-200 p-4 space-y-3">
                <p className="text-xs text-red-800 font-bold">الحالة: العميل طلب تعديلات على التصاميم</p>
                {ticket.staffNotes && (() => {
                  const match = ticket.staffNotes.match(/--- تعليق العميل \(طلب تعديل تصميم\) ---\n([\s\S]*?)(?=$|\n---)/g);
                  const comments = match ? match.map((m: string) => m.replace(/--- تعليق العميل \(طلب تعديل تصميم\) ---\n/, '').trim()) : [];
                  return comments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ملاحظات العميل:</p>
                      {comments.map((c: string, i: number) => (
                        <div key={i} className="p-3 bg-white rounded-xl border border-red-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {c}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
                <p className="text-[11px] text-red-700">يرجى تنفيذ التعديلات المطلوبة، ثم تحديث ملفات التصميم في القسم أعلاه، وبعدها أرسل التصاميم للعميل مجدداً.</p>
              </div>
            </section>
          )}

          {/* CLIENT_APPROVED — Designer assigns developer and moves to DEVELOPMENT */}
          {ticket.stage === 'CLIENT_APPROVED' && (userRole === 'DESIGNER' || userRole === 'ADMIN') && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> التصاميم معتمدة من العميل
              </h3>
              <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-4 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-emerald-100 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">اعتمد العميل التصاميم بنجاح ✅</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">الخطوة التالية: تعيين مطوّر من فريق البرمجة ثم تحويل الطلب للتطوير</p>
                  </div>
                </div>

                {/* Developer assignment status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">المطوّر المعيّن:</span>
                    {ticket.developer ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                        ✓ {ticket.developer.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                        ⚠️ لم يُعيَّن بعد
                      </span>
                    )}
                  </div>
                  {!ticket.developer && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      يرجى تعيين مطوّر من قسم "تعيين الفريق" أعلاه، ثم العودة هنا للتحويل للتطوير.
                    </p>
                  )}
                </div>

                {designerActionSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-700 font-bold">{designerActionSuccess}</p>
                  </div>
                )}
                {designerActionError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700">{designerActionError}</p>
                  </div>
                )}

                <button
                  onClick={moveToDevelopment}
                  disabled={isMovingToDev || !ticket.developerId}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMovingToDev ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  {isMovingToDev ? 'جاري التحويل...' : '🚀 تحويل الطلب إلى التطوير'}
                </button>
              </div>
            </section>
          )}

          {/* Display Design Files for others (AM, ADMIN, QA, etc) if they exist */}
          {(ticket.designLogoUrl || ticket.designBannersUrl || ticket.designCategoriesUrl) && (

            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">التصاميم المعتمدة</h3>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {ticket.designLogoUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400">شعار المتجر</span>
                    <a href={ticket.designLogoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
                      <Palette className="w-5 h-5 text-violet-400 group-hover:text-violet-600" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1">استعراض الملف</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                )}
                
                {(() => {
                  let banners: string[] = [];
                  try { banners = JSON.parse(ticket.designBannersUrl || '[]'); } catch { banners = ticket.designBannersUrl ? [ticket.designBannersUrl] : []; }
                  return banners.map((b, idx) => b ? (
                    <div key={`banner-${idx}`} className="space-y-1.5">
                      <span className="text-[10px] text-slate-400">البنرات {banners.length > 1 ? `(${idx + 1})` : ''}</span>
                      <a href={b} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
                        <Palette className="w-5 h-5 text-violet-400 group-hover:text-violet-600" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1">استعراض الملف</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    </div>
                  ) : null);
                })()}

                {ticket.designCategoriesUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400">صور الأقسام</span>
                    <a href={ticket.designCategoriesUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-colors group">
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
                    ? <a href={ticket.storeDetails.sallaStoreUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1 truncate">{ticket.storeDetails.sallaStoreUrl} <ExternalLink className="w-3 h-3 shrink-0" /></a>
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
                {hasDoc && docUrl && (
                  <a href={docUrl} target="_blank" rel="noreferrer"
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

                    {idUrl && (
                      <a href={idUrl} target="_blank" rel="noreferrer"
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

          {/* ── Developer: Complete Work Section ───────────── */}
          {['DEVELOPER', 'ADMIN'].includes(userRole) &&
           ['DEVELOPMENT', 'DEVELOPMENT_REVISION'].includes(ticket.stage) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                إنهاء العمل وإرساله للمراجعة
              </h3>

              {/* Show AM revision notes if in DEVELOPMENT_REVISION */}
              {ticket.stage === 'DEVELOPMENT_REVISION' && ticket.staffNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> ملاحظات مدير الحساب
                  </p>
                  <p className="text-xs text-amber-700 whitespace-pre-wrap leading-relaxed">
                    {ticket.staffNotes.split('--- ملاحظات مدير الحساب').slice(-1)[0]?.replace(/\(طلب تعديل تطوير\) ---\n?/, '') || ticket.staffNotes}
                  </p>
                </div>
              )}

              {devCompleteSuccess ? (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm font-bold text-emerald-700">{devCompleteSuccess}</p>
                </div>
              ) : (
                <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-5 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    عند الانتهاء من العمل اضغط الزر أدناه لإرسال الطلب لمدير الحساب للمراجعة. 
                    سيتم إشعاره فوراً ليقوم بالمراجعة والموافقة.
                  </p>
                  {devCompleteError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-700">{devCompleteError}</p>
                    </div>
                  )}
                  <button
                    onClick={completeWork}
                    disabled={isCompletingWork}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-100 disabled:opacity-60"
                  >
                    {isCompletingWork ? (
                      <><Timer className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> تم الانتهاء — إرسال للمراجعة</>
                    )}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Account Manager: Review Developer Work ──────── */}
          {['ACCOUNT_MANAGER', 'ADMIN'].includes(userRole) &&
           ticket.stage === 'PENDING_AM_REVIEW' && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                مراجعة عمل المطوّر
              </h3>

              {amReviewSuccess ? (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm font-bold text-emerald-700">{amReviewSuccess}</p>
                </div>
              ) : (
                <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-5 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    أنهى المطوّر عمله وهو بانتظار مراجعتك. يمكنك الموافقة على العمل أو طلب تعديلات.
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setAmReviewAction('APPROVE'); setAmReviewError(null); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm border-2 transition-all ${
                        amReviewAction === 'APPROVE'
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> قبول العمل
                    </button>
                    <button
                      onClick={() => { setAmReviewAction('REVISE'); setAmReviewError(null); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm border-2 transition-all ${
                        amReviewAction === 'REVISE'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                          : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <Send className="w-4 h-4" /> طلب تعديل
                    </button>
                  </div>

                  {/* Site URL for approval */}
                  {amReviewAction === 'APPROVE' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> رابط الموقع المُسلَّم <span className="text-slate-400 font-normal">(اختياري)</span>
                      </label>
                      <input
                        type="url"
                        value={amSiteUrl}
                        onChange={e => setAmSiteUrl(e.target.value)}
                        placeholder="https://yourstore.salla.sa"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        dir="ltr"
                      />
                    </div>
                  )}

                  {/* Feedback for revision */}
                  {amReviewAction === 'REVISE' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-bold text-slate-700 block">ملاحظات التعديل المطلوبة</label>
                      <textarea
                        value={amFeedback}
                        onChange={e => setAmFeedback(e.target.value)}
                        placeholder="اذكر بوضوح ما يحتاج تعديله أو تحسينه..."
                        rows={4}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                      />
                    </div>
                  )}

                  {amReviewError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-700">{amReviewError}</p>
                    </div>
                  )}

                  {amReviewAction && (
                    <button
                      onClick={submitAmReview}
                      disabled={isAmReviewing}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-60 ${
                        amReviewAction === 'APPROVE'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                          : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100'
                      }`}
                    >
                      {isAmReviewing ? (
                        <><Timer className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
                      ) : amReviewAction === 'APPROVE' ? (
                        <><CheckCircle2 className="w-4 h-4" /> تأكيد الموافقة</>
                      ) : (
                        <><Send className="w-4 h-4" /> إرسال ملاحظات التعديل</>
                      )}
                    </button>
                  )}
                </div>
              )}
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
    </>
  );
}
