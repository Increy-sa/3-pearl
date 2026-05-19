import { Clock, CheckCircle, PenTool, Code, UserCircle, FileCheck, FileWarning } from 'lucide-react';

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
  PENDING_AI_PROPOSAL: { label: 'بانتظار الذكاء الاصطناعي', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  ASSIGNED_TO_AM: { label: 'مدير الحساب', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCircle },
  DESIGN_IN_PROGRESS: { label: 'قيد التصميم', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: PenTool },
  DEVELOPMENT_IN_PROGRESS: { label: 'قيد التطوير', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Code },
  DELIVERED: { label: 'تم التسليم', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
};

export function TicketCard({ ticket }: { ticket: any }) {
  const config = statusConfig[ticket.status] || statusConfig.PENDING_AI_PROPOSAL;
  const Icon = config.icon;

  // Real staff assignment info
  const assignedStaff = [
    ticket.accountManager?.name,
    ticket.designer?.name,  
    ticket.programmer?.name
  ].filter(Boolean);

  // Legal document status
  const needsIssuance = ticket.client?.hasLegalDoc === false;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-bold text-slate-400 mb-1 block">#{ticket.id.slice(0, 8)}</span>
          <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
            {ticket.aiProposal?.businessName || ticket.client.businessName}
          </h4>
          <p className="text-[10px] text-slate-500">{ticket.client.customerName}</p>
        </div>
        <div className="text-xs text-slate-400 flex flex-col items-end">
          <span className="font-semibold text-slate-500">تاريخ الإنشاء</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString('ar-EG')}</span>
        </div>
      </div>
      
      <div className="mb-3 space-y-1">
        <span className="text-xs font-semibold text-slate-500 block">الحالة</span>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {config.label}
        </div>
      </div>

      {/* Legal Document Status Badge */}
      <div className="mb-4">
        {needsIssuance ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
            <FileWarning className="w-3.5 h-3.5" />
            يحتاج استخراج وثيقة
          </div>
        ) : ticket.client?.documentFileUrl ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
            <FileCheck className="w-3.5 h-3.5" />
            الوثيقة مرفقة
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-slate-50 text-slate-500 border-slate-200">
            <FileWarning className="w-3.5 h-3.5" />
            بدون وثيقة
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">المسؤول:</span>
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {assignedStaff.length > 0 ? (
              assignedStaff.map((staff: string, i: number) => (
                <div key={i} className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600" title={staff}>
                  {staff.charAt(0)}
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">غير معين</span>
            )}
          </div>
        </div>
        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          الإجراءات
        </button>
      </div>
    </div>
  );
}
