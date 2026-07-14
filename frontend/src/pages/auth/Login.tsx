import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { validateLoginForm } from '../../utils/validators';
import { API_URL } from '../../config/api';

type LoginStep = 'email' | 'password';

export function Login() {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<{ name: string; role: string; requiresPassword: boolean } | null>(null);
  
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-focus password input when step changes
  useEffect(() => {
    if (step === 'password' && passwordRef.current) {
      setTimeout(() => passwordRef.current?.focus(), 300);
    }
  }, [step]);

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    const formErrors = validateLoginForm(email);
    if (Object.keys(formErrors).length > 0) {
      setError(formErrors.email || 'بيانات غير صحيحة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await response.json();

      if (response.ok) {
        setVerifiedUser({ name: data.name, role: data.role, requiresPassword: data.requiresPassword });
        
        if (data.requiresPassword) {
          // Staff with password → show password step
          setStep('password');
        } else {
          // Customer or staff without password → direct login
          await handleDirectLogin();
        }
      } else {
        setError(data.error || 'البريد الإلكتروني غير مسجل');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token, data.isProfileComplete);

        if (data.user.role === 'CUSTOMER') {
          if (data.isProfileComplete === false) {
            navigate('/client');
          } else {
            navigate('/dashboard/customer');
          }
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(data.error || 'فشل تسجيل الدخول');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token, data.isProfileComplete);
        navigate('/dashboard');
      } else {
        setError(data.error || 'فشل تسجيل الدخول');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setError('');
    setVerifiedUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <LogIn className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">تسجيل الدخول</h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2">مرحباً بك مجدداً في Three Pearl</p>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* ── Step 1: Email ──────────────────────────────── */}
        {step === 'email' && (
          <form onSubmit={handleVerifyEmail} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  required 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  pattern="[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}"
                  title="صيغة البريد الإلكتروني غير صحيحة"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start" 
                  dir="ltr"
                  placeholder="ahmed@example.com"
                />
              </div>
            </div>

            <button 
              disabled={loading}
              type="submit" 
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'جاري التحقق...' : 'متابعة'}
            </button>
          </form>
        )}

        {/* ── Step 2: Password (for staff) ─────────────── */}
        {step === 'password' && (
          <div className="space-y-5">
            {/* Verified user badge */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-800 truncate">{verifiedUser?.name}</p>
                <p className="text-[11px] text-emerald-600 font-mono" dir="ltr">{email}</p>
              </div>
              <button onClick={handleBack} className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold underline underline-offset-2">
                تغيير
              </button>
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <label className="text-sm font-medium text-slate-700">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    ref={passwordRef}
                    required 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start" 
                    dir="ltr"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                type="submit" 
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                {loading ? 'جاري تسجيل الدخول...' : 'دخول'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
