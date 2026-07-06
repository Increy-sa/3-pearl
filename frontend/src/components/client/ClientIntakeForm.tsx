import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/api';

export function ClientIntakeForm({ onProposalGenerated, legalData, onBack }: {
  onProposalGenerated: (data: any, intake: any) => void;
  legalData: any;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [industry, setIndustry] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [otherIndustry, setOtherIndustry] = useState('');

  useAuthStore();

  // Check if all required fields are filled
  const isIndustryFilled = industry !== '' && (industry !== 'other' || otherIndustry.trim() !== '');
  const allFieldsFilled = businessName.trim() !== '' && isIndustryFilled && description.trim() !== '' && targetAudience.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalIndustry = industry;
    if (finalIndustry === 'other') {
      finalIndustry = otherIndustry;
    }

    const data = {
      ...legalData,
      businessName,
      industry: finalIndustry,
      description,
      targetAudience,
    };

    try {
      const response = await fetch(`${API_URL}/api/tickets/create-with-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        const errMsg = result.error || result.errors?.join('\n') || 'خطأ غير معروف';
        console.error('[create-with-ai] Server error:', result);
        alert(`خطأ من الخادم (${response.status}):\n${errMsg}`);
        return;
      }

      // Always let onProposalGenerated fire so the user can review the AI results
      // before being redirected. The confirm button in AIProposalView handles the final step.
      onProposalGenerated(result.aiProposal, data);
    } catch (error) {
      console.error("Failed to generate AI proposal:", error);
      alert('حدث خطأ أثناء توليد المقترح. تأكد من تشغيل الخادم الخلفي.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">تفاصيل المتجر</h2>
          <p className="text-slate-500 mt-2">أخبرنا عن نشاطك التجاري، وسيقوم الذكاء الاصطناعي بتوليد مقترح علامة تجارية مخصص لك.</p>
        </div>
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          type="button"
        >
          <span className="text-sm font-medium">رجوع</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">اسم النشاط التجاري <span className="text-red-500">*</span></label>
          <input required name="businessName" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-start" placeholder="شركة الأفق" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">مجال العمل <span className="text-red-500">*</span></label>
          <select
            required
            name="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-start"
          >
            <option value="">اختر المجال</option>
            <option value="fashion">الأزياء والملابس</option>
            <option value="electronics">الإلكترونيات</option>
            <option value="food">الأغذية والمشروبات</option>
            <option value="other">أخرى</option>
          </select>
        </div>

        {industry === 'other' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-sm font-medium text-slate-700">يرجى كتابة مجال العمل <span className="text-red-500">*</span></label>
            <input
              required
              name="otherIndustry"
              type="text"
              value={otherIndustry}
              onChange={e => setOtherIndustry(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-start"
              placeholder="مثلاً: بيع العطور المستوحاة"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">وصف النشاط (ماذا يقدم مشروعك؟) <span className="text-red-500">*</span></label>
          <textarea required name="description" rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none text-start" placeholder="ماذا يقدم مشروعك؟"></textarea>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">الجمهور المستهدف <span className="text-red-500">*</span></label>
          <input required name="targetAudience" type="text" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-start" placeholder="مثال: الشباب، المهتمين بالتقنية" />
        </div>

        <button
          disabled={loading || !allFieldsFilled}
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rtl:-scale-x-100" />}
          {loading ? 'جاري توليد المقترح...' : 'توليد مقترح الهوية بالذكاء الاصطناعي'}
        </button>
      </form>
    </div>
  );
}
