import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Edit2, Loader2, Check, Palette, Type, MessageCircle, Target, Image as ImageIcon, UploadCloud, Phone, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config/api';

type LogoTypeOption = { id: string; name: string; description?: string; imageUrl?: string };

interface BrandColor {
  name: string;
  hex: string;
  usage: string;
}

export function AIProposalView({ proposal, legalData, intakeData }: { proposal: any; legalData?: any; intakeData?: any }) {
  const [selectedName, setSelectedName] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingDashboard, setConfirmingDashboard] = useState(false);

  const [logoUrl, _setLogoUrl] = useState<string | null>(null);
  const [referenceLogoUrl, setReferenceLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Logo type selection
  const [logoTypes, setLogoTypes] = useState<LogoTypeOption[]>([]);
  const [selectedLogoTypeId, setSelectedLogoTypeId] = useState<string | null>(null);
  const [logoTypesLoading, setLogoTypesLoading] = useState(true);

  // Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { login, user, setProfileComplete, token: authToken } = useAuthStore();
  const navigate = useNavigate();

  // Is this an already-authenticated CUSTOMER (came from onboarding guard)?
  const isAuthenticatedCustomer = !!user && user.role === 'CUSTOMER';

  useEffect(() => {
    if (proposal) {
      setSelectedName(proposal.suggestedNames?.[0] || '');
      setColors(proposal.colorPalette || []);
    }
  }, [proposal]);

  useEffect(() => {
    fetch(`${API_URL}/api/logo-types`, { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setLogoTypes(d); })
      .catch(() => {}).finally(() => setLogoTypesLoading(false));
  }, []);

  if (!proposal) return null;

  const handleColorChange = (index: number, newColor: string) => {
    const newColors = [...colors];
    newColors[index] = newColor;
    setColors(newColors);
  };

  const handleSelectSuggested = (name: string) => {
    setSelectedName(name);
    setCustomName('');
    setIsEditingName(false);
  };

  const handleToggleCustom = () => {
    setIsEditingName(true);
    setSelectedName('');
  };

  const handleUploadReferenceLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const fileData = await base64Promise;

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData })
      });

      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setReferenceLogoUrl(result.url);
    } catch (err) {
      console.error('Logo upload error:', err);
    } finally {
      setUploadingLogo(false);
    }
  };



  const submitApproval = async () => {
    setLoading(true);
    setAuthError('');
    const finalName = isEditingName ? customName : selectedName;
    
    try {
      const chosenLogoType = logoTypes.find(lt => lt.id === selectedLogoTypeId);
      const finalData = {
        ...legalData,
        ...intakeData,
        selectedName: finalName,
        colorPalette: colors,
        brandVoice: proposal.brandVoice,
        brandVision: proposal.brandPersonality,
        brandDescription: proposal.logoDescription,
        referenceLogos: referenceLogoUrl ? [referenceLogoUrl] : [],
        generatedLogoUrl: logoUrl,
        selectedLogoType: selectedLogoTypeId || null,
        selectedLogoTypeName: chosenLogoType?.name || null,
        slogan: proposal.slogan,
        brandColors: proposal.brandColors,
        typography: proposal.typography,
        rationale: proposal.rationale
      };

      const response = await fetch(`${API_URL}/api/tickets/create-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      
      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          login(data.user, data.token, true);
          navigate('/dashboard/customer');
        }, 2000);
      } else {
        setAuthError(data.error || 'حدث خطأ أثناء اعتماد المقترح.');
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setAuthError('حدث خطأ أثناء الاتصال بالخادم.');
      setLoading(false);
    }
  };

  // Rich brand colors data from AI
  const brandColorsData: BrandColor[] = proposal.brandColors || [];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Simplified Success/Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {!isSuccess ? (
              <>
                <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">تأكيد اعتماد الهوية</h3>
                <p className="text-slate-500 text-center mb-6">هل أنت متأكد من رغبتك في اعتماد هذا المقترح والبدء في إنشاء متجرك؟</p>
                
                {authError && (
                  <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 text-center">
                    {authError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors border border-slate-200">إلغاء</button>
                  <button disabled={loading} onClick={submitApproval} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'اعتماد وبدء'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">تم إنشاء طلبك بنجاح!</h3>
                <p className="text-slate-500">جاري تحويلك لمتابعة الطلب...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-xl">
          <Sparkles className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">مقترح الهوية البصرية</h2>
          <p className="text-slate-500">تم تصميمه بالذكاء الاصطناعي خصيصاً لنشاطك التجاري</p>
        </div>
      </div>
      
      {/* Slogan Banner */}
      {proposal.slogan && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-2xl text-center">
          <p className="text-indigo-800 text-lg sm:text-xl font-semibold italic">"{proposal.slogan}"</p>
          <span className="text-xs text-indigo-400 mt-1 block">الشعار المقترح (Tagline)</span>
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
        <p className="text-blue-800 text-sm font-medium flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          يمكنك تعديل الألوان أو الاسم إذا لم تعجبك المقترحات، انقر عليها للتعديل.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          
          {/* Brand Personality */}
          {proposal.brandPersonality && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" /> شخصية العلامة التجارية
              </h3>
              <p className="text-slate-600 leading-relaxed">{proposal.brandPersonality}</p>
            </div>
          )}

          {/* Brand Voice */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-500" /> نبرة العلامة التجارية
            </h3>
            <p className="text-slate-600 text-lg italic border-r-4 border-blue-200 pr-4 py-1">"{proposal.brandVoice}"</p>
          </div>

          {/* Suggested Names */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> الأسماء المقترحة
            </h3>
            
            <div className="space-y-3 mb-6">
              {proposal.suggestedNames?.map((name: string, i: number) => {
                const isSelected = selectedName === name;
                return (
                  <div 
                    key={i} 
                    onClick={() => handleSelectSuggested(name)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${isSelected ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-transparent hover:border-slate-100 hover:bg-slate-50'}`}
                  >
                    <CheckCircle2 className={`w-5 h-5 transition-colors flex-shrink-0 ${isSelected ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    <span className={`font-medium ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{name}</span>
                    {i === 0 && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium mr-auto">مُوصى به</span>}
                  </div>
                );
              })}
            </div>

            {!isEditingName ? (
              <button 
                onClick={handleToggleCustom}
                className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" /> كتابة اسم مخصص
              </button>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">الاسم المخصص</label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="أدخل اسم متجرك المفضل..."
                  className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-start"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">

          {/* Color Palette — Rich View */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-500" /> لوحة الألوان المقترحة
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {colors.map((color: string, i: number) => {
                const colorMeta = brandColorsData[i];
                return (
                  <div key={i} className="group flex flex-col items-center relative overflow-hidden rounded-2xl">
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => handleColorChange(i, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      title="انقر لتغيير اللون"
                    />
                    <div 
                      className="w-full aspect-square rounded-2xl shadow-inner border border-black/5 mb-2 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: color }}
                    />
                    <div className="text-center w-full">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600 group-hover:text-slate-800 transition-colors">
                        <span className="text-sm font-bold uppercase tracking-wider">{color}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {colorMeta && (
                        <>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{colorMeta.name}</p>
                          <p className="text-xs text-slate-400">{colorMeta.usage}</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Typography */}
          {proposal.typography && (proposal.typography.arabic || proposal.typography.latin) && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Type className="w-5 h-5 text-amber-500" /> الخطوط المقترحة
              </h3>
              <div className="space-y-3">
                {proposal.typography.arabic && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-xs font-medium text-amber-600 block mb-1">الخط العربي</span>
                    <p className="text-slate-700 font-medium">{proposal.typography.arabic}</p>
                  </div>
                )}
                {proposal.typography.latin && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-xs font-medium text-amber-600 block mb-1">الخط اللاتيني</span>
                    <p className="text-slate-700 font-medium">{proposal.typography.latin}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logo Type Selection */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-violet-500" /> 🎨 اختر نوع الشعار المفضل <span className="text-red-500 text-xs font-bold">*</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">اختر النوع الذي يناسب علامتك التجارية — سيقوم فريق التصميم بتنفيذه</p>
            {logoTypesLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
            ) : logoTypes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">لا توجد أنواع شعارات متاحة حالياً</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {logoTypes.map(lt => {
                  const isSel = selectedLogoTypeId === lt.id;
                  return (
                    <div key={lt.id} onClick={() => setSelectedLogoTypeId(lt.id)}
                      className={`relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer active:scale-[0.97]
                        ${isSel ? 'ring-3 ring-emerald-400 shadow-xl shadow-emerald-500/20 scale-[1.02]' : 'ring-1 ring-slate-200 hover:ring-violet-300 hover:shadow-lg'}`}>
                      <div className="bg-slate-900 p-5 flex items-center justify-center min-h-[110px]">
                        {lt.imageUrl ? (
                          <img src={lt.imageUrl} alt={lt.name} className="w-20 h-20 object-contain" />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-600" />
                          </div>
                        )}
                        {isSel && <div className="absolute top-2 left-2"><CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-lg" /></div>}
                      </div>
                      <div className={`p-3 text-center ${isSel ? 'bg-emerald-50' : 'bg-white'}`}>
                        <h4 className={`font-bold text-xs ${isSel ? 'text-emerald-800' : 'text-slate-800'}`}>{lt.name}</h4>
                        {lt.description && <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{lt.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reference Logo Upload */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-500" /> إرفاق شعار مرجعي أعجبك (اختياري)
            </h3>
            <div className="relative">
              <input type="file" accept="image/*" onChange={handleUploadReferenceLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`w-full px-4 py-6 border-2 border-dashed rounded-xl text-center transition-all ${referenceLogoUrl ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}>
                {uploadingLogo ? (
                  <div className="flex flex-col items-center gap-2"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /><p className="text-xs text-slate-500">جاري الرفع...</p></div>
                ) : referenceLogoUrl ? (
                  <div className="flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /><p className="text-sm font-medium text-emerald-700">تم رفع الشعار المرجعي بنجاح</p></div>
                ) : (
                  <div className="flex flex-col items-center gap-1"><UploadCloud className="w-5 h-5 text-slate-400" /><p className="text-xs text-slate-500">اضغط لرفع صورة شعار كمرجع للمصمم</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rationale */}
      {proposal.rationale && (
        <div className="mt-6 p-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" /> لماذا هذه الاختيارات؟
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">{proposal.rationale}</p>
        </div>
      )}
      
      <div className="mt-10 flex flex-col sm:flex-row justify-end items-center gap-4">

         {/* ── CUSTOMER PATH: one-click confirm to dashboard ─────────────────── */}
         {isAuthenticatedCustomer ? (
           <button
             onClick={async () => {
               setConfirmingDashboard(true);
               const finalName = isEditingName ? customName : selectedName;
               try {
                 const token = authToken;
                 await fetch(`${API_URL}/api/tickets/save-ai-proposal`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${token}`,
                   },
                   body: JSON.stringify({
                     selectedName:     finalName,
                     colorPalette:     colors,
                     brandVoice:       proposal.brandVoice,
                     brandVision:      proposal.brandPersonality,
                     brandDescription: proposal.logoDescription,
                     slogan:           proposal.slogan,
                     brandColors:      proposal.brandColors,
                     typography:       proposal.typography,
                     rationale:        proposal.rationale,
                     logoDescription:  proposal.logoDescription,
                     referenceLogos:   referenceLogoUrl ? [referenceLogoUrl] : [],
                     generatedLogoUrl: logoUrl,
                     selectedLogoType: selectedLogoTypeId || null,
                     selectedLogoTypeName: logoTypes.find(lt => lt.id === selectedLogoTypeId)?.name || null,
                     businessName:     intakeData?.businessName,
                     industry:         intakeData?.industry,
                     description:      intakeData?.description,
                     targetAudience:   intakeData?.targetAudience,
                   }),
                 });
               } catch (err) {
                 console.error('[save-ai-proposal] failed:', err);
               }
               setProfileComplete(true);
               navigate('/dashboard/customer');
             }}
             disabled={confirmingDashboard || (!isEditingName && !selectedName) || (isEditingName && !customName.trim()) || !selectedLogoTypeId}
             className="w-full sm:w-auto py-3.5 px-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
           >
             {confirmingDashboard
               ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ والتحويل...</>
               : <><ArrowLeft className="w-5 h-5" /> تأكيد والانتقال للوحة التحكم</>}
           </button>
         ) : (
           // ── ANONYMOUS PATH: standard create-final flow ──────────────────────
           <>
             <a
               href="https://wa.me/966500000000"
               target="_blank"
               rel="noopener noreferrer"
               className="w-full sm:w-auto py-3.5 px-6 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2"
             >
               <Phone className="w-5 h-5" />
               تواصل مع مستشارك
             </a>

             <button
               onClick={() => setShowAuthModal(true)}
               disabled={(!isEditingName && !selectedName) || (isEditingName && !customName.trim()) || !selectedLogoTypeId}
               className="w-full sm:w-auto py-3.5 px-10 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
             >
               اعتماد ومتابعة لإنشاء التذكرة
             </button>
           </>
         )}
      </div>
    </div>
  );
}
