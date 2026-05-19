import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Navigate } from 'react-router-dom';

import { API_URL } from '../../config/api';

const API = API_URL;

type ReportsResponse = {
  totalTickets: number;
  breachedCount: number;
  ticketsByStage: Record<string, number>;
  staffPerformance: Array<{ name: string; ticketsCompleted: number }>;
};

export function ReportsDashboard() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API}/api/staff/reports`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token]);

  const inProgressCount = useMemo(() => {
    if (!data) return 0;
    return data.totalTickets - (data.ticketsByStage.DELIVERED || 0);
  }, [data]);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-600">تعذر تحميل بيانات التقارير.</div>;
  }

  const statCards = [
    { title: 'إجمالي التذاكر', value: data.totalTickets, icon: FileText, style: 'text-indigo-600 bg-indigo-50' },
    { title: 'تجاوزات SLA', value: data.breachedCount, icon: AlertTriangle, style: 'text-red-600 bg-red-50' },
    { title: 'قيد التنفيذ', value: inProgressCount, icon: BarChart3, style: 'text-amber-600 bg-amber-50' },
    { title: 'تم التسليم', value: data.ticketsByStage.DELIVERED || 0, icon: CheckCircle2, style: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">التقارير والتحليلات</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">لوحة تحكم المدير لمتابعة الأداء العام والفريق.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{card.title}</p>
              <div className={`p-2 rounded-lg ${card.style}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 sm:mt-3">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">التذاكر حسب المرحلة</h2>
          <div className="space-y-2">
            {Object.entries(data.ticketsByStage).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">{stage}</span>
                <span className="font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">أداء الموظفين</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-3 font-bold text-slate-600">الموظف</th>
                  <th className="text-right p-3 font-bold text-slate-600">التذاكر المكتملة</th>
                </tr>
              </thead>
              <tbody>
                {data.staffPerformance.map((staff) => (
                  <tr key={staff.name} className="border-t border-slate-100">
                    <td className="p-3 text-slate-700">{staff.name}</td>
                    <td className="p-3 font-bold text-slate-900">{staff.ticketsCompleted}</td>
                  </tr>
                ))}
                {data.staffPerformance.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-slate-500">
                      لا توجد بيانات أداء حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
