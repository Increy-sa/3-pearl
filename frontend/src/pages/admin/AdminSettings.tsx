import React, { useEffect, useState } from 'react';
import { Loader2, Save, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Navigate } from 'react-router-dom';

const API = 'http://localhost:5000';

type SettingsPayload = {
  agencyProfile: {
    agencyName: string;
    contactEmail: string;
  };
  slaConfig: Record<string, number>;
};

export function AdminSettings() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [agencyProfile, setAgencyProfile] = useState({ agencyName: '', contactEmail: '' });
  const [slaConfig, setSlaConfig] = useState<Record<string, number>>({});

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API}/api/staff/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const payload: SettingsPayload = await res.json();
          setAgencyProfile(payload.agencyProfile);
          setSlaConfig(payload.slaConfig);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`${API}/api/staff/settings/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(agencyProfile),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'فشل حفظ بيانات الوكالة');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSlaStage = async (stage: string) => {
    setEditingStage(stage);
    try {
      const res = await fetch(`${API}/api/staff/settings/sla/${stage}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ hours: slaConfig[stage] }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'فشل تحديث SLA');
      }
    } finally {
      setEditingStage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">إعدادات المدير</h1>
        <p className="text-sm text-slate-500 mt-1">إدارة بيانات الوكالة وتكوين SLA العام للنظام.</p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4">Agency Profile</h2>
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={agencyProfile.agencyName}
            onChange={(e) => setAgencyProfile((prev) => ({ ...prev, agencyName: e.target.value }))}
            className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Agency Name"
            required
          />
          <input
            value={agencyProfile.contactEmail}
            onChange={(e) => setAgencyProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
            className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Contact Email"
            type="email"
            required
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ بيانات الوكالة
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4">Global SLA Config</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-right p-3 font-bold text-slate-600">Stage</th>
                <th className="text-right p-3 font-bold text-slate-600">SLA (hours)</th>
                <th className="text-right p-3 font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(slaConfig).map(([stage, hours]) => (
                <tr key={stage} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700">{stage}</td>
                  <td className="p-3 w-56">
                    <input
                      type="number"
                      min={0}
                      value={hours}
                      onChange={(e) =>
                        setSlaConfig((prev) => ({ ...prev, [stage]: Number(e.target.value || 0) }))
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => saveSlaStage(stage)}
                      disabled={editingStage === stage}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                    >
                      {editingStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
