import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Upload, X, CheckCircle2, Image as ImageIcon, Plus, Edit2, Type, Palette, Paintbrush } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/api';

const DEFAULT_INDUSTRIES = ['عطور', 'ملابس', 'إلكترونيات', 'قهوة', 'أخرى'];

type LogoType = { id: string; name: string; description?: string; imageUrl?: string };

export function BrandIdentityBoard({ legalData, onBack }: { legalData: any, onBack: () => void }) {
  const [industryType, setIndustryType] = useState(DEFAULT_INDUSTRIES[0]);
  const [customIndustry, setCustomIndustry] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [aiNames, setAiNames] = useState<{ name: string; description: string }[]>([]);
  const [aiPalettes, setAiPalettes] = useState<{ title: string; colors: string[] }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedNameIdx, setSelectedNameIdx] = useState<number | null>(null);
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState<number | null>(null);
  const [storeName, setStoreName] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('#000000');
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const customNameRef = useRef<HTMLInputElement>(null);

  // Logo type selection
  const [logoTypes, setLogoTypes] = useState<LogoType[]>([]);
  const [selectedLogoTypeId, setSelectedLogoTypeId] = useState<string | null>(null);
  const [logoTypesLoading, setLogoTypesLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/logo-types`, { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setLogoTypes(d); })
      .catch(() => {}).finally(() => setLogoTypesLoading(false));
  }, []);

  const handleGetSuggestions = async () => {
    const finalIndustry = industryType === 'أخرى' ? customIndustry : industryType;
    if (!finalIndustry) { setError('يرجى اختيار مجال النشاط أولاً.'); return; }
    setError(''); setAiLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/ai/suggest-brand`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, industry: finalIndustry, description })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر جلب الاقتراحات');
      setAiNames(data.names || []); setAiPalettes(data.palettes || []);
      setSelectedNameIdx(null); setSelectedPaletteIdx(null);
    } catch (err: any) { setError(err.message || 'تعذر جلب الاقتراحات.'); }
    finally { setAiLoading(false); }
  };

  const handleSelectName = (idx: number) => { setSelectedNameIdx(idx); const c = aiNames[idx]; setStoreName(c.name); setBusinessName(c.name); setBrandVoice(c.description); };
  const handleSelectPalette = (idx: number) => { setSelectedPaletteIdx(idx); setColors(aiPalettes[idx].colors || []); };
  const handleAddColor = () => { if (colors.length < 5) setColors([...colors, newColor]); };
  const handleRemoveColor = (idx: number) => { setColors(colors.filter((_, i) => i !== idx)); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 3 - referenceImages.length);
      setReferenceImages(prev => [...prev, ...filesArray]);
      setImagePreviews(prev => [...prev, ...filesArray.map(file => URL.createObjectURL(file))]);
    }
  };
  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => { URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index); });
  };

  const handleSubmit = async () => {
    if (!storeName || colors.length === 0) { setError('يرجى اختيار اسم المتجر والألوان المرجعية.'); return; }
    if (!selectedLogoTypeId) { setError('يرجى اختيار نوع الشعار المفضل.'); return; }
    if (legalData.hasLegalDoc && !legalData.documentFileUrl) { setError('لم يكتمل رفع الوثيقة القانونية.'); return; }
    setLoading(true); setError('');
    try {
      let uploadedLogos: string[] = [];
      for (const file of referenceImages) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise(resolve => { reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(file); });
          const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, fileData: base64 }) });
          if (response.ok) { const result = await response.json(); uploadedLogos.push(result.url); }
        } catch (err) { console.error('File upload error:', err); }
      }
      const finalIndustry = industryType === 'أخرى' ? customIndustry : industryType;
      const chosenLogoType = logoTypes.find(lt => lt.id === selectedLogoTypeId);
      const payload = {
        ...legalData, businessName: storeName || businessName, industry: finalIndustry, description,
        targetAudience: "الجميع", selectedName: storeName, brandVoice, brandVision: brandVoice, brandDescription: description,
        legalDocUrl: legalData.documentFileUrl || null, colorPalette: colors, referenceLogos: uploadedLogos,
        generatedLogoUrl: null,
        selectedLogoType: selectedLogoTypeId, selectedLogoTypeName: chosenLogoType?.name || null,
      };
      const response = await fetch(`${API_URL}/api/tickets/create-final`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.ok) { login(data.user, data.token, true); navigate('/dashboard/customer'); }
      else { setError(data.error || 'حدث خطأ أثناء الإرسال'); }
    } catch { setError('فشل الاتصال بالخادم'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 animate-in fade-in duration-500">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" /> بناء الهوية التجارية (Mood Board)
        </h2>
        <p className="text-sm sm:text-base text-slate-500">اختر نشاطك ودع الذكاء الاصطناعي يلهمك بأفضل الأفكار. يمكنك المزج بين أي اسم وأي لوحة ألوان!</p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">{error}</div>}

      {/* STEP 1: Discovery Phase */}
      <div className="space-y-5 sm:space-y-6 mb-8 sm:mb-10 p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">مجال النشاط</label>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap scrollbar-hide -mx-1 px-1">
            {DEFAULT_INDUSTRIES.map(ind => (
              <button key={ind} onClick={() => !aiLoading && setIndustryType(ind)} disabled={aiLoading}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${industryType === ind ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'} ${aiLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                {ind}
              </button>
            ))}
          </div>
          {industryType === 'أخرى' && (
            <input type="text" value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} disabled={aiLoading}
              className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" placeholder="اكتب مجال نشاطك..." />
          )}
        </div>
        {showManualInputs && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">اسم النشاط أو الفكرة (اختياري)</label>
              <input ref={customNameRef} value={businessName} onChange={e => setBusinessName(e.target.value)} type="text"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="مثال: متجر الأناقة" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">وصف مختصر للنشاط (اختياري)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} type="text"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="ماذا تبيع ومن هم عملاؤك؟" />
            </div>
          </div>
        )}
        <button onClick={handleGetSuggestions} disabled={aiLoading}
          className="w-full py-3 sm:py-3.5 bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer">
          {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          توليد اقتراحات بالذكاء الاصطناعي
        </button>
      </div>

      {/* STEP 2A: Name Suggestions */}
      {aiNames.length > 0 && (
        <div className="mb-8 sm:mb-10 animate-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2 flex-wrap">
            <Type className="w-5 h-5 text-violet-500 shrink-0" /> اقتراحات الأسماء
            {selectedNameIdx !== null && <span className="text-[10px] sm:text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-medium">تم الاختيار ✓</span>}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {aiNames.map((item, idx) => (
              <div key={idx} onClick={() => handleSelectName(idx)}
                className={`relative p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group active:scale-[0.98]
                  ${selectedNameIdx === idx ? 'border-violet-500 bg-violet-50 shadow-md ring-2 ring-violet-200' : 'border-slate-100 bg-white hover:border-violet-200 hover:shadow-sm'}`}>
                {selectedNameIdx === idx && <div className="absolute top-2 left-2"><CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" /></div>}
                <h4 className="font-bold text-sm sm:text-base text-slate-800 mb-1">{item.name}</h4>
                <p className="text-[11px] sm:text-xs text-slate-500 italic leading-relaxed">"{item.description}"</p>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowManualInputs(true); setTimeout(() => customNameRef.current?.focus(), 100); }}
            className="mt-4 mx-auto flex items-center gap-2 text-violet-600 font-medium text-sm hover:underline cursor-pointer">
            <Edit2 className="w-4 h-4" /> لم يعجبك شيء؟ أدخل اسماً مخصصاً
          </button>
        </div>
      )}

      {/* STEP 2B: Palette Suggestions */}
      {aiPalettes.length > 0 && (
        <div className="mb-8 sm:mb-10 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '150ms' }}>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2 flex-wrap">
            <Palette className="w-5 h-5 text-emerald-500 shrink-0" /> لوحات الألوان المقترحة
            {selectedPaletteIdx !== null && <span className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium">تم الاختيار ✓</span>}
          </h3>
          <div className="space-y-3">
            {aiPalettes.map((pal, idx) => (
              <div key={idx} onClick={() => handleSelectPalette(idx)}
                className={`relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98]
                  ${selectedPaletteIdx === idx ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200' : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-sm'}`}>
                {selectedPaletteIdx === idx && <div className="shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>}
                <div className="flex gap-1.5 sm:gap-2 shrink-0">
                  {pal.colors.map((color, i) => (<div key={i} className="w-7 h-7 sm:w-10 sm:h-10 rounded-md sm:rounded-lg shadow-inner border border-black/5" style={{ backgroundColor: color }} />))}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-medium text-slate-700 truncate block">{pal.title}</span>
                  <div className="flex gap-1 sm:gap-1.5 mt-1 flex-wrap">
                    {pal.colors.map((c, i) => (<span key={i} className="text-[8px] sm:text-[10px] font-mono text-slate-400 uppercase">{c}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Customization (Name + Colors) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-10">
        <div className="space-y-3 sm:space-y-4 p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"><Type className="w-4 h-4 text-violet-500 shrink-0" /> الاسم المعتمد</h3>
          <div className="relative">
            <input value={storeName} onChange={e => setStoreName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-lg font-medium text-blue-900 bg-blue-50/50 focus:ring-2 focus:ring-violet-400" placeholder="اسم متجرك..." />
            <Edit2 className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
          </div>
          {brandVoice && <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg">"{brandVoice}"</p>}
        </div>
        <div className="space-y-3 sm:space-y-4 p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"><Palette className="w-4 h-4 text-emerald-500 shrink-0" /> لوحة الألوان ({colors.length}/5)</h3>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {colors.map((c, i) => (
              <div key={i} className="relative group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-inner border-2 border-white ring-1 ring-slate-200" style={{ backgroundColor: c }} />
                <button onClick={() => handleRemoveColor(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"><X className="w-3 h-3" /></button>
                <span className="block text-center text-[8px] sm:text-[9px] font-mono text-slate-400 mt-1 uppercase">{c}</span>
              </div>
            ))}
            {colors.length < 5 && (
              <div className="flex items-center gap-2">
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-12 h-12 p-1 rounded-lg cursor-pointer" />
                <button onClick={handleAddColor} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"><Plus className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 4: Logo Type Selection */}
      <div className="mb-8 sm:mb-10 p-4 sm:p-6 bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Paintbrush className="w-5 h-5 text-violet-500 shrink-0" /> 🎨 اختر نوع الشعار المفضل لمتجرك
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4">اختر النوع الذي يناسب علامتك التجارية — سيقوم فريق التصميم بتنفيذه</p>
        {logoTypesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
        ) : logoTypes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">لا توجد أنواع شعارات متاحة حالياً</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {logoTypes.map(lt => {
              const isSelected = selectedLogoTypeId === lt.id;
              return (
                <div key={lt.id} onClick={() => setSelectedLogoTypeId(lt.id)}
                  className={`relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer group active:scale-[0.97]
                    ${isSelected ? 'ring-3 ring-emerald-400 shadow-xl shadow-emerald-500/20 scale-[1.02]' : 'ring-1 ring-slate-200 hover:ring-violet-300 hover:shadow-lg'}`}>
                  {/* Dark image area */}
                  <div className="bg-slate-900 p-6 flex items-center justify-center min-h-[140px]">
                    {lt.imageUrl ? (
                      <img src={lt.imageUrl} alt={lt.name} className="w-24 h-24 object-contain filter brightness-100" />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-slate-800 flex items-center justify-center">
                        <Paintbrush className="w-10 h-10 text-slate-600" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-3 left-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  {/* Text area */}
                  <div className={`p-4 text-center ${isSelected ? 'bg-emerald-50' : 'bg-white'}`}>
                    <h4 className={`font-bold text-sm ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>{lt.name}</h4>
                    {lt.description && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{lt.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STEP 5: Reference Images */}
      <div className="mb-8 sm:mb-10 p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">إرفاق شعار مرجعي أعجبك (اختياري)</h3>
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> رفع صور مرجعية (أقصى حد 3)</label>
          <div className="relative">
            <input type="file" accept="image/*" multiple onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="w-full px-4 py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center hover:border-blue-300 transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">انقر أو اسحب الصور هنا</p>
            </div>
          </div>
          {imagePreviews.length > 0 && (
            <div className="flex gap-3">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg border shadow-sm">
                  <img src={src} className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-slate-100">
        <button type="button" onClick={onBack} className="w-full sm:w-auto px-6 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors border border-slate-200 text-sm sm:text-base text-center cursor-pointer">رجوع</button>
        <button onClick={handleSubmit} disabled={loading}
          className="w-full sm:flex-1 py-3 sm:py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm sm:text-base cursor-pointer">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? 'جاري إرسال بياناتك...' : 'اعتماد وإتمام الطلب ←'}
        </button>
      </div>
    </div>
  );
}
