import { useEffect, useState } from 'react';
import {
  X, Clock, AlertTriangle, Shield, Lock, User, Mail, Phone,
  CreditCard, Palette, Globe, ExternalLink, CheckSquare, Square,
  FileText, Eye, EyeOff, MessageSquare, Link2, Download,
  AlertCircle, Send, CheckCircle2, Users, ArrowRight, Upload, Package
} from 'lucide-react';

import { API_URL } from '../../config/api';
import { normalizeUrl } from '../../utils/normalizeUrl';

import { SeoStageSection } from './SeoStageSection';
import { DesignSection } from './DesignSection';
import { DevSection } from './DevSection';
import { SeoFinalSection } from './SeoFinalSection';
import { useToast } from '../ui/Toast';
import { ensureUrl } from '../../utils/ensureUrl';
import { FlexibleTransferSection } from './FlexibleTransferSection';

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
function IntakeSection({ ticket, headers, staff, userRole: _userRole, onRefresh, setErrorModal }: {
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

  // Determine if client already uploaded their own documents
  const c = ticket.client || {};
  // Check ALL possible document sources: client-level fields + ticket-level fields
  const clientHasOwnDocs = c.hasLegalDoc === true || c.hasDocument === true || !!(c.documentFileUrl || c.legalDocUrl);
  const ticketHasDocs = !!(ticket.freelanceDocUrl || ticket.commercialRegUrl);
  // If neither client nor ticket has any docs → staff must upload docs here (mandatory)
  const needsStaffDocs = !clientHasOwnDocs && !ticketHasDocs && !hasAtLeastOneDoc;

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
    // Only require staff docs if client didn't provide their own
    if (needsStaffDocs && !freelanceDocUrl && !commercialRegUrl && !ticket.freelanceDocUrl && !ticket.commercialRegUrl) {
      return setErrorModal('العميل لا يملك وثيقة — يجب رفع وثيقة العمل الحر أو السجل التجاري قبل التحويل');
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
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingRequest ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
                <button
                  onClick={() => { setShowRequestForm(false); setNewMessage(''); }}
                  className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRequestForm(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> طلب بيانات إضافية
              </button>
              {dataRequests.some((dr: any) => !dr.isResolved && dr.fromRole === 'CUSTOMER') && (
                <button
                  onClick={approveIntake}
                  disabled={isApprovingIntake}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isApprovingIntake ? 'جاري الاعتماد...' : 'اعتماد بيانات العميل'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ج- قسم الوثائق الرسمية — يظهر فقط إذا العميل لا يملك وثيقة */}
      {needsStaffDocs && (
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> الوثائق الرسمية
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> إجباري — العميل لا يملك وثيقة
          </span>
        </h3>
        <div className="bg-red-50/30 rounded-2xl border-2 border-dashed border-red-300 p-4 space-y-4">
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
                className="flex-1 text-xs border border-red-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
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
                className="flex-1 text-xs border border-red-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
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

          {!hasAtLeastOneDoc && (
            <p className="text-[11px] text-red-600 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              يجب رفع وثيقة العمل الحر أو السجل التجاري قبل تحويل الطلب
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={saveDocuments} disabled={isSavingDocs}
              className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors disabled:opacity-50">
              {isSavingDocs ? 'جاري الحفظ...' : 'حفظ الوثائق'}
            </button>
          </div>
        </div>
      </section>
      )}
    </>
  );
}

// ═══════ Staff Data Requests Section — Cross-Stage (shows data requests on any stage) ═══════
function StaffDataRequestsSection({ ticket, headers, onRefresh }: {
  ticket: any; headers: Record<string, string>; onRefresh: () => void;
}) {
  const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const { showToast } = useToast();

  const ROLE_NAMES: Record<string, string> = {
    ACCOUNT_MANAGER: 'مدير الحساب',
    SEO: 'فريق SEO',
    ADMIN: 'مدير النظام',
    DESIGNER: 'المصمم',
    DEVELOPER: 'المطور',
    CUSTOMER: 'العميل',
  };

  const fetchRequests = () => {
    fetch(`${API}/api/tickets/${ticket.id}/data-requests`, { headers })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDataRequests(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [ticket.id]);

  const sendNewRequest = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/data-request`, {
        method: 'POST', headers, body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        const dr = await res.json();
        setDataRequests(prev => [...prev, dr]);
        setNewMessage('');
        setShowReplyForm(false);
        showToast('تم إرسال طلب البيانات للعميل ✅');
      }
    } catch {}
    finally { setIsSending(false); }
  };

  const resolveAll = async () => {
    setIsResolving(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/approve-intake`, {
        method: 'PUT', headers,
      });
      if (res.ok) {
        showToast('تم اعتماد البيانات وإغلاق المحادثة ✅');
        fetchRequests();
        onRefresh();
      }
    } catch {}
    finally { setIsResolving(false); }
  };

  if (loading || dataRequests.length === 0) return null;

  // Hide section if all staff requests are resolved (conversation closed)
  const allStaffResolved = dataRequests.filter((dr: any) => dr.fromRole !== 'CUSTOMER').every((dr: any) => dr.isResolved);
  if (allStaffResolved) return null;

  // Smart status: check if a staff message has a customer reply AFTER it chronologically
  const staffMessageHasReply = (index: number): boolean => {
    for (let i = index + 1; i < dataRequests.length; i++) {
      if (dataRequests[i].fromRole === 'CUSTOMER') return true;
    }
    return false;
  };

  // Header badge: last message is from staff with no customer reply after it = waiting
  const lastMsg = dataRequests[dataRequests.length - 1];
  const isWaitingForCustomer = lastMsg && lastMsg.fromRole !== 'CUSTOMER';
  const hasCustomerResponse = dataRequests.some((dr: any) => dr.fromRole === 'CUSTOMER');
  const allStaffAnswered = !isWaitingForCustomer;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5" /> طلبات البيانات الإضافية
        {isWaitingForCustomer ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
            <Clock className="w-3 h-3" /> بانتظار رد العميل
          </span>
        ) : allStaffAnswered && dataRequests.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> العميل ردّ
          </span>
        ) : null}
      </h3>
      <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 space-y-3">
        {/* Chat history */}
        <div className="max-h-72 overflow-y-auto space-y-2 p-3 bg-white rounded-xl border border-slate-100">
          {dataRequests.map((dr: any, idx: number) => {
            const isStaff = dr.fromRole !== 'CUSTOMER';
            const isCustomer = dr.fromRole === 'CUSTOMER';
            const hasReply = isStaff && staffMessageHasReply(idx);
            return (
              <div key={dr.id} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  isStaff
                    ? 'bg-blue-50 border border-blue-100 text-blue-900'
                    : 'bg-emerald-50 border border-emerald-100 text-emerald-900'
                }`}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{dr.message}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-slate-400">
                      {ROLE_NAMES[dr.fromRole] || dr.fromRole}
                    </span>
                    <span className="text-[9px] text-slate-400">{fmtDate(dr.createdAt)}</span>
                    {isStaff && (
                      (dr.isResolved || hasReply) ? (
                        <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> تم الرد ✅
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> بانتظار الرد
                        </span>
                      )
                    )}
                    {isCustomer && (
                      <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> رد العميل
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply form */}
        {showReplyForm ? (
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
                onClick={sendNewRequest}
                disabled={isSending || !newMessage.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
              <button
                onClick={() => { setShowReplyForm(false); setNewMessage(''); }}
                className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowReplyForm(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" /> طلب بيانات إضافية
            </button>
            {hasCustomerResponse && allStaffAnswered && (
              <button
                onClick={resolveAll}
                disabled={isResolving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isResolving ? 'جاري الاعتماد...' : 'اعتماد وإغلاق المحادثة'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}


// ── Generic Collapsible Section ──
function CollapsibleSection({ title, subtitle, defaultOpen = false, children, color = 'slate' }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode; color?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorMap: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-50 hover:bg-slate-100',
    blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    teal: 'border-teal-200 bg-teal-50 hover:bg-teal-100',
    violet: 'border-violet-200 bg-violet-50 hover:bg-violet-100',
    indigo: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100',
    emerald: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    amber: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
  };
  const cls = colorMap[color] || colorMap.slate;
  return (
    <section className="rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer ${cls}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs transition-transform duration-200" style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          <span className="text-xs font-bold text-slate-700">{title}</span>
        </div>
        {subtitle && <span className="text-[10px] font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-full">{subtitle}</span>}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Collapsible wrapper for SEO sections (with progress fetch) ──
function CollapsibleSeoSection({ title, defaultOpen, children, ticketId, headers, type }: {
  title: string; defaultOpen: boolean; children: React.ReactNode;
  ticketId: string; headers: Record<string, string>; type: 'setup' | 'final';
}) {
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/tickets/${ticketId}/tasks`, { headers }).then(r => r.json()).then(d => {
      if (!d || d.error) return;
      const category = type === 'setup' ? 'SEO_SETUP' : 'SEO_FINAL';
      const tasks = d[category] || [];
      setProgress({
        completed: tasks.filter((t: any) => t.isCompleted).length,
        total: tasks.length,
      });
    }).catch(() => {});
  }, [ticketId, type]);

  return (
    <CollapsibleSection
      title={title}
      subtitle={`${progress.completed}/${progress.total} مكتملة`}
      defaultOpen={defaultOpen}
      color="teal"
    >
      {children}
    </CollapsibleSection>
  );
}



export function TicketDetailPanel({ ticket, staff, userRole, userId, headers, onClose, onRefresh }: Props) {
  const [checklist, setChecklist] = useState<any[]>([]);
  const [notes, setNotes] = useState(ticket.staffNotes || '');
  const [assets, setAssets] = useState(ticket.assetsUrl || '');

  const [errorModal, setErrorModal] = useState<string | null>(null);

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
  // Approved design logo
  const [approvedLogoUrl, setApprovedLogoUrl] = useState<string | null>(null);
  // SEO Proposal (for approved domain display)
  const [seoProposal, setSeoProposal] = useState<any>(null);
  // Product Supplier Selection
  const [supplierSelection, setSupplierSelection] = useState<any>(null);
  const [supplierFileUrl, setSupplierFileUrl] = useState('');
  const [supplierLink, setSupplierLink] = useState('');
  const [uploadingSupplierFile, setUploadingSupplierFile] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Auto-refresh ticket data when panel opens to get latest briefs/transfers
  useEffect(() => { onRefresh(); }, [ticket.id]);

  useEffect(() => {
    try { setChecklist(JSON.parse(ticket.checklists || '[]')); } catch { setChecklist([]); }
    setNotes(ticket.staffNotes || '');
    setAssets(ticket.assetsUrl || '');

    // Fetch logo type image
    if (ticket.aiProposal?.selectedLogoType) {
      fetch(`${API}/api/logo-types`, { headers }).then(r => r.json()).then((types: any[]) => {
        const match = types.find((t: any) => t.id === ticket.aiProposal.selectedLogoType);
        if (match?.imageUrl) setLogoTypeImageUrl(match.imageUrl);
      }).catch(() => {});
    }
    // Fetch approved design logo
    fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers })
      .then(r => r.json()).then(d => {
        if (d?.selectedImageUrl) setApprovedLogoUrl(d.selectedImageUrl);
      }).catch(() => {});
    // Fetch SEO Proposal (Domain suggestions / selected domain)
    fetch(`${API}/api/tickets/${ticket.id}/seo-proposals`, { headers })
      .then(r => r.json()).then(d => {
        if (d && d.id) setSeoProposal(d);
        else setSeoProposal(null);
      }).catch(() => setSeoProposal(null));
    // Fetch product supplier selection
    fetch(`${API}/api/tickets/${ticket.id}/product-supplier`, { headers })
      .then(r => r.json()).then(d => {
        if (d && d.id) {
          setSupplierSelection(d);
          if (d.productFileUrl) setSupplierFileUrl(d.productFileUrl);
          if (d.productLink) setSupplierLink(d.productLink);
        }
        else setSupplierSelection(null);
      }).catch(() => setSupplierSelection(null));
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

  const isAssignedToMe = (() => {
    switch (ticket.stage) {
      case 'INTAKE': return ticket.accountManagerId === userId;
      case 'SEO_STORE_SETUP': return ticket.seoSpecialistId === userId || ticket.assignedSeoId === userId;
      case 'DESIGN': return ticket.designerId === userId;
      case 'DEVELOPMENT': return ticket.developerId === userId;
      case 'SEO_FINAL': return ticket.seoSpecialistId === userId || ticket.assignedSeoId === userId;
      default: return false;
    }
  })();

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

          {/* ── Quick Info Cards ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
              <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">النشاط</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5 truncate">{ticket.aiProposal?.businessName || ticket.client?.businessName || ticket.client?.customerName}</p>
              <p className="text-[10px] text-slate-500 truncate">{ticket.aiProposal?.industry || ticket.client?.industry || '—'}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">الدومين</p>
              {ticket.aiProposal?.selectedDomain ? (
                <a href={`https://${ticket.aiProposal.selectedDomain}`} target="_blank" rel="noreferrer" className="text-xs font-extrabold text-emerald-800 mt-0.5 block truncate hover:underline ltr">{ticket.aiProposal.selectedDomain}</a>
              ) : (
                <p className="text-xs font-extrabold text-slate-300 mt-0.5">لم يُحدد</p>
              )}
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-3 border border-violet-100">
              <p className="text-[9px] text-violet-500 font-bold uppercase tracking-wider">الشعار</p>
              <div className="flex items-center gap-2 mt-0.5">
                {(approvedLogoUrl || ticket.aiProposal?.generatedLogoUrl) ? (
                  <img src={approvedLogoUrl || normalizeUrl(ticket.aiProposal?.generatedLogoUrl) || ''} alt="logo" className="w-8 h-8 rounded-lg object-contain bg-white border border-violet-100 p-0.5" />
                ) : null}
                <p className="text-xs font-extrabold text-slate-700 truncate">{ticket.aiProposal?.selectedLogoTypeName || (approvedLogoUrl ? 'معتمد' : 'لم يُحدد')}</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
              <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">الألوان</p>
              <div className="flex items-center gap-1 mt-1">
                {brandColors.length > 0 ? brandColors.slice(0, 5).map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-md border border-black/10 shadow-sm" style={{ backgroundColor: c }} title={c} />
                )) : <p className="text-xs text-slate-300 font-bold">لا ألوان</p>}
              </div>
            </div>
          </div>
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

          {/* Last Transfer Info */}
          {(() => {
            const transferActions = ['FLEXIBLE_TRANSFER', 'ASSIGNED_AM', 'STAGE_CHANGED', 'MOVED_TO_DEVELOPMENT', 'EMERGENCY_TRANSFER'];
            const transferLog = ticket.auditLogs?.find((log: any) =>
              transferActions.includes(log.action)
            );
            if (!transferLog) return null;
            let details: any = {};
            try { details = JSON.parse(transferLog.details || '{}'); } catch {}

            const ROLE_MAP: Record<string, string> = { ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO' };
            const STAGE_MAP: Record<string, string> = {
              INTAKE: 'استلام الطلب', SEO_STORE_SETUP: 'إعدادات SEO', DESIGN: 'التصميم',
              DEVELOPMENT: 'البرمجة', SEO_FINAL: 'المراجعة النهائية', DELIVERED: 'تم التسليم',
              ACCOUNT_MANAGER: 'مدير الحساب',
            };

            const senderName = transferLog.user?.name || 'غير معروف';
            const senderRole = ROLE_MAP[transferLog.user?.role] || transferLog.user?.role || '';
            
            // Extract receiver info based on action type
            let receiverName = details.assigneeName || '';
            let receiverRole = ROLE_MAP[details.assigneeRole] || details.assigneeRole || '';
            
            // For STAGE_CHANGED / MOVED_TO_DEVELOPMENT, try to get developer name from staff
            if (!receiverName && details.developerId) {
              const dev = staff.find(s => s.id === details.developerId);
              if (dev) { receiverName = dev.name; receiverRole = ROLE_MAP[dev.role] || dev.role; }
            }

            // Extract stage info
            const fromStage = STAGE_MAP[details.from] || details.from || '';
            const toStage = STAGE_MAP[details.to] || STAGE_MAP[details.stage] || details.to || details.stage || '';

            // Smart achievement summary from audit logs
            const achievements: string[] = [];
            const logs = ticket.auditLogs || [];
            // SEO completed
            if (logs.some((l: any) => l.user?.role === 'SEO' && l.action === 'FLEXIBLE_TRANSFER')) {
              achievements.push('✅ مهام SEO مكتملة');
            }
            // Design approved
            if (logs.some((l: any) => {
              try { const d = JSON.parse(l.details || '{}'); return d.designStatus === 'CLIENT_APPROVED' || d.designStatus === 'SEO_APPROVED' || d.designStatus === 'AM_APPROVED'; } catch { return false; }
            })) {
              achievements.push('✅ التصميم معتمد');
            }
            // Designer completed
            if (logs.some((l: any) => l.user?.role === 'DESIGNER' && l.action === 'FLEXIBLE_TRANSFER')) {
              achievements.push('✅ المصمم أنهى مهامه');
            }
            if (ticket.aiProposal?.selectedDomain) {
              achievements.push(`✅ الدومين المعتمد: ${ticket.aiProposal.selectedDomain}`);
            }
            // Developer completed
            if (logs.some((l: any) => l.user?.role === 'DEVELOPER' && l.action === 'FLEXIBLE_TRANSFER')) {
              achievements.push('✅ مهام التطوير مكتملة');
            }
            if (ticket.stage === 'SEO_FINAL') {
              achievements.push('✅ المراجعة النهائية');
            }

            return (
              <section className="bg-blue-50 rounded-2xl border border-blue-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5">📋 آخر تحويل</h4>
                  <span className="text-[10px] text-blue-500">{fmtDate(transferLog.createdAt)}</span>
                </div>

                {/* From → To (people) — ← is correct in RTL: points from right-item to left-item */}
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="text-blue-600">من: <strong>{senderName}</strong> ({senderRole})</span>
                  {receiverName && (
                    <>
                      <span className="text-blue-400">←</span>
                      <span className="text-blue-600">إلى: <strong>{receiverName}</strong> ({receiverRole})</span>
                    </>
                  )}
                </div>



                {/* Brief */}
                {details.brief && (
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-[10px] text-blue-500 font-bold mb-1">الملاحظات:</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{details.brief}</p>
                  </div>
                )}

                {/* Achievement summary */}
                {achievements.length > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 space-y-1">
                    {achievements.map((a, i) => (
                      <p key={i} className="text-[11px] font-bold text-emerald-700">{a}</p>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

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

          {/* ══════════ DATA REQUESTS — All Stages (except INTAKE which has its own) ══════════ */}
          {ticket.stage !== 'INTAKE' && ['ADMIN', 'ACCOUNT_MANAGER', 'SEO'].includes(userRole) && (
            <StaffDataRequestsSection ticket={ticket} headers={headers} onRefresh={onRefresh} />
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




          {/* Display Design Files */}
          {(ticket.designLogoUrl || ticket.designBannersUrl || ticket.designCategoriesUrl) && (
            <CollapsibleSection title="🎨 التصاميم المعتمدة" color="violet">
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
            </CollapsibleSection>
          )}

          {/* Store Details */}
          {ticket.storeDetails && (
            <CollapsibleSection title="🏪 بيانات المتجر" color="blue">
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
              {/* Approved Design Logo */}
              {approvedLogoUrl && (
                <div className="mt-3 bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
                  <p className="text-[10px] text-emerald-600 font-bold mb-2">🎨 التصميم المعتمد من العميل</p>
                  <div className="flex items-center gap-3">
                    <img src={normalizeUrl(approvedLogoUrl) || ''} alt="التصميم المعتمد" className="w-20 h-20 object-contain rounded-xl border-2 border-emerald-300 bg-white p-1.5" />
                    <a href={normalizeUrl(approvedLogoUrl) || ''} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> عرض بالحجم الكامل
                    </a>
                  </div>
                </div>
              )}
            </CollapsibleSection>
          )}


          {/* ── Client Info ─────────────────────── */}
          <CollapsibleSection title="👤 بيانات العميل" color="slate">
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

            {/* صورة الهوية وشهادة الآيبان */}
            {(ticket.client?.idImageUrl || ticket.client?.ibanCertUrl) && (
              <div className="mt-3 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">المرفقات</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* صورة الهوية */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                    <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">📄 صورة الهوية</p>
                      {ticket.client?.idImageUrl ? (
                        <a href={ticket.client.idImageUrl} target="_blank" rel="noreferrer"
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                          <ExternalLink className="w-3 h-3" /> عرض / تحميل
                        </a>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">لم يتم الرفع</p>
                      )}
                    </div>
                  </div>

                  {/* شهادة الآيبان */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                    <FileText className="w-5 h-5 text-teal-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">🏦 شهادة الآيبان</p>
                      {ticket.client?.ibanCertUrl ? (
                        <a href={ticket.client.ibanCertUrl} target="_blank" rel="noreferrer"
                          className="text-[10px] text-teal-600 hover:underline flex items-center gap-1 mt-0.5">
                          <ExternalLink className="w-3 h-3" /> عرض / تحميل
                        </a>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">لم يتم الرفع</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleSection>

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

          {/* Brand Identity */}
          {ticket.aiProposal && (
            <CollapsibleSection title="🎯 الهوية التجارية" color="indigo">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-[10px] text-slate-400 block">الاسم المختار</span><span className="text-sm font-black text-slate-800">{ticket.aiProposal.selectedName || '—'}</span></div>
                  <div><span className="text-[10px] text-slate-400 block">اسم النشاط</span><span className="text-sm font-bold text-slate-700">{ticket.aiProposal.businessName || '—'}</span></div>
                </div>
                {(seoProposal?.selectedDomain || ticket.aiProposal?.selectedDomain) && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">الدومين المعتمد</span>
                    <a
                      href={`https://${seoProposal?.selectedDomain || ticket.aiProposal?.selectedDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline ltr"
                    >
                      <Globe className="w-3.5 h-3.5" /> {seoProposal?.selectedDomain || ticket.aiProposal?.selectedDomain}
                    </a>
                  </div>
                )}
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
            </CollapsibleSection>
          )}

          {/* 🏪 Product Supplier Section — DEVELOPER/AM/ADMIN */}
          {['ADMIN', 'ACCOUNT_MANAGER', 'DEVELOPER'].includes(userRole) && supplierSelection && (() => {
            const ss = supplierSelection;
            const handleUploadFile = async (file: File) => {
              setUploadingSupplierFile(true);
              try {
                const reader = new FileReader();
                const base64 = await new Promise<string>(resolve => { reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); });
                const res = await fetch(`${API}/api/tickets/${ticket.id}/product-file`, {
                  method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileName: file.name, fileData: base64 })
                });
                if (res.ok) { const r = await res.json(); setSupplierFileUrl(r.url); showToast('تم رفع الملف ✅'); }
                else showToast('فشل رفع الملف', 'error');
              } catch { showToast('فشل رفع الملف', 'error'); }
              finally { setUploadingSupplierFile(false); }
            };
            const handleSaveUpload = async () => {
              const fUrl = supplierFileUrl || ss.productFileUrl;
              const pLink = supplierLink || ss.productLink;
              if (!fUrl && !pLink) { showToast('مطلوب ملف أو رابط (واحد على الأقل)', 'error'); return; }
              setSavingSupplier(true);
              try {
                const res = await fetch(`${API}/api/tickets/${ticket.id}/product-supplier/upload`, {
                  method: 'PUT', headers,
                  body: JSON.stringify({ productFileUrl: fUrl || null, productLink: pLink || null })
                });
                if (res.ok) { const d = await res.json(); setSupplierSelection(d); showToast('تم حفظ بيانات المنتجات ✅'); }
                else { const e = await res.json(); showToast(e.error || 'فشل الحفظ', 'error'); }
              } catch { showToast('تعذر الاتصال', 'error'); }
              finally { setSavingSupplier(false); }
            };
            const handleFinalize = async () => {
              setSavingSupplier(true);
              try {
                const res = await fetch(`${API}/api/tickets/${ticket.id}/product-supplier/finalize`, { method: 'PUT', headers });
                if (res.ok) { const d = await res.json(); setSupplierSelection(d); showToast('تم الاعتماد النهائي ✅'); }
                else showToast('فشل الاعتماد', 'error');
              } catch { showToast('تعذر الاتصال', 'error'); }
              finally { setSavingSupplier(false); }
            };

            // Determine whether upload section should show
            const showUpload = ['CLIENT_SELECTED', 'FILE_UPLOADED', 'CLIENT_REVISION_FILE'].includes(ss.status);

            return (
              <CollapsibleSection title="🏪 مزود المنتجات" color="amber">
                <div className="space-y-3">
                  {/* Status Badge */}
                  {ss.status === 'PENDING' && (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500">لم يتم إرسال خيارات المزودين للعميل بعد</p>
                    </div>
                  )}
                  {ss.status === 'SENT_TO_CLIENT' && (
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <p className="text-xs font-bold text-blue-700">بانتظار اختيار العميل للمزود</p>
                    </div>
                  )}
                  {ss.status === 'SENT_FILE_TO_CLIENT' && (
                    <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      <p className="text-xs font-bold text-indigo-700">📦 بانتظار مراجعة العميل لملف المنتجات</p>
                    </div>
                  )}
                  {ss.status === 'CLIENT_REVISION_FILE' && (
                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <p className="text-xs font-bold text-orange-700">🔄 العميل طلب تعديل على ملف المنتجات</p>
                    </div>
                  )}
                  {ss.status === 'CLIENT_APPROVED_FILE' && (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700">✅ العميل اعتمد ملف المنتجات</p>
                    </div>
                  )}
                  {ss.status === 'FINALIZED' && (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-300 p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700">🎉 تم الاعتماد النهائي</p>
                    </div>
                  )}

                  {/* Supplier info */}
                  {ss.selectedSupplierName && (
                    <div className="bg-green-50 rounded-xl border border-green-200 p-3">
                      <p className="text-[10px] text-green-600 font-bold mb-0.5">المزود المختار:</p>
                      <p className="text-xs font-bold text-green-800">{ss.selectedSupplierName}</p>
                    </div>
                  )}

                  {/* Client notes */}
                  {ss.clientNotes && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                      <p className="text-[10px] text-slate-400 font-bold mb-1">ملاحظات العميل:</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{ss.clientNotes}</p>
                    </div>
                  )}

                  {/* Current file/link display (all upload-related statuses) */}
                  {(ss.productFileUrl || ss.productLink) && (() => {
                    const getPreviewUrl = (url: string) => {
                      const ext = url.split('.').pop()?.toLowerCase() || '';
                      const viewableInBrowser = ['pdf','png','jpg','jpeg','gif','webp','svg','txt'].includes(ext);
                      return viewableInBrowser ? url : `${API}/api/file-preview?url=${encodeURIComponent(url)}`;
                    };
                    return (
                    <div className="space-y-2">
                      {ss.productFileUrl && (
                        <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-amber-200 text-xs">
                          <Download className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="flex-1 truncate text-amber-800 font-bold">الملف المرفوع</span>
                          <a href={getPreviewUrl(ss.productFileUrl)} target="_blank" rel="noreferrer"
                            className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold cursor-pointer flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> معاينة
                          </a>
                          <a href={ss.productFileUrl} download target="_blank" rel="noreferrer"
                            className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors font-bold cursor-pointer flex items-center gap-1">
                            <Download className="w-3 h-3" /> تحميل
                          </a>
                          <button onClick={() => { setSupplierFileUrl(''); setSupplierSelection({ ...ss, productFileUrl: null }); }}
                            className="p-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" title="حذف الملف">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {ss.productLink && (
                        <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-teal-200 text-xs">
                          <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="flex-1 truncate text-teal-800 font-bold">رابط المنتجات</span>
                          <a href={ensureUrl(ss.productLink)} target="_blank" rel="noreferrer"
                            className="px-2 py-1 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors font-bold cursor-pointer flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> فتح
                          </a>
                          <button onClick={() => { setSupplierLink(''); setSupplierSelection({ ...ss, productLink: null }); }}
                            className="p-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" title="حذف الرابط">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* File Upload Section — show for CLIENT_SELECTED, FILE_UPLOADED, CLIENT_REVISION_FILE */}
                  {showUpload && (() => {
                    const getPreviewUrl = (url: string) => {
                      const ext = url.split('.').pop()?.toLowerCase() || '';
                      const viewableInBrowser = ['pdf','png','jpg','jpeg','gif','webp','svg','txt'].includes(ext);
                      return viewableInBrowser ? url : `${API}/api/file-preview?url=${encodeURIComponent(url)}`;
                    };
                    return (
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> رفع / تعديل ملف المنتجات
                      </h4>

                      {supplierFileUrl && supplierFileUrl !== ss.productFileUrl && (
                        <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs">
                          <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="flex-1 truncate text-emerald-800 font-bold">ملف جديد مرفوع ✅</span>
                          <a href={getPreviewUrl(supplierFileUrl)} target="_blank" rel="noreferrer"
                            className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold cursor-pointer flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> معاينة
                          </a>
                          <button onClick={() => setSupplierFileUrl(ss.productFileUrl || '')}
                            className="p-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" title="إلغاء">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <label className={`flex items-center gap-2 px-3 py-2.5 border border-dashed border-amber-300 rounded-xl text-xs font-bold text-amber-600 hover:border-amber-500 hover:bg-amber-50 transition-colors cursor-pointer ${uploadingSupplierFile ? 'opacity-50' : ''}`}>
                        <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = ''; }} />
                        {uploadingSupplierFile ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingSupplierFile ? 'جاري الرفع...' : 'رفع ملف (Excel, PDF, CSV, ZIP...)'}
                      </label>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-600">رابط المنتجات (اختياري)</label>
                        <input type="url" dir="ltr"
                          value={supplierLink || ss.productLink || ''} onChange={e => setSupplierLink(e.target.value)}
                          placeholder="https://..."
                          className="w-full text-xs border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      </div>

                      <button onClick={handleSaveUpload} disabled={savingSupplier}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer">
                        {savingSupplier ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {savingSupplier ? 'جاري الحفظ...' : 'حفظ'}
                      </button>
                    </div>
                    );
                  })()}

                  {/* Finalize button — show when CLIENT_APPROVED_FILE */}
                  {ss.status === 'CLIENT_APPROVED_FILE' && (
                    <button onClick={handleFinalize} disabled={savingSupplier}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer">
                      {savingSupplier ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      اعتماد نهائي
                    </button>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Legal Doc Link — Task 3 */}
          {(() => {
            const docUrl = normalizeUrl(ticket.client?.legalDocUrl) || normalizeUrl(ticket.client?.documentFileUrl);
            const idUrl = normalizeUrl(ticket.client?.idImageUrl);
            const ibanUrl = normalizeUrl(ticket.client?.ibanCertUrl);
            if (!docUrl && !idUrl && !ibanUrl) return null;
            return (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">المستندات القانونية</h3>
              {docUrl && (
              <a href={docUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-800">الوثيقة / السجل التجاري</p>
                  <p className="text-[10px] text-blue-600 truncate">{ticket.client.legalDocUrl || ticket.client.documentFileUrl}</p>
                </div>
                <Download className="w-4 h-4 text-blue-500 shrink-0" />
              </a>
              )}

              {/* صورة الهوية */}
              {idUrl && (
                <a href={idUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-800">📄 صورة الهوية</p>
                    <p className="text-[10px] text-indigo-600 truncate">{ticket.client.idImageUrl}</p>
                  </div>
                  <Download className="w-4 h-4 text-indigo-500 shrink-0" />
                </a>
              )}

              {/* شهادة الآيبان */}
              {ibanUrl && (
                <a href={ibanUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors">
                  <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-teal-800">🏦 شهادة الآيبان</p>
                    <p className="text-[10px] text-teal-600 truncate">{ticket.client.ibanCertUrl}</p>
                  </div>
                  <Download className="w-4 h-4 text-teal-500 shrink-0" />
                </a>
              )}
            </section>
            );
          })()}

          {/* Internal Notes */}
          <CollapsibleSection title="💬 ملاحظات الفريق الداخلية" color="indigo">
            <div className="space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="أضف ملاحظاتك هنا..."
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          </CollapsibleSection>

          {/* Checklist */}
          {checklist.length > 0 && (
            <CollapsibleSection title={`✅ قائمة المهام`} subtitle={`${checklist.filter((c: any) => c.completed).length}/${checklist.length}`} color="emerald">
              <div className="space-y-2">
                {checklist.map((item: any, idx: number) => (
                  <button key={idx} onClick={() => toggleCheck(idx)}
                    className="flex items-center gap-3 w-full text-right p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                    {item.completed ? <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    <span className={`text-xs font-medium ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}


          {/* ══════ SEO_STORE_SETUP Stage (now managed by DEVELOPER) ══════ */}
          {(ticket.stage === 'SEO_STORE_SETUP' || ticket.stage === 'DEVELOPMENT' || (['DEVELOPER', 'ADMIN', 'ACCOUNT_MANAGER'].includes(userRole) && ticket.stage !== 'DELIVERED')) && (() => {
            const isNativeStage = ticket.stage === 'SEO_STORE_SETUP' || ticket.stage === 'DEVELOPMENT';
            if (!isNativeStage && !['DEVELOPER', 'ADMIN', 'ACCOUNT_MANAGER'].includes(userRole)) return null;
            return (
              <CollapsibleSeoSection
                title="📋 مهام إعداد المتجر"
                defaultOpen={isNativeStage}
                ticketId={ticket.id}
                headers={headers}
                type="setup"
              >
                <SeoStageSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
              </CollapsibleSeoSection>
            );
          })()}

          {/* ── DESIGN — Designer Upload / Review (visible in all stages once delivery exists) ──── */}
          <DesignSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />

          {/* ── DEVELOPMENT Stage — Dev Checklist / SEO Review ─────── */}
          {ticket.stage === 'DEVELOPMENT' && (
            <DevSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* ══════ SEO_FINAL Stage ══════ */}
          {(ticket.stage === 'SEO_FINAL' || ((['SEO', 'ADMIN', 'ACCOUNT_MANAGER'].includes(userRole)) && ticket.stage !== 'SEO_FINAL' && ticket.stage !== 'DELIVERED')) && (() => {
            const isNativeStage = ticket.stage === 'SEO_FINAL';
            if (!isNativeStage && !['SEO', 'ADMIN', 'ACCOUNT_MANAGER'].includes(userRole)) return null;
            return (
              <CollapsibleSeoSection
                title="📋 مهام المراجعة النهائية"
                defaultOpen={isNativeStage}
                ticketId={ticket.id}
                headers={headers}
                type="final"
              >
                <SeoFinalSection ticket={ticket} headers={headers} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
              </CollapsibleSeoSection>
            );
          })()}

          {/* ── Final Review Status — visible to all staff ── */}
          {ticket.finalReviewStatus && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📋 المراجعة النهائية للعميل</h3>
              {ticket.finalReviewStatus === 'SENT_TO_CLIENT' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5">⏳ بانتظار مراجعة العميل</p>
                </div>
              )}
              {ticket.finalReviewStatus === 'CLIENT_APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">✅ العميل اعتمد المراجعة النهائية</p>
                  {ticket.finalReviewNotes && <p className="text-xs text-emerald-700 mt-1">{ticket.finalReviewNotes}</p>}
                </div>
              )}
              {ticket.finalReviewStatus === 'CLIENT_REVISION' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">✏️ العميل يطلب تعديل قبل التسليم</p>
                  {ticket.finalReviewNotes && <p className="text-xs text-red-700 bg-white rounded-lg p-2 border border-red-100">{ticket.finalReviewNotes}</p>}
                </div>
              )}
            </section>
          )}

          {/* ── Flexible Transfer — All Staff (all stages except DELIVERED) ── */}
          {ticket.stage !== 'DELIVERED' && userRole !== 'CUSTOMER' && (
            <FlexibleTransferSection ticket={ticket} headers={headers} staff={staff} userRole={userRole} onRefresh={onRefresh} setErrorModal={setErrorModal} />
          )}

          {/* Audit Log */}
          <CollapsibleSection title="📜 سجل العمليات" subtitle={`${ticket.auditLogs?.length || 0} عملية`} color="slate">
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
          </CollapsibleSection>
        </div>
        </div>
      </div>
    </>
  );
}
