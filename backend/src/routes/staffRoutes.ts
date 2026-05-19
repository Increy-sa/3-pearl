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

const router = Router();
const prisma = new PrismaClient();
const DEFAULT_AGENCY_PROFILE = {
  agencyName: 'وكالة الإدارة الرقمية',
  contactEmail: 'admin@agency.com',
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
  qa: { select: { id: true, name: true, email: true, role: true } },
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
        whereClause = { ...whereClause, OR: [{ designerId: userId }, { stage: 'DESIGN' }] };
        break;
      case 'DEVELOPER':
        whereClause = { ...whereClause, OR: [{ developerId: userId }, { stage: 'DEVELOPMENT' }] };
        break;
      case 'QA':
        whereClause = { ...whereClause, stage: 'REVIEW' };
        break;
      default:
        return res.json([]);
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: FULL_TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

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
        qaId,
        customSlaHours,
        amInstructions,
        designerInstructions,
        developerInstructions,
        qaInstructions,
      } = req.body;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      const updateData: any = {};
      if (accountManagerId !== undefined) updateData.accountManagerId = accountManagerId || null;
      if (designerId !== undefined) updateData.designerId = designerId || null;
      if (developerId !== undefined) updateData.developerId = developerId || null;
      if (qaId !== undefined) updateData.qaId = qaId || null;
      if (customSlaHours !== undefined) updateData.customSlaHours = customSlaHours ? parseInt(customSlaHours) : null;
      if (amInstructions !== undefined) updateData.amInstructions = amInstructions?.trim() ? amInstructions.trim() : null;
      if (designerInstructions !== undefined) updateData.designerInstructions = designerInstructions?.trim() ? designerInstructions.trim() : null;
      if (developerInstructions !== undefined) updateData.developerInstructions = developerInstructions?.trim() ? developerInstructions.trim() : null;
      if (qaInstructions !== undefined) updateData.qaInstructions = qaInstructions?.trim() ? qaInstructions.trim() : null;

      const isNewAssignment = (designerId || developerId) &&
        !ticket.designerId && !ticket.developerId;
      
      if (isNewAssignment && ticket.stage === 'INTAKE') {
        updateData.stage = 'LEGAL_PROCESSING';
        updateData.stageEnteredAt = new Date();
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: FULL_TICKET_INCLUDE,
      });

      const assignedNames = [];
      if (accountManagerId) assignedNames.push(`AM: ${updated.accountManager?.name}`);
      if (designerId) assignedNames.push(`Designer: ${updated.designer?.name}`);
      if (developerId) assignedNames.push(`Developer: ${updated.developer?.name}`);
      if (qaId) assignedNames.push(`QA: ${updated.qa?.name}`);
      if (customSlaHours) assignedNames.push(`SLA: ${customSlaHours}h`);
      if (
        amInstructions !== undefined ||
        designerInstructions !== undefined ||
        developerInstructions !== undefined ||
        qaInstructions !== undefined
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
              updateData.qaInstructions
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
// PUT /api/staff/tickets/:id/legal-processing
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

router.put(
  '/tickets/:id/legal-processing',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { documentFileUrl, domainName, sallaStoreUrl, storeEmail, storePassword } = req.body;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

      // Update ClientInfo for documentFileUrl
      if (documentFileUrl) {
        await prisma.clientInfo.update({
          where: { id: ticket.clientId },
          data: { documentFileUrl, hasDocument: true, legalDocUrl: documentFileUrl, hasLegalDoc: true }
        });
      }

      // Update or Create StoreDetails
      const storeData: any = {};
      if (domainName !== undefined) storeData.domainName = domainName;
      if (sallaStoreUrl !== undefined) storeData.sallaStoreUrl = sallaStoreUrl;
      if (storeEmail !== undefined) storeData.storeEmail = storeEmail;
      if (storePassword) storeData.storePasswordEncrypted = encrypt(storePassword);

      if (Object.keys(storeData).length > 0) {
        const existingStore = await prisma.storeDetails.findUnique({ where: { ticketId: id } });
        if (existingStore) {
          await prisma.storeDetails.update({ where: { ticketId: id }, data: storeData });
        } else {
          await prisma.storeDetails.create({ data: { ticketId: id, ...storeData } });
        }
      }

      const updated = await prisma.ticket.findUnique({
        where: { id },
        include: FULL_TICKET_INCLUDE
      });

      res.json(updated);
    } catch (e: any) {
      console.error('[staff/legal-processing] Error:', e.message);
      res.status(500).json({ error: 'فشل حفظ البيانات القانونية' });
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
        ticket.qaId === userId;

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
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      if (id === req.user!.userId) {
        return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' });
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

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
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      if (id === req.user!.userId) {
        return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

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
    const { agencyName, contactEmail } = req.body ?? {};
    if (!agencyName || !contactEmail) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الوكالة والبريد الإلكتروني' });
    }
    agencyProfile.agencyName = agencyName;
    agencyProfile.contactEmail = contactEmail;
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

export default router;
