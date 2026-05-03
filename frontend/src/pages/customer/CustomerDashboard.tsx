import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Loader2, CheckCircle2, Clock, Palette, Type, 
  LayoutDashboard, User as UserIcon, MessageSquare, LogOut, 
  Image as ImageIcon, FileText, ExternalLink, Activity, ShieldCheck,
  IdCard, Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  { id: 'INTAKE', label: 'استلام الطلب' },
  { id: 'LEGAL_PROCESSING', label: 'المعالجة القانونية' },
  { id: 'DESIGN', label: 'التصميم' },
  { id: 'DEVELOPMENT', label: 'التطوير والبرمجة' },
  { id: 'REVIEW', label: 'المراجعة والفحص' },
  { id: 'DELIVERED', label: 'تم التسليم' }
];

export function CustomerDashboard() {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracking' | 'profile'>('tracking');

  useEffect(() => {
    if (!token || user?.role !== 'CUSTOMER') {
      navigate('/login');
      return;
    }

    const fetchTicket = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/customer/my-ticket', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTicket(data);
        } else {
          if (response.status === 401 || response.status === 403) {
            logout();
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Failed to fetch ticket:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [token, navigate, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">لا توجد طلبات مرتبطة بحسابك حالياً.</p>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-blue-500 underline">تسجيل الخروج</button>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === ticket.stage);
  const currentStep = currentStepIndex === -1 ? 0 : currentStepIndex;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans" dir="rtl">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden lg:flex w-72 bg-white border-l border-slate-200 flex-col h-screen sticky top-0 z-20">
        <div className="p-8 border-b border-slate-100">
          <div className="text-2xl font-bold bg-gradient-to-l from-blue-600 to-indigo-600 bg-clip-text text-transparent">منصة سلة</div>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          <button onClick={() => setActiveTab('tracking')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'tracking' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard className="w-5 h-5" /> تتبع الطلب
          </button>
          <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <UserIcon className="w-5 h-5" /> بيانات العميل
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 space-y-4">
          <button onClick={() => window.open('https://wa.me/mock', '_blank')} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" /> تواصل مع الاستشاري
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 py-2 transition-colors text-sm">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-bold bg-gradient-to-l from-blue-600 to-indigo-600 bg-clip-text text-transparent">منصة سلة</div>
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('tracking')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'tracking' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>تتبع</button>
          <button onClick={() => setActiveTab('profile')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>بياناتي</button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-12 pb-24 lg:pb-12 max-w-7xl mx-auto w-full">
        <header className="mb-6 sm:mb-8 lg:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">مرحباً، {user?.name}</h1>
            <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base lg:text-lg">إليك تفاصيل متجرك وتحديثات التفيذ</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 sm:gap-2">
            <span className="bg-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-slate-200 shadow-sm text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              رقم التذكرة: #{ticket.id.slice(0, 8)}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">آخر تحديث: {new Date(ticket.updatedAt).toLocaleDateString('ar-SA')}</span>
          </div>
        </header>

        {activeTab === 'tracking' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Status Stepper */}
            <div className="bg-white p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" />
                مرحلة التنفيذ الحالية
              </h2>

              {/* Desktop Stepper (horizontal) */}
              <div className="hidden sm:block">
                <div className="relative flex justify-between items-start">
                  {/* Background track */}
                  <div className="absolute top-5 lg:top-6 left-0 right-0 h-1 bg-slate-100 rounded-full z-0" />
                  {/* Progress fill */}
                  <div
                    className="absolute top-5 lg:top-6 right-0 h-1 bg-gradient-to-l from-blue-500 to-indigo-500 rounded-full z-0 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                    style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                  />

                  {STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStep;
                    const isCurrent = idx === currentStep;
                    const isPending = idx > currentStep;
                    return (
                      <div key={step.id} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STEPS.length}%` }}>
                        {isCurrent && (
                          <div className="absolute -top-9 bg-blue-600 text-white px-2.5 py-0.5 rounded-md text-[10px] font-bold shadow-md whitespace-nowrap">
                            أنت هنا
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45" />
                          </div>
                        )}
                        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center transition-all duration-500 border-4 border-white shadow-md shrink-0 ${
                          isCompleted ? 'bg-blue-500 text-white' : isCurrent ? 'bg-blue-500 text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-300'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5 lg:w-6 lg:h-6" /> : isCurrent ? <Activity className="w-5 h-5 lg:w-6 lg:h-6" /> : <Clock className="w-4 h-4 lg:w-5 lg:h-5" />}
                        </div>
                        <span className={`mt-2.5 text-[10px] lg:text-xs font-bold whitespace-nowrap ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                        <span className={`mt-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          isCompleted ? 'bg-emerald-50 text-emerald-600' : isCurrent ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {isCompleted ? 'مكتمل' : isCurrent ? 'قيد التنفيذ' : 'انتظار'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Stepper (vertical compact list) */}
              <div className="sm:hidden space-y-2">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${isCurrent ? 'bg-blue-50 border border-blue-200' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted ? 'bg-blue-500 text-white' : isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-200' : 'bg-slate-100 text-slate-300'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : isCurrent ? <Activity className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </div>
                      <span className={`text-xs font-bold flex-1 ${isCurrent ? 'text-blue-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        isCompleted ? 'bg-emerald-50 text-emerald-600' : isCurrent ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {isCompleted ? 'مكتمل ✓' : isCurrent ? 'جاري' : 'انتظار'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Store Details Overhaul */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6 lg:gap-8">
              {/* Left Column: Identity & Description */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
                {/* Brand Identity */}
                <div className="bg-white p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-blue-500"></div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 mb-4 sm:mb-6 lg:mb-8 flex items-center gap-2 sm:gap-3">
                    <Type className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" />
                    هوية المتجر المعتمدة
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">اسم المتجر</span>
                        <p className="text-lg sm:text-xl lg:text-2xl font-black text-slate-800">{ticket.aiProposal?.businessName || ticket.client.businessName}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">مجال النشاط</span>
                        <p className="text-lg font-medium text-slate-700">{ticket.aiProposal?.industry || ticket.client.industry}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رؤية الهوية (Slogan)</span>
                      <p className="text-lg text-slate-600 leading-relaxed italic">
                        {ticket.aiProposal?.brandVision || ticket.aiProposal?.brandVoice || ticket.aiProposal?.description ? `"${ticket.aiProposal.brandVision || ticket.aiProposal.brandVoice || ticket.aiProposal.description}"` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-10 pt-8 border-t border-slate-50 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> وصف النشاط
                    </span>
                    <p className="text-slate-500 leading-relaxed text-sm">
                      {ticket.aiProposal?.brandDescription || ticket.client.description || ticket.aiProposal?.description || "لا يوجد وصف متاح لهذا النشاط حالياً."}
                    </p>
                  </div>
                </div>

                {/* Color Palette & Documents */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                  {/* Colors */}
                  <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <Palette className="w-5 h-5 text-indigo-500" /> لوحة الألوان
                    </h3>
                    {(() => {
                      let colors: string[] = [];
                      const raw = ticket.aiProposal?.selectedColors;
                      if (Array.isArray(raw)) {
                        colors = raw;
                      } else if (typeof raw === 'string') {
                        try { colors = JSON.parse(raw); } catch { colors = [raw]; }
                      }
                      return colors.length > 0 ? (
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                          {colors.map((color: string, i: number) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div
                                className="w-full aspect-square rounded-lg sm:rounded-2xl shadow-sm border border-black/5 hover:scale-105 transition-transform cursor-pointer hover:shadow-md"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                              <span className="hidden sm:block text-[9px] font-mono text-slate-400 uppercase tracking-tighter">{color}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-slate-400">لم يتم اختيار ألوان بعد</p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Documents */}
                  <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" /> الوثائق القانونية
                    </h3>
                    <div className="flex-1 flex flex-col justify-center space-y-4">
                      {ticket.client.hasLegalDoc !== false && (ticket.client.legalDocUrl || ticket.client.documentFileUrl) ? (
                        <>
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700 self-start">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            الوثيقة مرفقة
                          </div>
                          <a 
                            href={ticket.client.legalDocUrl || ticket.client.documentFileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors group"
                          >
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-500">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">السجل التجاري / الوثيقة</p>
                              <p className="text-[10px] text-slate-400">عرض الملف بصيغة PDF</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </a>
                        </>
                      ) : ticket.client.hasLegalDoc === false ? (
                        <>
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 self-start">
                            <Clock className="w-3.5 h-3.5" />
                            قيد الاستخراج
                          </div>
                          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4">
                            <p className="text-xs text-amber-800 font-medium">تم طلب استخراج وثيقة عمل حر / سجل تجاري. فريقنا يعمل على ذلك.</p>
                            
                            <div className="space-y-3 pt-2 border-t border-amber-200/50">
                              {ticket.client.fullNameInId && (
                                <div className="flex items-center gap-3 text-sm">
                                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                    <IdCard className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">الاسم بالهوية</span>
                                    <span className="text-slate-800 font-semibold">{ticket.client.fullNameInId}</span>
                                  </div>
                                </div>
                              )}
                              {ticket.client.absherPhone && (
                                <div className="flex items-center gap-3 text-sm">
                                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Smartphone className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">رقم الجوال (أبشر)</span>
                                    <span className="text-slate-800 font-semibold font-mono" dir="ltr">{ticket.client.absherPhone}</span>
                                  </div>
                                </div>
                              )}
                              {ticket.client.nationalIdUrl && (
                                <a
                                  href={ticket.client.nationalIdUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors group"
                                >
                                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800">عرض صورة الهوية الوطنية</p>
                                    <p className="text-[10px] text-slate-400">نسخة الهوية المرفقة للاستخراج</p>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-slate-400">لم يتم رفع وثائق قانونية</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reference Images */}
                <div className="bg-white p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-pink-500 shrink-0" /> الصور المرجعية (Mood Board)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {(() => {
                      let images: string[] = [];
                      const rawImages = ticket.aiProposal?.referenceLogos;
                      if (Array.isArray(rawImages)) {
                        images = rawImages;
                      } else if (typeof rawImages === 'string') {
                        try { images = JSON.parse(rawImages); } catch { images = []; }
                      }
                      
                      return images.length > 0 ? (
                        images.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative w-full aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-xl">
                            <img 
                              src={url} 
                              alt={`Reference ${i + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink className="w-6 h-6 text-white" />
                            </div>
                          </a>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400 py-4 col-span-full">لا توجد صور مرجعية</p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Column: Logo */}
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center lg:sticky lg:top-8">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">الشعار المقترح بالذكاء الاصطناعي</span>
                  
                  <div className="relative group mb-4 sm:mb-6 w-full flex justify-center">
                    <div className="absolute -inset-3 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 max-w-[80vw] bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl border-4 border-white overflow-hidden flex items-center justify-center p-3">
                      {ticket.aiProposal?.generatedLogoUrl ? (
                        <img 
                          src={ticket.aiProposal.generatedLogoUrl} 
                          alt="Generated Logo" 
                          className="w-full h-full object-contain" 
                        />
                      ) : (
                        <div className="text-slate-200">
                          <ImageIcon className="w-16 h-16 sm:w-20 sm:h-20" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mb-4 sm:mb-6">
                    <h4 className="text-lg sm:text-xl font-black text-slate-900">{ticket.aiProposal?.selectedName || "شعار قيد التوليد"}</h4>
                    <p className="text-xs text-slate-400">تواصل مع الاستشاري لطلب أي تعديلات</p>
                  </div>

                  <a 
                    href={ticket.aiProposal?.generatedLogoUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-2 sm:gap-3 hover:bg-slate-800 transition-all text-sm sm:text-base ${!ticket.aiProposal?.generatedLogoUrl ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}
                  >
                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" /> 
                    {ticket.aiProposal?.generatedLogoUrl ? 'عرض الشعار بالحجم الكامل' : 'الشعار قيد المعالجة...'}
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6 sm:mb-8 lg:mb-10 flex items-center gap-2 sm:gap-3">
              <UserIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 shrink-0" /> ملف العميل
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-10">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">الاسم الكامل</label>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl">{ticket.client.customerName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">البريد الإلكتروني</label>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl break-all">{ticket.client.email}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رقم الجوال</label>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl">{ticket.client.phone || "—"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رقم الهوية / الإقامة</label>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl">{ticket.client.nationalId || "—"}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رقم الآيبان (IBAN)</label>
                <p className="text-sm sm:text-base lg:text-xl font-bold text-slate-800 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl font-mono break-all">{ticket.client.iban || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        <button 
          onClick={() => window.open('https://wa.me/mock', '_blank')}
          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <MessageSquare className="w-4 h-4" />
          تواصل مع الاستشاري
        </button>
        <button 
          onClick={() => { logout(); navigate('/login'); }}
          className="p-2.5 text-slate-400 hover:text-red-500 transition-colors border border-slate-200 rounded-xl"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
