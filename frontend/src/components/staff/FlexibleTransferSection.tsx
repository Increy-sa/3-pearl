import { useState, useEffect } from 'react';
import { API_URL } from '../../config/api';
import { ArrowRight, Send, Clock, Users, MessageSquare, Globe, Palette, Code, CheckCircle2, FileText, UserCheck, PartyPopper, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from '../ui/Toast';

const API = API_URL;
const ROLE_LABELS: Record<string, string> = { ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO' };

const TARGET_STAGES = [
  { key: 'SEO_STORE_SETUP', label: 'مرحلة SEO', icon: Globe, color: 'text-teal-600', staffRole: 'SEO' },
  { key: 'DESIGN', label: 'مرحلة التصميم', icon: Palette, color: 'text-violet-600', staffRole: 'DESIGNER' },
  { key: 'DEVELOPMENT', label: 'مرحلة البرمجة', icon: Code, color: 'text-blue-600', staffRole: 'DEVELOPER' },
  { key: 'ASSIGN_AM', label: 'مرحلة مدير الحساب', icon: UserCheck, color: 'text-orange-600', staffRole: 'ACCOUNT_MANAGER' },
  { key: 'CLIENT', label: 'مرحلة العميل', icon: MessageSquare, color: 'text-amber-600', staffRole: null },
  { key: 'SEO_FINAL', label: 'المراجعة النهائية', icon: CheckCircle2, color: 'text-emerald-600', staffRole: null },
];

const CLIENT_ACTIONS = [
  { key: 'SHOW_DESIGNS', label: 'عرض التصاميم للاعتماد' },
  { key: 'SHOW_PROPOSALS', label: 'عرض مقترحات الدومين للاعتماد' },
  { key: 'SHOW_SUPPLIERS', label: 'عرض مزودي المنتجات للاعتماد' },
  { key: 'SHOW_PRODUCT_FILE', label: 'عرض ملف المنتجات للاعتماد' },
  { key: 'SHOW_FINAL_REVIEW', label: 'عرض المراجعة النهائية قبل التسليم' },
  { key: 'REQUEST_DATA', label: 'طلب بيانات إضافية' },
];

interface Props {
  ticket: any;
  headers: Record<string, string>;
  staff: any[];
  userRole: string;
  onRefresh: () => void;
  setErrorModal: (msg: string | null) => void;
}

export function FlexibleTransferSection({ ticket, headers, staff, userRole, onRefresh, setErrorModal }: Props) {
  const [selectedStage, setSelectedStage] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [brief, setBrief] = useState('');
  const [clientAction, setClientAction] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [customSlaHours, setCustomSlaHours] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showCredsToDev, setShowCredsToDev] = useState(false);
  const [showCredsPassword, setShowCredsPassword] = useState(false);
  const [storeCreds, setStoreCreds] = useState<{ email: string; password: string } | null>(null);
  // Delivery
  const [showDeliveryPanel, setShowDeliveryPanel] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [restrictClientView, setRestrictClientView] = useState(false);
  const { showToast } = useToast();

  const isAdminOrAM = ['ADMIN', 'ACCOUNT_MANAGER'].includes(userRole);

  // Fetch store credentials when DEVELOPMENT is selected
  useEffect(() => {
    if (selectedStage === 'DEVELOPMENT' || showDeliveryPanel) {
      fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, { headers })
        .then(r => r.json()).then(d => {
          if (d && !d.error) setStoreCreds({ email: d.newGmail || d.storeEmail || '', password: d.newGmailPassword || d.storePassword || '' });
        }).catch(() => {});
    }
  }, [selectedStage, showDeliveryPanel, ticket.id]);

  // Fetch restrictClientView setting
  useEffect(() => {
    fetch(`${API}/api/settings/app`, { headers })
      .then(r => r.json()).then(d => {
        if (d && typeof d.restrictClientView === 'boolean') setRestrictClientView(d.restrictClientView);
      }).catch(() => {});
  }, []);

  // Fetch delivery summary data
  useEffect(() => {
    if (showDeliveryPanel) {
      Promise.all([
        fetch(`${API}/api/tickets/${ticket.id}/design-delivery`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/tickets/${ticket.id}/seo-checklist`, { headers }).then(r => r.json()).catch(() => null),
      ]).then(([dd, sc]) => {
        setDeliveryData({
          figmaLink: dd?.figmaLink || '',
          driveLink: dd?.driveLink || '',
          domain: ticket.aiProposal?.selectedDomain || ticket.storeDetails?.domainName || '',
          logoType: ticket.aiProposal?.selectedLogoTypeName || '',
          storeEmail: sc?.newGmail || sc?.storeEmail || '',
          storePassword: sc?.newGmailPassword || sc?.storePassword || '',
        });
      });
    }
  }, [showDeliveryPanel, ticket.id]);

  const stageConfig = TARGET_STAGES.find(s => s.key === selectedStage);
  const filteredStaff = stageConfig?.staffRole
    ? staff.filter(s => s.role === stageConfig.staffRole && s.isActive)
    : [];
  // Filter out CLIENT stage if restricted and user is not ADMIN/AM
  const availableStages = TARGET_STAGES.filter(s => {
    if (s.key === 'CLIENT' && restrictClientView && !isAdminOrAM) return false;
    return true;
  });

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      const body: any = {};
      if (selectedStage === 'CLIENT') {
        if (!clientAction) { setErrorModal('يجب اختيار نوع الإجراء'); setTransferring(false); return; }
        body.clientAction = clientAction;
        body.clientMessage = clientMessage.trim() || undefined;
      } else if (selectedStage === 'ASSIGN_AM') {
        if (!assigneeId) { setErrorModal('يجب اختيار مدير الحساب'); setTransferring(false); return; }
        body.clientAction = 'ASSIGN_AM';
        body.assigneeId = assigneeId;
        body.brief = brief.trim() || undefined;
        const assignee = staff.find(s => s.id === assigneeId);
        body.assigneeName = assignee?.name || '';
        body.assigneeRole = assignee?.role || '';
        body.fromStage = ticket.stage;
        body.toStage = 'ACCOUNT_MANAGER';
      } else {
        body.targetStage = selectedStage;
        body.assigneeId = assigneeId || undefined;
        body.brief = brief.trim() || undefined;
        body.customSlaHours = customSlaHours ? Number(customSlaHours) : undefined;
        const assignee = assigneeId ? staff.find(s => s.id === assigneeId) : null;
        body.assigneeName = assignee?.name || '';
        body.assigneeRole = assignee?.role || '';
        body.fromStage = ticket.stage;
        body.toStage = selectedStage;
        if (selectedStage === 'DEVELOPMENT') {
          body.showCredentialsToDev = showCredsToDev;
        }
      }

      const res = await fetch(`${API}/api/tickets/${ticket.id}/flexible-transfer`, {
        method: 'PUT', headers, body: JSON.stringify(body)
      });

      if (res.ok) {
        const label = selectedStage === 'CLIENT'
          ? CLIENT_ACTIONS.find(a => a.key === clientAction)?.label || 'إرسال للعميل'
          : stageConfig?.label || '';
        showToast(`تم: ${label} ✅`);
        setSelectedStage(''); setAssigneeId(''); setBrief(''); setClientAction(''); setClientMessage(''); setCustomSlaHours(''); setShowCredsToDev(false);
        onRefresh();
      } else {
        const e = await res.json();
        setErrorModal(e.error || 'فشل التحويل');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setTransferring(false); }
  };

  const handleDelivery = async () => {
    setDelivering(true);
    try {
      const res = await fetch(`${API}/api/tickets/${ticket.id}/final-delivery`, {
        method: 'PUT', headers, body: JSON.stringify({ notes: deliveryNotes.trim() || undefined })
      });
      if (res.ok) {
        showToast('تم تسليم المتجر بنجاح! 🎉');
        setShowDeliveryPanel(false); setDeliveryNotes('');
        onRefresh();
      } else {
        const e = await res.json();
        setErrorModal(e.error || 'فشل التسليم');
      }
    } catch { setErrorModal('تعذر الاتصال بالخادم'); }
    finally { setDelivering(false); }
  };

  const canSubmit = () => {
    if (!selectedStage) return false;
    if (selectedStage === 'CLIENT') return !!clientAction && (clientAction !== 'REQUEST_DATA' || !!clientMessage.trim());
    if (selectedStage === 'ASSIGN_AM') return !!assigneeId;
    // Stages with staffRole require an assignee
    const stage = TARGET_STAGES.find(s => s.key === selectedStage);
    if (stage?.staffRole && !assigneeId) return false;
    return true;
  };

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5" /> تحويل الطلب
      </h3>
      <div className="bg-gradient-to-br from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-200/60 p-4 space-y-4">

        {/* Stage Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">اختر المرحلة:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableStages.map(s => {
              const Icon = s.icon;
              const isActive = selectedStage === s.key;
              return (
                <button key={s.key} onClick={() => { setSelectedStage(s.key); setAssigneeId(''); setBrief(''); setClientAction(''); setClientMessage(''); setShowDeliveryPanel(false); setShowCredsToDev(false); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : s.color}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Form — Stage transfer */}
        {selectedStage && selectedStage !== 'CLIENT' && selectedStage !== 'SEO_FINAL' && selectedStage !== 'ASSIGN_AM' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {stageConfig?.staffRole && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {selectedStage === 'SEO_STORE_SETUP' ? 'اختيار مختص SEO' :
                   selectedStage === 'DESIGN' ? 'اختيار المصمم' :
                   'اختيار المطور'}
                </label>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">اختر الموظف...</option>
                  {filteredStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {ROLE_LABELS[s.role] || s.role}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dev Credentials Toggle — only for DEVELOPMENT */}
            {selectedStage === 'DEVELOPMENT' && storeCreds && (
              <div className={`rounded-xl border p-3 space-y-3 transition-all duration-300 ${
                showCredsToDev
                  ? 'bg-emerald-50 border-emerald-300 shadow-md shadow-emerald-100/50'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <h4 className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  showCredsToDev ? 'text-emerald-700' : 'text-slate-700'
                }`}><Lock className="w-3.5 h-3.5" /> بيانات دخول المتجر</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-20 shrink-0">إيميل المتجر:</span>
                    <span className="font-mono text-slate-700">{storeCreds.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-20 shrink-0">كلمة المرور:</span>
                    <span className="font-mono text-slate-700">{showCredsPassword ? (storeCreds.password || '—') : '••••••••'}</span>
                    <button onClick={() => setShowCredsPassword(!showCredsPassword)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      {showCredsPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                </div>
                <label className={`flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-xl border-2 transition-all duration-300 ${
                  showCredsToDev
                    ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-200/60'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                  <div className={`relative w-10 h-5 rounded-full transition-all duration-300 shrink-0 ${
                    showCredsToDev ? 'bg-white/30' : 'bg-slate-200'
                  }`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all duration-300 ${
                      showCredsToDev ? 'right-0.5 bg-white' : 'left-0.5 bg-slate-400'
                    }`} />
                  </div>
                  <input type="checkbox" checked={showCredsToDev} onChange={e => setShowCredsToDev(e.target.checked)}
                    className="sr-only" />
                  <span className={`text-xs font-bold transition-colors ${
                    showCredsToDev ? 'text-white' : 'text-slate-600'
                  }`}>{showCredsToDev ? '🔓 البيانات ستظهر للمطور' : '🔒 البيانات مخفية عن المطور'}</span>
                </label>
                {showCredsToDev && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                      تنبيه: المطور سيتمكن من رؤية بيانات دخول المتجر (الإيميل وكلمة المرور) في تفاصيل الطلب
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> البريف (اختياري)
              </label>
              <textarea value={brief} onChange={e => setBrief(e.target.value)}
                placeholder="اكتب ملخصاً عن المهمة المطلوبة..." rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          </div>
        )}

        {/* SEO_FINAL — just brief */}
        {selectedStage === 'SEO_FINAL' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> البريف (اختياري)
              </label>
              <textarea value={brief} onChange={e => setBrief(e.target.value)}
                placeholder="ملاحظات للمراجعة النهائية..." rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          </div>
        )}

        {/* ASSIGN_AM — AM selector + brief */}
        {selectedStage === 'ASSIGN_AM' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> اختيار مدير الحساب
              </label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                <option value="">اختر مدير الحساب...</option>
                {staff.filter(s => s.role === 'ACCOUNT_MANAGER' && s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {ROLE_LABELS[s.role]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> البريف (اختياري)
              </label>
              <textarea value={brief} onChange={e => setBrief(e.target.value)}
                placeholder="ملاحظات لمدير الحساب..." rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
            </div>
          </div>
        )}

        {/* Client Action Form */}
        {selectedStage === 'CLIENT' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">نوع الإجراء:</label>
              <select value={clientAction} onChange={e => setClientAction(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="">اختر الإجراء...</option>
                {CLIENT_ACTIONS.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
            {clientAction && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {clientAction === 'REQUEST_DATA' ? 'رسالة الطلب (مطلوبة)' : 'رسالة للعميل (اختياري)'}
                </label>
                <textarea value={clientMessage} onChange={e => setClientMessage(e.target.value)}
                  placeholder={clientAction === 'REQUEST_DATA' ? 'اكتب تفاصيل البيانات المطلوبة...' : 'رسالة مخصصة للعميل...'}
                  rows={3}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
            )}
          </div>
        )}

        {/* SLA + Transfer Button */}
        {selectedStage && (
          <div className="space-y-3 pt-1">
            {selectedStage !== 'CLIENT' && selectedStage !== 'ASSIGN_AM' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> SLA مخصص (بالساعات)
                </label>
                <input type="number" min={1} value={customSlaHours} onChange={e => setCustomSlaHours(e.target.value)}
                  placeholder="اتركه فارغاً لاستخدام الافتراضي" dir="ltr"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}
            <button onClick={handleTransfer} disabled={transferring || !canSubmit()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {transferring
                ? <><Clock className="w-4 h-4 animate-spin" /> جاري التحويل...</>
                : <><Send className="w-4 h-4" /> {selectedStage === 'CLIENT' ? 'إرسال للعميل' : `تحويل: ${stageConfig?.label || ''}`}</>
              }
            </button>
          </div>
        )}

        {/* ═══════ Delivery Button — ADMIN / AM only ═══════ */}
        {isAdminOrAM && ticket.stage !== 'DELIVERED' && (
          <>
            <div className="border-t border-slate-200 pt-4">
              {!showDeliveryPanel ? (
                <button onClick={() => { setShowDeliveryPanel(true); setSelectedStage(''); }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200 cursor-pointer">
                  <PartyPopper className="w-5 h-5" /> 🎉 تسليم المتجر للعميل
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" /> ملخص التسليم
                  </h4>

                  {/* Delivery Summary */}
                  {deliveryData && (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-2.5 text-xs">
                      {deliveryData.domain && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">الدومين:</span>
                          <span className="text-emerald-900 font-mono">{deliveryData.domain}</span>
                        </div>
                      )}
                      {deliveryData.storeEmail && (
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">إيميل المتجر:</span>
                          <span className="text-emerald-900 font-mono">{deliveryData.storeEmail}</span>
                        </div>
                      )}
                      {deliveryData.storePassword && (
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">كلمة المرور:</span>
                          <span className="text-emerald-900 font-mono">{showCredsPassword ? deliveryData.storePassword : '••••••••'}</span>
                          <button onClick={() => setShowCredsPassword(!showCredsPassword)} className="p-0.5 hover:bg-emerald-100 rounded">
                            {showCredsPassword ? <EyeOff className="w-3 h-3 text-emerald-500" /> : <Eye className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      )}
                      {deliveryData.figmaLink && (
                        <div className="flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">Figma:</span>
                          <span className="text-emerald-900 truncate">{deliveryData.figmaLink}</span>
                        </div>
                      )}
                      {deliveryData.driveLink && (
                        <div className="flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">Drive:</span>
                          <span className="text-emerald-900 truncate">{deliveryData.driveLink}</span>
                        </div>
                      )}
                      {deliveryData.logoType && (
                        <div className="flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-bold">نوع الشعار:</span>
                          <span className="text-emerald-900">{deliveryData.logoType}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                    placeholder="ملاحظات التسليم (اختياري)..." rows={3}
                    className="w-full text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />

                  <div className="flex items-center gap-2">
                    <button onClick={handleDelivery} disabled={delivering}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 cursor-pointer">
                      {delivering ? <><Clock className="w-4 h-4 animate-spin" /> جاري التسليم...</> : <><PartyPopper className="w-4 h-4" /> تأكيد التسليم 🎉</>}
                    </button>
                    <button onClick={() => setShowDeliveryPanel(false)}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
