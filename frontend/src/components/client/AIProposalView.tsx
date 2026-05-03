import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Edit2, Loader2, Check, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export function AIProposalView({ proposal }: { proposal: any }) {
  const [selectedName, setSelectedName] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    if (proposal) {
      setSelectedName(proposal.suggestedNames?.[0] || '');
      setColors(proposal.colorPalette || []);
    }
  }, [proposal]);

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

  const submitApproval = async () => {
    setLoading(true);
    setAuthError('');
    const finalName = isEditingName ? customName : selectedName;
    
    try {
      console.log("Sending for approval:", { selectedName: finalName, colors });
      const response = await fetch(`http://localhost:5000/api/tickets/${proposal.ticketId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalName, finalColors: colors })
      });
      
      const data = await response.json();
      console.log("Approval response received:", data);

      if (response.ok) {
        setIsSuccess(true);
        // Instant login and redirect after delay
        setTimeout(() => {
          login(data.user, data.token);
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

  return (
    <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
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

      {/* Main View */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
          <Sparkles className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">مقترح الهوية التجارية (ذكاء اصطناعي)</h2>
          <p className="text-slate-500">تم تصميمه خصيصاً لرؤية نشاطك التجاري.</p>
        </div>
      </div>
      
      <div className="mb-8 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
        <p className="text-blue-800 text-sm font-medium flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          يمكنك تعديل الألوان أو الاسم إذا لم تعجبك المقترحات، انقر عليها للتعديل.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> نبرة العلامة التجارية
            </h3>
            <p className="text-slate-600 text-lg italic border-r-4 border-blue-200 pr-4 py-1">"{proposal.brandVoice}"</p>
          </div>

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
                    <CheckCircle2 className={`w-5 h-5 transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    <span className={`font-medium ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{name}</span>
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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span> لوحة الألوان المقترحة
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {colors.map((color: string, i: number) => (
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
                <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-800 transition-colors">
                  <span className="text-sm font-medium uppercase tracking-wider">{color}</span>
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-12 flex justify-end">
         <button 
           onClick={() => setShowAuthModal(true)}
           disabled={(!isEditingName && !selectedName) || (isEditingName && !customName)}
           className="py-3 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
         >
           اعتماد ومتابعة لإنشاء التذكرة
         </button>
      </div>
    </div>
  );
}
