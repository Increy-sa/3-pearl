import React, { useMemo, useEffect, useState } from 'react';
import { TicketCard } from './TicketCard';
import { useAuthStore } from '../../store/useAuthStore';
import { Loader2 } from 'lucide-react';

export function TicketBoard() {
  const { user, token } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/tickets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTickets(data);
        }
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchTickets();
  }, [token]);

  const visibleTickets = useMemo(() => {
    if (!user) return [];
    
    // Admin sees everything
    if (user.role === 'ADMIN') return tickets;
    
    // RBAC logic for staff
    if (user.role === 'DESIGNER') {
      return tickets.filter(t => t.status === 'DESIGN_IN_PROGRESS' || t.designerId === user.id);
    }
    if (user.role === 'PROGRAMMER') {
      return tickets.filter(t => t.status === 'DEVELOPMENT_IN_PROGRESS' || t.programmerId === user.id);
    }
    if (user.role === 'ACCOUNT_MANAGER') {
      return tickets.filter(t => t.accountManagerId === user.id || t.status === 'ASSIGNED_TO_AM');
    }
    return [];
  }, [user, tickets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">تذاكر المتاجر النشطة</h3>
          <p className="text-slate-500 text-sm mt-1">عرض التذاكر التي لديك صلاحية الوصول إليها.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="بحث..." 
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20">
            إنشاء تذكرة يدوياً
          </button>
        </div>
      </div>

      {visibleTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <p className="text-slate-500 font-medium">لا توجد تذاكر متاحة لدورك في الوقت الحالي.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleTickets.map(ticket => (
             <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
