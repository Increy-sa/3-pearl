// @ts-nocheck
/**
 * Staff Operations API Routes
 * 
 * Role-based access control for the Agency OS Staff Dashboard.
 * All endpoints require JWT authentication via the `authenticateToken` middleware.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/crypto';
import { SLA_HOURS, STAGE_LABELS } from '../config/stages';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();
const DEFAULT_AGENCY_PROFILE = {
  agencyName: 'وكالة الإدارة الرقمية',
  contactEmail: 'admin@agency.com',
  whatsappNumber: '',
};
const agencyProfile = { ...DEFAULT_AGENCY_PROFILE };
const globalSlaConfig: Record<string, number> = { ...SLA_HOURS };

// ── Middleware: require specific roles ─────────────────────────
function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الإجراء' });
    }
    next();
  };
}

// ── SLA helpers that respect customSlaHours ─────────────────────
function isCustomSlaBreached(ticket: any): boolean {
  const hours = ticket.customSlaHours ?? SLA_HOURS[ticket.stage as keyof typeof SLA_HOURS];
  if (!hours || hours === 0) return false;
  const anchor = ticket.staffAcceptedAt || ticket.stageEnteredAt;
  const elapsed = (Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60);
  return elapsed > hours;
}

function getCustomSlaRemaining(ticket: any): number {
  const hours = ticket.customSlaHours ?? SLA_HOURS[ticket.stage as keyof typeof SLA_HOURS];
  if (!hours || hours === 0) return Infinity;
  const anchor = ticket.staffAcceptedAt || ticket.stageEnteredAt;
  const elapsed = (Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60);
  return Math.round((hours - elapsed) * 10) / 10;
}

// ── Full ticket include for consistent responses ────────────────
const FULL_TICKET_INCLUDE = {
  client: true,
  aiProposal: true,
  storeDetails: true,
  accountManager: { select: { id: true, name: true, email: true, role: true } },
  designer: { select: { id: true, name: true, email: true, role: true } },
  developer: { select: { id: true, name: true, email: true, role: true } },
  seoSpecialist: { select: { id: true, name: true, email: true, role: true } },
  auditLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 50,
    include: { user: { select: { id: true, name: true, role: true } } }
  },
};

// ════════════════════════════════════════════════════════════════
// GET /api/staff/tickets — Role-filtered ticket list
// ════════════════════════════════════════════════════════════════
router.get('/tickets', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { role, userId } = req.user!;

    // Support ?archived=true to fetch archived tickets
    const showArchived = req.query.archived === 'true';

    let whereClause: any = { isArchived: showArchived };
    switch (role) {
      case 'ADMIN':
      case 'ACCOUNT_MANAGER':
        break;
      case 'DESIGNER':
        whereClause = { ...whereClause, OR: [{ designerId: userId }, { assignedDesignerId: userId }] };
        break;
      case 'DEVELOPER':
        whereClause = { ...whereClause, developerId: userId };
        break;
      case 'SEO':
        whereClause = { ...whereClause, OR: [{ seoSpecialistId: userId }, { assignedSeoId: userId }] };
        break;
      default:
        return res.json([]);
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: FULL_TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Count total tickets per clientId to detect first-time customers
    const clientIds = [...new Set(tickets.map(t => t.clientId).filter(Boolean))];
    const clientTicketCounts: Record<string, number> = {};
    if (clientIds.length > 0) {
      const counts = await prisma.ticket.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clientIds } },
        _count: { id: true },
      });
      counts.forEach(c => { clientTicketCounts[c.clientId] = c._count.id; });
    }

    const canDecrypt = ['ADMIN', 'DEVELOPER'].includes(role);

    const enriched = tickets.map(t => {
      let storeDetails = t.storeDetails;
      if (storeDetails) {
        if (t.amPasswordVisibility && canDecrypt && storeDetails.storePasswordEncrypted) {
          try {
            storeDetails = { ...storeDetails, storePasswordEncrypted: decrypt(storeDetails.storePasswordEncrypted) };
          } catch {}
        } else {
          storeDetails = { ...storeDetails, storePasswordEncrypted: storeDetails.storePasswordEncrypted ? '••••••••' : null };
        }
      }

      return {
        ...t,
        storeDetails,
        slaBreached: isCustomSlaBreached(t),
        slaRemainingHours: getCustomSlaRemaining(t),
        stageLabel: STAGE_LABELS[t.stage as keyof typeof STAGE_LABELS] || t.stage,
        isNewClient: (clientTicketCounts[t.clientId] || 0) <= 1,
        clientTicketCount: clientTicketCounts[t.clientId] || 0,
      };
    });

    res.json(enriched);
  } catch (e: any) {
    console.error('[staff/tickets] Error:', e.message);
    res.status(500).json({ error: 'فشل تحميل البيانات' });
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/staff/members — List all staff members (non-customer)
// ════════════════════════════════════════════════════════════════
router.get('/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: { not: 'CUSTOMER' } },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(members);
  } catch (e: any) {
    res.status(500).json({ error: 'فشل تحميل بيانات الفريق' });
  }
});

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/assign — Assign staff + custom SLA
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/assign',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const {
        accountManagerId,
        designerId,
        developerId,
        seoSpecialistId,
        customSlaHours,
        amInstructions,
        designerInstructions,
        developerInstructions,
        seoInstructions,
      } = req.body;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const updateData: any = {};
      if (accountManagerId !== undefined) updateData.accountManagerId = accountManagerId || null;
      if (designerId !== undefined) updateData.designerId = designerId || null;
      if (developerId !== undefined) updateData.developerId = developerId || null;
      if (seoSpecialistId !== undefined) updateData.seoSpecialistId = seoSpecialistId || null;
      if (customSlaHours !== undefined) updateData.customSlaHours = customSlaHours ? parseInt(customSlaHours) : null;
      if (amInstructions !== undefined) updateData.amInstructions = amInstructions?.trim() ? amInstructions.trim() : null;
      if (designerInstructions !== undefined) updateData.designerInstructions = designerInstructions?.trim() ? designerInstructions.trim() : null;
      if (developerInstructions !== undefined) updateData.developerInstructions = developerInstructions?.trim() ? developerInstructions.trim() : null;
      if (seoInstructions !== undefined) updateData.seoInstructions = seoInstructions?.trim() ? seoInstructions.trim() : null;


      const updated = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: FULL_TICKET_INCLUDE,
      });

      const assignedNames = [];
      if (accountManagerId) assignedNames.push(`AM: ${updated.accountManager?.name}`);
      if (designerId) assignedNames.push(`Designer: ${updated.designer?.name}`);
      if (developerId) assignedNames.push(`Developer: ${updated.developer?.name}`);
      if (seoSpecialistId) assignedNames.push(`SEO: ${updated.seoSpecialist?.name}`);
      if (customSlaHours) assignedNames.push(`SLA: ${customSlaHours}h`);
      if (
        amInstructions !== undefined ||
        designerInstructions !== undefined ||
        developerInstructions !== undefined ||
        seoInstructions !== undefined
      ) assignedNames.push('Role instructions updated');

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: req.user!.userId,
          action: 'ASSIGNED_STAFF',
          details: JSON.stringify({
            assignments: assignedNames,
            customSlaHours,
            hasRoleInstructions: !!(
              updateData.amInstructions ||
              updateData.designerInstructions ||
              updateData.developerInstructions ||
              updateData.seoInstructions
            ),
          }),
        },
      });

      // Re-fetch with enrichment
      const enriched = {
        ...updated,
        slaBreached: isCustomSlaBreached(updated),
        slaRemainingHours: getCustomSlaRemaining(updated),
        stageLabel: STAGE_LABELS[updated.stage as keyof typeof STAGE_LABELS] || updated.stage,
      };

      res.json(enriched);
    } catch (e: any) {
      console.error('[staff/assign] Error:', e.message);
      res.status(500).json({ error: 'فشل تعيين الموظف' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/toggle-password
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/toggle-password',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const updated = await prisma.ticket.update({
        where: { id },
        data: { amPasswordVisibility: !ticket.amPasswordVisibility },
      });

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: req.user!.userId,
          action: 'TOGGLED_PASSWORD',
          details: JSON.stringify({ newValue: updated.amPasswordVisibility }),
        },
      });

      res.json({
        amPasswordVisibility: updated.amPasswordVisibility,
        message: updated.amPasswordVisibility
          ? 'تم تفعيل عرض كلمة المرور للمطورين'
          : 'تم إخفاء كلمة المرور عن المطورين',
      });
    } catch (e: any) {
      console.error('[staff/toggle-password] Error:', e.message);
      res.status(500).json({ error: 'فشل تغيير حالة كلمة المرور' });
    }
  }
);



// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/design-files
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/design-files',
  authenticateToken,
  requireRole('ADMIN', 'DESIGNER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { designLogoUrl, designBannersUrl, designCategoriesUrl } = req.body;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const updated = await prisma.ticket.update({
        where: { id },
        data: { designLogoUrl, designBannersUrl, designCategoriesUrl },
        include: FULL_TICKET_INCLUDE
      });

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: req.user!.userId,
          action: 'UPDATED_NOTES',
          details: JSON.stringify({ message: 'تم تحديث ملفات التصميم' }),
        },
      });

      res.json(updated);
    } catch (e: any) {
      console.error('[staff/design-files] Error:', e.message);
      res.status(500).json({ error: 'فشل حفظ ملفات التصميم' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/accept — Staff accepts assignment
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/accept',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { role, userId } = req.user!;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const isAssigned =
        ticket.accountManagerId === userId ||
        ticket.designerId === userId ||
        ticket.developerId === userId ||
        ticket.seoSpecialistId === userId;

      if (!isAssigned && role !== 'ADMIN') {
        return res.status(403).json({ error: 'أنت غير معيّن لهذا الطلب' });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { staffAcceptedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: { ticketId: id, userId, action: 'STAFF_ACCEPTED', details: JSON.stringify({ role }) },
      });

      res.json(updated);
    } catch (e: any) {
      console.error('[staff/accept] Error:', e.message);
      res.status(500).json({ error: 'فشل قبول المهمة' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/notes
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/notes',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { staffNotes, assetsUrl } = req.body;

      const updateData: any = {};
      if (staffNotes !== undefined) updateData.staffNotes = staffNotes;
      if (assetsUrl !== undefined) updateData.assetsUrl = assetsUrl;

      const updated = await prisma.ticket.update({ where: { id }, data: updateData });

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: req.user!.userId,
          action: 'UPDATED_NOTES',
          details: JSON.stringify({ staffNotes: !!staffNotes, assetsUrl: !!assetsUrl }),
        },
      });

      res.json(updated);
    } catch (e: any) {
      console.error('[staff/notes] Error:', e.message);
      res.status(500).json({ error: 'فشل تحديث الملاحظات' });
    }
  }
);


// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/approve-docs  (ADMIN + AM only)
// Sets docsApproved=true on the ClientInfo so the customer sees
// "تم مراجعة وثائقك" in their dashboard.
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/approve-docs',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const ticket = await prisma.ticket.findUnique({ where: { id }, include: { client: true } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (!ticket.clientId) return res.status(400).json({ error: 'لا توجد بيانات عميل مرتبطة' });

      await prisma.clientInfo.update({
        where: { id: ticket.clientId },
        data: { docsApproved: true },
      });

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: req.user!.userId,
          action: 'STAGE_CHANGED',
          details: JSON.stringify({ message: 'تم اعتماد وثائق الاستخراج من قِبل ' + req.user!.role }),
        },
      });

      res.json({ ok: true, message: 'تم اعتماد الوثائق بنجاح' });
    } catch (e: any) {
      console.error('[staff/approve-docs] Error:', e.message);
      res.status(500).json({ error: 'فشل اعتماد الوثائق' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// GET /api/staff/tickets/:id/audit
// ════════════════════════════════════════════════════════════════
router.get(
  '/tickets/:id/audit',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const logs = await prisma.auditLog.findMany({
        where: { ticketId: id },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: 'فشل تحميل سجل العمليات' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/:id/toggle-status — Activate/Deactivate
// ════════════════════════════════════════════════════════════════
router.put(
  '/:id/toggle-status',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      if (id === req.user!.userId) {
        return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' });
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      // AM cannot toggle ADMIN accounts
      if (req.user!.role === 'ACCOUNT_MANAGER' && user.role === 'ADMIN') {
        return res.status(403).json({ error: 'لا يمكنك تعديل حسابات المدراء' });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
      });
      res.json({ message: updated.isActive ? `تم تنشيط حساب ${updated.name}` : `تم تعطيل حساب ${updated.name}`, user: updated });
    } catch (e: any) {
      console.error('[staff/toggle-status] Error:', e.message);
      res.status(500).json({ error: 'فشل تغيير حالة الموظف' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// DELETE /api/staff/:id/hard — Permanently delete a staff member
// ════════════════════════════════════════════════════════════════
router.delete(
  '/:id/hard',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      if (id === req.user!.userId) {
        return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      // AM cannot delete ADMIN accounts
      if (req.user!.role === 'ACCOUNT_MANAGER' && user.role === 'ADMIN') {
        return res.status(403).json({ error: 'لا يمكنك حذف حسابات المدراء' });
      }

      // Nullify ticket relations so DB doesn't crash
      await prisma.ticket.updateMany({ where: { accountManagerId: id }, data: { accountManagerId: null } });
      await prisma.ticket.updateMany({ where: { designerId: id }, data: { designerId: null } });
      await prisma.ticket.updateMany({ where: { developerId: id }, data: { developerId: null } });
      // Delete audit logs by this user
      await prisma.auditLog.deleteMany({ where: { userId: id } });
      // Delete notifications
      await prisma.notification.deleteMany({ where: { userId: id } });
      // Delete user
      await prisma.user.delete({ where: { id } });

      res.json({ message: `تم حذف ${user.name} نهائياً` });
    } catch (e: any) {
      console.error('[staff/hard-delete] Error:', e.message);
      res.status(500).json({ error: 'فشل الحذف النهائي' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// GET /api/staff/reports — Admin analytics dashboard
// ════════════════════════════════════════════════════════════════
router.get(
  '/reports',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const allTickets = await prisma.ticket.findMany({
        include: {
          accountManager: { select: { id: true, name: true } },
          designer: { select: { id: true, name: true } },
          developer: { select: { id: true, name: true } },
        },
      });

      const totalTickets = allTickets.length;
      // Count SLA breaches using custom or default hours
      let breachedCount = 0;
      allTickets.forEach(t => {
        const hours = t.customSlaHours ?? (SLA_HOURS as any)[t.stage] ?? 0;
        if (hours > 0) {
          const anchor = t.staffAcceptedAt || t.stageEnteredAt;
          const elapsed = (Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60);
          if (elapsed > hours && t.stage !== 'DELIVERED') breachedCount++;
        }
      });

      // Tickets by stage
      const byStage: Record<string, number> = {};
      allTickets.forEach(t => { byStage[t.stage] = (byStage[t.stage] || 0) + 1; });

      // Staff performance: count delivered tickets per staff
      const perfMap: Record<string, { name: string; completed: number; active: number }> = {};
      allTickets.forEach(t => {
        const workers = [t.designer, t.developer].filter(Boolean);
        workers.forEach((w: any) => {
          if (!perfMap[w.id]) perfMap[w.id] = { name: w.name, completed: 0, active: 0 };
          if (t.stage === 'DELIVERED') perfMap[w.id].completed++;
          else perfMap[w.id].active++;
        });
      });

      res.json({
        totalTickets,
        breachedCount,
        ticketsByStage: byStage,
        staffPerformance: Object.values(perfMap).map(({ name, completed }) => ({
          name,
          ticketsCompleted: completed,
        })),
      });
    } catch (e: any) {
      console.error('[staff/reports] Error:', e.message);
      res.status(500).json({ error: 'فشل تحميل التقارير' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// GET /api/staff/settings — Admin settings payload
// ════════════════════════════════════════════════════════════════
router.get(
  '/settings',
  authenticateToken,
  requireRole('ADMIN'),
  async (_req: AuthRequest, res) => {
    res.json({
      agencyProfile,
      slaConfig: globalSlaConfig,
    });
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/settings/profile — Update agency profile
// ════════════════════════════════════════════════════════════════
router.put(
  '/settings/profile',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    const { agencyName, contactEmail, whatsappNumber } = req.body ?? {};
    if (!agencyName || !contactEmail) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الوكالة والبريد الإلكتروني' });
    }
    agencyProfile.agencyName = agencyName;
    agencyProfile.contactEmail = contactEmail;
    if (whatsappNumber !== undefined) agencyProfile.whatsappNumber = whatsappNumber || '';
    res.json({ message: 'تم حفظ بيانات الوكالة', agencyProfile });
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/settings/sla/:stage — Update global stage SLA
// ════════════════════════════════════════════════════════════════
router.put(
  '/settings/sla/:stage',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    const stage = String(req.params.stage || '').toUpperCase();
    const { hours } = req.body ?? {};
    const parsed = Number(hours);
    if (!(stage in globalSlaConfig)) {
      return res.status(404).json({ error: 'المرحلة غير موجودة' });
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'قيمة SLA غير صالحة' });
    }
    globalSlaConfig[stage] = parsed;
    res.json({ message: 'تم تحديث SLA', stage, hours: parsed, slaConfig: globalSlaConfig });
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/tickets/:id/archive — Toggle archive (ADMIN + AM)
// ════════════════════════════════════════════════════════════════
router.put(
  '/tickets/:id/archive',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { role } = req.user!;
      if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const id = req.params.id;
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const updated = await prisma.ticket.update({
        where: { id },
        data: { isArchived: !ticket.isArchived },
      });
      res.json({ success: true, isArchived: updated.isArchived });
    } catch (e: any) {
      console.error('[archive] Error:', e.message);
      res.status(500).json({ error: 'فشل أرشفة الطلب' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// DELETE /api/staff/tickets/:id — Delete ticket (ADMIN + AM)
// ════════════════════════════════════════════════════════════════
router.delete(
  '/tickets/:id',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { role } = req.user!;
      if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const id = req.params.id;
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      // Delete related records first
      await prisma.notification.deleteMany({ where: { ticketId: id } });
      await prisma.auditLog.deleteMany({ where: { ticketId: id } });
      await prisma.seoChecklist.deleteMany({ where: { ticketId: id } });
      if (ticket.clientId) {
        const otherTickets = await prisma.ticket.count({ where: { clientId: ticket.clientId, id: { not: id } } });
        // Delete AI proposal and store details
        await prisma.aIProposal.deleteMany({ where: { ticketId: id } });
        await prisma.storeDetails.deleteMany({ where: { ticketId: id } });
      } else {
        await prisma.aIProposal.deleteMany({ where: { ticketId: id } });
        await prisma.storeDetails.deleteMany({ where: { ticketId: id } });
      }
      await prisma.ticket.delete({ where: { id } });

      res.json({ success: true, message: 'تم حذف الطلب نهائياً' });
    } catch (e: any) {
      console.error('[delete-ticket] Error:', e.message);
      res.status(500).json({ error: 'فشل حذف الطلب' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// POST /api/staff/create — Create new staff member (ADMIN only)
// ════════════════════════════════════════════════════════════════
router.post(
  '/create',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { name, email, role } = req.body;
      if (!name?.trim() || !email?.trim() || !role) {
        return res.status(400).json({ error: 'الاسم والبريد الإلكتروني والدور مطلوبين' });
      }
      const validRoles = ['ACCOUNT_MANAGER', 'SEO', 'DESIGNER', 'DEVELOPER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'الدور غير صالح' });
      }
      const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existing) {
        return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
      const passwordHash = await bcrypt.hash('123456', 10);
      const user = await prisma.user.create({
        data: { name: name.trim(), email: email.trim().toLowerCase(), role, passwordHash }
      });
      res.json(user);
    } catch (e: any) {
      console.error('[staff/create] Error:', e.message);
      res.status(500).json({ error: 'فشل إنشاء الموظف' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/:id/update — Update staff name/role (ADMIN only)
// ════════════════════════════════════════════════════════════════
router.put(
  '/:id/update',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, role } = req.body;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'الموظف غير موجود' });
      // AM cannot edit ADMIN accounts
      if (req.user!.role === 'ACCOUNT_MANAGER' && user.role === 'ADMIN') {
        return res.status(403).json({ error: 'لا يمكنك تعديل حسابات المدراء' });
      }
      const data: any = {};
      if (name?.trim()) data.name = name.trim();
      if (role) {
        const validRoles = ['ADMIN', 'ACCOUNT_MANAGER', 'SEO', 'DESIGNER', 'DEVELOPER'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'الدور غير صالح' });
        data.role = role;
      }
      const updated = await prisma.user.update({ where: { id }, data });
      res.json(updated);
    } catch (e: any) {
      console.error('[staff/update] Error:', e.message);
      res.status(500).json({ error: 'فشل تحديث الموظف' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PUT /api/staff/:id/reset-password — Reset to default 123456
// ════════════════════════════════════════════════════════════════
router.put(
  '/:id/reset-password',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'الموظف غير موجود' });
      // AM cannot reset ADMIN passwords
      if (req.user!.role === 'ACCOUNT_MANAGER' && user.role === 'ADMIN') {
        return res.status(403).json({ error: 'لا يمكنك تعديل حسابات المدراء' });
      }
      const passwordHash = await bcrypt.hash('123456', 10);
      await prisma.user.update({ where: { id }, data: { passwordHash } });
      res.json({ message: `تم إعادة تعيين كلمة مرور ${user.name}` });
    } catch (e: any) {
      console.error('[staff/reset-password] Error:', e.message);
      res.status(500).json({ error: 'فشل إعادة تعيين كلمة المرور' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// GET /api/staff/by-role/:role — Get active staff by role
// ════════════════════════════════════════════════════════════════
router.get(
  '/by-role/:role',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const role = req.params.role;
      const validRoles = ['ADMIN', 'ACCOUNT_MANAGER', 'SEO', 'DESIGNER', 'DEVELOPER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'الدور غير صالح' });
      }
      const users = await prisma.user.findMany({
        where: { role, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      });
      res.json(users);
    } catch (e: any) {
      console.error('[staff/by-role] Error:', e.message);
      res.status(500).json({ error: 'فشل جلب الموظفين' });
    }
  }
);

// ════════════════════════════════════════════════════════════════
// GET /api/staff/settings/agency — Public agency info (any authenticated user)
// ════════════════════════════════════════════════════════════════
router.get(
  '/settings/agency',
  authenticateToken,
  async (_req: AuthRequest, res) => {
    res.json({
      agencyName: agencyProfile.agencyName,
      contactEmail: agencyProfile.contactEmail,
      whatsappNumber: agencyProfile.whatsappNumber,
    });
  }
);

export default router;
