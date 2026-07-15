import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, Mail, Lock, ArrowRight, ShieldCheck, RotateCw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { validateLoginForm } from '../../utils/validators';
import { API_URL } from '../../config/api';

type LoginStep = 'credentials' | 'otp';

export function Login() {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpUserName, setOtpUserName] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ── Step 1: Submit email + password ──────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const formErrors = validateLoginForm(email);
    if (Object.keys(formErrors).length > 0) {
      setError(formErrors.email || 'بيانات غير صحيحة');
      return;
    }

    if (!password) {
      setError('كلمة المرور مطلوبة');
      return;
    }

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
        if (data.requiresOtp) {
          // Customer — needs OTP verification
          setOtpUserName(data.name || '');
          setStep('otp');
          setResendCooldown(60);
        } else if (data.token) {
          // Staff — direct login
          login(data.user, data.token, data.isProfileComplete);
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

  // ── OTP Input Handlers ──────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take last character
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      otpRefs.current[5]?.focus();
      handleVerifyOtp(pasted);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────
  const handleVerifyOtp = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      setError('يرجى إدخال الرمز المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code })
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
        setError(data.error || 'رمز التحقق غير صحيح');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      if (response.ok) {
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      } else {
        const data = await response.json();
        setError(data.error || 'فشل إعادة إرسال الرمز');
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    }
  };

  const handleBack = () => {
    setStep('credentials');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setOtpUserName('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center mb-6 sm:mb-8">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 ${step === 'otp' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 transition-colors duration-300`}>
            {step === 'otp' ? <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" /> : <LogIn className="w-7 h-7 sm:w-8 sm:h-8" />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {step === 'otp' ? 'رمز التحقق' : 'تسجيل الدخول'}
          </h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2">
            {step === 'otp' 
              ? 'أدخل الرمز المرسل إلى بريدك الإلكتروني'
              : 'مرحباً بك مجدداً في Dot Media Operation'
            }
          </p>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* ── Step 1: Email + Password ──────────────────────── */}
        {step === 'credentials' && (
          <form onSubmit={handleLogin} className="space-y-5">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
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
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP Verification ─────────────────────── */}
        {step === 'otp' && (
          <div className="space-y-6">
            {/* Info badge */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-600">تم إرسال رمز التحقق إلى</p>
                <p className="text-sm font-bold text-blue-800 font-mono truncate" dir="ltr">{email}</p>
              </div>
              <button onClick={handleBack} className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline underline-offset-2 shrink-0">
                تغيير
              </button>
            </div>

            {/* OTP Inputs */}
            <div className="flex gap-2 sm:gap-3 justify-center" dir="ltr">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleOtpPaste : undefined}
                  className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 outline-none transition-all ${
                    digit
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button 
              disabled={loading || otp.join('').length !== 6}
              onClick={() => handleVerifyOtp()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {loading ? 'جاري التحقق...' : 'تأكيد الرمز'}
            </button>

            {/* Resend */}
            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-slate-400">
                  يمكنك إعادة الإرسال بعد <span className="font-bold text-slate-600">{resendCooldown}</span> ثانية
                </p>
              ) : (
                <button
                  onClick={handleResendOtp}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  إعادة إرسال الرمز
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
