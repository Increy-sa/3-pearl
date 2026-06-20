import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../../config/api';
import { CheckSquare, Square, ChevronDown, ChevronUp, Search } from 'lucide-react';

// ── Task definitions ─────────────────────────────────────────────────────────
interface ExtraInput {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'password';
}

interface TaskDef {
  key: string;
  label: string;
  inputKey?: string;
  inputLabel?: string;
  inputType?: 'text' | 'email' | 'password';
  extraInputs?: ExtraInput[];
  dropdownKey?: string;
  dropdownOptions?: string[];
}

const TASK_GROUPS: { title: string; color: string; tasks: TaskDef[] }[] = [
  {
    title: 'إعداد النشاط',
    color: 'sky',
    tasks: [
      { key: 'nicheSelected',       label: 'تحديد النيش / المنتج' },
      { key: 'domainChosen',        label: 'اختيار الدومين', inputKey: 'domainName', inputLabel: 'اسم الدومين', inputType: 'text' },
      { key: 'gmailCreated',        label: 'إنشاء حساب Gmail',
        extraInputs: [
          { key: 'gmailEmail',    label: 'البريد الإلكتروني', type: 'email' },
          { key: 'gmailPassword', label: 'كلمة المرور',        type: 'password' },
        ],
      },
      { key: 'sallaAccountCreated', label: 'إنشاء حساب سلة',
        extraInputs: [
          { key: 'sallaEmail',    label: 'بريد حساب سلة', type: 'email' },
          { key: 'sallaPassword', label: 'كلمة مرور حساب سلة', type: 'password' },
        ],
      },
      { key: 'domainPurchased',     label: 'شراء الدومين' },
      { key: 'packageUpgraded',     label: 'ترقية الباقة',
        dropdownKey: 'packageType',
        dropdownOptions: ['بلس', 'برو', 'اسبيشل'],
      },
    ],
  },
  {
    title: 'إعداد المتجر',
    color: 'violet',
    tasks: [
      { key: 'logoDesigned',            label: 'تصميم الشعار' },
      { key: 'domainLinked',            label: 'ربط الدومين بالمتجر' },
      { key: 'googleAnalyticsLinked',   label: 'ربط Google Analytics' },
      { key: 'logoApplied',             label: 'تطبيق الشعار على المتجر' },
      { key: 'storeVerified',           label: 'التحقق من المتجر' },
      { key: 'siloCreated',             label: 'إنشاء السيلو' },
      { key: 'bankAccountAdded',        label: 'إضافة الحساب البنكي' },
      { key: 'infoPagesDone',           label: 'صفحات المعلومات (عن + سياسة)' },
      { key: 'footerDescDone',          label: 'وصف الفوتر' },
      { key: 'contactInfoAdded',        label: 'معلومات التواصل' },
      { key: 'whatsappButtonAdded',     label: 'زر واتساب' },
    ],
  },
  {
    title: 'المنتجات والمورد',
    color: 'amber',
    tasks: [
      { key: 'supplierSelected',    label: 'اختيار المورد', inputKey: 'supplierPlatformName', inputLabel: 'اسم المنصة', inputType: 'text' },
      { key: 'apiLinked',           label: 'ربط API المورد' },
      { key: 'productsUploaded',    label: 'رفع المنتجات' },
      { key: 'productsCategorized', label: 'تصنيف المنتجات' },
    ],
  },
  {
    title: 'التصميم والـ SEO',
    color: 'rose',
    tasks: [
      { key: 'bannerDesigned',     label: 'تصميم البنرات' },
      { key: 'seoHomepage',        label: 'SEO الصفحة الرئيسية' },
      { key: 'seoCategoriesPage',  label: 'SEO صفحات الأقسام' },
    ],
  },
  {
    title: 'الإطلاق',
    color: 'emerald',
    tasks: [
      { key: 'profitMarginsSet',        label: 'تحديد هامش الربح' },
      { key: 'paymentGatewaysLinked',   label: 'ربط بوابات الدفع' },
      { key: 'shippingCompaniesLinked', label: 'ربط شركات الشحن' },
      { key: 'uiApplied',              label: 'تطبيق واجهة المتجر' },
      { key: 'storeLaunched',           label: 'إطلاق المتجر' },
      { key: 'linkSentToClient',        label: 'إرسال الرابط للعميل' },
    ],
  },
];

const ALL_BOOLEAN_KEYS = TASK_GROUPS.flatMap(g => g.tasks.map(t => t.key));

// ── Color helpers ────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { header: string; badge: string; check: string; border: string }> = {
  sky:     { header: 'bg-sky-50 border-sky-200',      badge: 'bg-sky-100 text-sky-700',      check: 'text-sky-600',     border: 'border-sky-200' },
  violet:  { header: 'bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700', check: 'text-violet-600',  border: 'border-violet-200' },
  amber:   { header: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700',   check: 'text-amber-600',   border: 'border-amber-200' },
  rose:    { header: 'bg-rose-50 border-rose-200',     badge: 'bg-rose-100 text-rose-700',     check: 'text-rose-600',    border: 'border-rose-200' },
  emerald: { header: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', check: 'text-emerald-600', border: 'border-emerald-200' },
};

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  ticketId: string;
  headers: Record<string, string>;
}

export function SeoChecklistPanel({ ticketId, headers }: Props) {
  const [data, setData]           = useState<Record<string, any>>({});
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load checklist
  useEffect(() => {
    console.log('[SeoChecklist] Fetching for ticket:', ticketId);
    fetch(`${API_URL}/api/tickets/${ticketId}/seo-checklist`, { headers })
      .then(r => {
        console.log('[SeoChecklist] GET status:', r.status);
        return r.json();
      })
      .then(d => {
        console.log('[SeoChecklist] GET response:', d);
        if (d && typeof d === 'object' && !d.error) setData(d);
      })
      .catch(err => console.error('[SeoChecklist] GET error:', err));
  }, [ticketId]);

  // Debounced save (500ms after last change)
  const save = useCallback((next: Record<string, any>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        console.log('[SeoChecklist] PUT saving:', next);
        const res = await fetch(`${API_URL}/api/tickets/${ticketId}/seo-checklist`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        const saved = await res.json();
        console.log('[SeoChecklist] PUT response:', saved);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 2000);
      } catch (err) {
        console.error('[SeoChecklist] PUT error:', err);
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [ticketId, headers]);

  const toggle = (key: string) => {
    const next = { ...data, [key]: !data[key] };
    setData(next);
    save(next);
  };

  const setField = (key: string, value: string) => {
    const next = { ...data, [key]: value };
    setData(next);
    save(next);
  };

  // Progress
  const completed = ALL_BOOLEAN_KEYS.filter(k => !!data[k]).length;
  const total     = ALL_BOOLEAN_KEYS.length;
  const pct       = Math.round((completed / total) * 100);

  return (
    <section className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />
          قائمة مهام SEO وإنشاء المتجر
        </h3>
        {saving ? (
          <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>
        ) : saveOk ? (
          <span className="text-[10px] text-emerald-600 font-bold">✓ تم الحفظ</span>
        ) : null}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">نسبة الإكمال</span>
          <span className="text-sm font-extrabold text-teal-700">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 text-left ltr">{completed} / {total} مهمة مكتملة</p>
      </div>

      {/* Task Groups */}
      {TASK_GROUPS.map(group => {
        const colors       = COLOR_MAP[group.color];
        const groupKeys    = group.tasks.map(t => t.key);
        const groupDone    = groupKeys.filter(k => !!data[k]).length;
        const isCollapsed  = !!collapsed[group.title];

        return (
          <div key={group.title} className={`rounded-2xl border overflow-hidden ${colors.border}`}>
            {/* Group Header */}
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [group.title]: !prev[group.title] }))}
              className={`w-full flex items-center justify-between px-4 py-3 border-b ${colors.header} transition-colors hover:opacity-90`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700">{group.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {groupDone}/{group.tasks.length}
                </span>
              </div>
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {/* Tasks */}
            {!isCollapsed && (
              <div className="bg-white divide-y divide-slate-50">
                {group.tasks.map(task => {
                  const checked = !!data[task.key];
                  return (
                    <div key={task.key} className="px-4 py-3 space-y-2">
                      {/* Checkbox row */}
                      <button
                        onClick={() => toggle(task.key)}
                        className="w-full flex items-center gap-3 text-right group cursor-pointer"
                      >
                        {checked
                          ? <CheckSquare className={`w-4 h-4 shrink-0 ${colors.check}`} />
                          : <Square className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
                        }
                        <span className={`text-xs font-medium flex-1 text-right transition-colors ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {task.label}
                        </span>
                      </button>

                      {/* Single input field (shown only when checked) */}
                      {task.inputKey && checked && (
                        <div className="mr-7">
                          <input
                            type={task.inputType || 'text'}
                            value={data[task.inputKey] || ''}
                            onChange={e => setField(task.inputKey!, e.target.value)}
                            placeholder={task.inputLabel}
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300 transition-all"
                          />
                        </div>
                      )}

                      {/* Multiple extra inputs (shown only when checked) */}
                      {task.extraInputs && checked && (
                        <div className="mr-7 space-y-2">
                          {task.extraInputs.map(inp => (
                            <input
                              key={inp.key}
                              type={inp.type || 'text'}
                              value={data[inp.key] || ''}
                              onChange={e => setField(inp.key, e.target.value)}
                              placeholder={inp.label}
                              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300 transition-all"
                            />
                          ))}
                        </div>
                      )}

                      {/* Dropdown (shown only when checked) */}
                      {task.dropdownKey && checked && (
                        <div className="mr-7">
                          <select
                            value={data[task.dropdownKey] || ''}
                            onChange={e => setField(task.dropdownKey!, e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300 transition-all"
                          >
                            <option value="">اختر الباقة</option>
                            {task.dropdownOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
