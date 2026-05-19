import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { generateBrandProposal, generateLogoSVG, generateFullBrandIdentity } from './services/geminiService';
import { authenticateToken, AuthRequest } from './middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { encrypt, decrypt, validateEncryptionKey } from './utils/crypto';
import { STAGES, STAGE_LABELS, SLA_HOURS, isValidTransition, isSlaBreached, getSlaRemainingHours } from './config/stages';
import { STAGE_CHECKLISTS, areChecklistItemsComplete, getRoleForStage } from './config/workflow';
import staffRoutes from './routes/staffRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { validateLoginBody, validateOnboardingBody, validateLegalBody } from './utils/validators';

const app = express();
const port = process.env.PORT || 5000;

const getGenAI = () => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const key = rawKey.replace(/["']/g, '').trim();
  if (!key) console.error("CRITICAL: Missing API Key");
  return new GoogleGenerativeAI(key);
};

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-development';
const prisma = new PrismaClient();

// CORS: read allowed origin from env, fallback to localhost for dev
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Staff Operations API
app.use('/api/staff', staffRoutes);

// Third-Party Webhooks
app.use('/api/webhooks', webhookRoutes);

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, "");
    const finalFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(uploadsDir, finalFileName), base64Data, 'base64');
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    res.json({ url: `${baseUrl}/uploads/${finalFileName}` });
  } catch (e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.get('/api/health', (req, res) => { res.json({ status: 'ok' }); });

app.post('/api/seed-staff', async (req, res) => {
  const staff = [
    { name: 'مدير النظام', email: 'admin@agency.com', role: 'ADMIN' },
    { name: 'سارة', email: 'am@agency.com', role: 'ACCOUNT_MANAGER' },
    { name: 'خالد', email: 'designer@agency.com', role: 'DESIGNER' },
    { name: 'عمر', email: 'dev@agency.com', role: 'DEVELOPER' },
    { name: 'نورة', email: 'qa@agency.com', role: 'QA' },
  ];
  for (const s of staff) {
    if (!(await prisma.user.findUnique({ where: { email: s.email } }))) {
      await prisma.user.create({ data: s });
    }
  }
  res.json({ message: 'Seeded' });
});

// AI Routes
app.post('/api/ai/suggest-brand', async (req, res) => {
  try {
    const { businessName, industry, description } = req.body;
    const proposal = await generateBrandProposal(businessName, industry, description);
    res.json(proposal);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/generate-logo', async (req, res) => {
  try {
    const { brandName, industry, colors } = req.body;
    const logoUrl = await generateLogoSVG(brandName, industry, colors);
    res.json({ logoUrl });
  } catch (e) { res.status(500).json({ error: 'Logo failed' }); }
});

// Full Brand Identity Generation (called by ClientIntakeForm)
app.post('/api/tickets/create-with-ai', async (req, res) => {
  try {
    const { businessName, industry, description, targetAudience, email } = req.body;

    // ── Input Validation ──────────────────────────────────────────────────────
    const validation = validateOnboardingBody(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!businessName || !industry) {
      return res.status(400).json({ error: 'اسم النشاط ومجال العمل مطلوبان' });
    }

    console.log(`[create-with-ai] Generating full brand identity for: ${businessName} (${industry})`);

    const identity = await generateFullBrandIdentity(
      businessName,
      industry,
      description || '',
      targetAudience || 'الجميع'
    );

    // ── Persist ClientInfo — store ALL form data (legal + store) ─────────────
    // ClientIntakeForm spreads legalData into the request body, so every field
    // the customer filled in LegalInfoForm is available here. Save all of it so
    // the customer dashboard shows uploaded documents and legal status correctly.
    if (email) {
      const existing = await prisma.clientInfo.findFirst({ where: { email } });

      const allFormData: Record<string, any> = {
        // Store / brand fields
        businessName,
        industry,
        description:    description    || '',
        targetAudience: targetAudience || 'الجميع',

        // Legal / identity fields (from LegalInfoForm via legalData spread)
        customerName:    req.body.customerName    || undefined,
        phone:           req.body.phone           || undefined,
        nationalId:      req.body.nationalId      || undefined,
        iban:            req.body.iban            || undefined,
        hasDocument:     req.body.hasDocument     ?? undefined,
        hasLegalDoc:     req.body.hasLegalDoc     ?? undefined,
        documentFileUrl: req.body.documentFileUrl || undefined,  // "yes" branch — uploaded file
        nationalIdUrl:   req.body.nationalIdUrl   || undefined,  // "no" branch — ID photo
        fullNameInId:    req.body.fullNameInId    || undefined,
        absherPhone:     req.body.absherPhone     || undefined,

      };

      // Strip undefined so Prisma doesn't overwrite existing values with null
      const cleanData = Object.fromEntries(
        Object.entries(allFormData).filter(([, v]) => v !== undefined)
      );

      let clientInfoId: string;
      if (existing) {
        await prisma.clientInfo.update({ where: { id: existing.id }, data: cleanData });
        clientInfoId = existing.id;
      } else {
        // Required fields must be explicit for Prisma's type checker
        const created = await prisma.clientInfo.create({
          data: {
            customerName:  (cleanData.customerName  as string) || '',
            email:         email as string,
            businessName:  (cleanData.businessName  as string) || businessName,
            industry:      (cleanData.industry      as string) || industry,
            description:   (cleanData.description   as string) || '',
            targetAudience:(cleanData.targetAudience as string) || 'الجميع',
            ...cleanData,
          },
        });
        clientInfoId = created.id;
      }

      // ── Re-link ticket so dashboard always reads the updated ClientInfo ─────
      // The Adtopia webhook may have created a separate ClientInfo and linked the
      // ticket to it. Update the ticket's clientId to point to this record so
      // the dashboard's /api/customer/my-ticket returns the correct client data.
      const user = await prisma.user.findUnique({ where: { email: email as string } });
      if (user) {
        await prisma.ticket.updateMany({
          where: { customerId: user.id },
          data:  { clientId: clientInfoId },
        });
        console.log(`[create-with-ai] Ticket(s) re-linked to ClientInfo ${clientInfoId} for user ${user.id}`);
      }
      // ─────────────────────────────────────────────────────────────────────────

      console.log(`[create-with-ai] ClientInfo persisted for ${email}`, Object.keys(cleanData));
    }

    // ─────────────────────────────────────────────────────────────────────────


    const suggestedNames: string[] = [];
    if (identity.suggestedName) suggestedNames.push(identity.suggestedName);
    if (identity.alternativeNames && Array.isArray(identity.alternativeNames)) {
      suggestedNames.push(...identity.alternativeNames);
    }

    const colorPalette = (identity.brandColors || []).map((c: any) => c.hex);

    res.json({
      aiProposal: {
        suggestedNames,
        colorPalette,
        brandVoice: identity.brandVoice || '',
        slogan: identity.slogan || '',
        brandColors: identity.brandColors || [],
        logoDescription: identity.logoDescription || '',
        brandPersonality: identity.brandPersonality || '',
        typography: identity.typography || {},
        rationale: identity.rationale || '',
      }
    });
  } catch (error: any) {
    console.error('[create-with-ai] Error:', error.message);
    res.status(500).json({ error: error.message || 'فشل توليد الهوية البصرية' });
  }
});

// Ticket Logic
app.post('/api/tickets/create-final', async (req, res) => {
  try {
    const data = req.body;

    // ── Input Validation ──────────────────────────────────────────────────────
    const validation = validateLegalBody(data);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Validate required fields
    if (!data.customerName || !data.email || !data.businessName || !data.industry) {
      return res.status(400).json({ error: 'Missing required fields: customerName, email, businessName, industry' });
    }


    // Create or reuse user (handle duplicate email gracefully)
    let user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      user = await prisma.user.create({ 
        data: { email: data.email, name: data.customerName, role: "CUSTOMER" } 
      });
    }

    // Create client info record
    // Smart detection: if frontend sent needsLegalExtraction use it,
    // otherwise infer: has ID/absher data but no document → needs extraction
    const hasDocFile = !!(data.documentFileUrl || data.legalDocUrl);
    const hasExtractionData = !!(data.nationalIdUrl || data.fullNameInId || data.absherPhone);
    const inferredNeedsExtraction = !hasDocFile && hasExtractionData;
    const finalNeedsExtraction = data.needsLegalExtraction === true || inferredNeedsExtraction;
    const finalHasLegalDoc = data.hasLegalDoc === true || data.hasDocument === true || hasDocFile;

    console.log('[create-final] RESOLVED:', { finalNeedsExtraction, finalHasLegalDoc, hasDocFile, hasExtractionData });

    const client = await prisma.clientInfo.create({ data: {
      customerName: data.customerName,
      businessName: data.businessName,
      industry: data.industry,
      description: data.description || '',
      targetAudience: data.targetAudience || 'الجميع',
      email: data.email,
      phone: data.phone || null,
      nationalId: data.nationalId || null,
      iban: data.iban || null,
      hasLegalDoc: finalHasLegalDoc,
      hasDocument: data.hasDocument === true || hasDocFile,
      needsLegalExtraction: finalNeedsExtraction,
      documentFileUrl: data.documentFileUrl || data.legalDocUrl || null,
      legalDocUrl: data.documentFileUrl || data.legalDocUrl || null,
      nationalIdUrl: data.nationalIdUrl || null,
      fullNameInId: data.fullNameInId || null,
      absherPhone: data.absherPhone || null,
      docsApproved: false,
    }});



    // Create ticket with AI proposal
    const ticket = await prisma.ticket.create({ data: {
      clientId: client.id,
      customerId: user.id,
      stage: 'INTAKE',
      checklists: "[]",
      aiProposal: { create: {
        suggestedNames: "[]",
        businessName: data.selectedName || data.businessName,
        selectedName: data.selectedName || data.businessName,
        brandVoice: data.brandVoice || '',
        brandVision: data.brandVision || '',
        brandDescription: data.brandDescription || '',
        selectedColors: JSON.stringify(data.colorPalette || []),
        industry: data.industry || '',
        referenceLogos: JSON.stringify(data.referenceLogos || []),
        generatedLogoUrl: data.generatedLogoUrl || null
      }}
    }});

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      success: true, 
      ticket, 
      token, 
      user: { id: user.id, email: user.email, role: user.role, name: user.name } 
    });
  } catch (e: any) {
    console.error('[create-final] Error:', e.message, e.code);
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى استخدام بريد آخر.' });
    }
    res.status(500).json({ error: e.message || 'Create failed' });
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/auth/verify-email — Step 1: Check if user exists + role
// ════════════════════════════════════════════════════════════════
app.post('/api/auth/verify-email', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (user.isActive === false) return res.status(403).json({ error: 'الحساب معطل من قبل الإدارة' });

  const isStaff = ['ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'QA'].includes(user.role);
  const hasPassword = !!user.passwordHash;

  res.json({
    exists: true,
    role: user.role,
    requiresPassword: isStaff && hasPassword,
    name: user.name,
  });
});

// ════════════════════════════════════════════════════════════════
// POST /api/auth/login — Step 2: Complete login (with optional password)
// ════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // ── Input Validation ────────────────────────────────────────────────────────
  const validation = validateLoginBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }
  // ───────────────────────────────────────────────────────────────────────────

  const user = await prisma.user.findUnique({ where: { email: email?.trim()?.toLowerCase() } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isActive === false) return res.status(403).json({ error: 'الحساب معطل من قبل الإدارة' });

  // ── Password verification for staff roles ─────────────────────────────────
  const isStaff = ['ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'QA'].includes(user.role);
  if (isStaff && user.passwordHash) {
    if (!password) {
      return res.status(401).json({ error: 'كلمة المرور مطلوبة' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── Onboarding Guard ──────────────────────────────────────────────────────
  let isProfileComplete = true;
  let customerPhone: string | null = null;
  if (user.role === 'CUSTOMER') {
    const clientInfo = await prisma.clientInfo.findFirst({
      where: {
        email: user.email,
        NOT: { industry: 'غير محدد' },
      },
    });
    isProfileComplete = !!clientInfo;
    const anyClientInfo = clientInfo ?? await prisma.clientInfo.findFirst({ where: { email: user.email } });
    customerPhone = anyClientInfo?.phone ?? null;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    isProfileComplete,
    user: { id: user.id, email: user.email, role: user.role, name: user.name, phone: customerPhone },
  });

});

// ════════════════════════════════════════════════════════════════
// PUT /api/auth/change-password — Change password (authenticated)
// ════════════════════════════════════════════════════════════════
app.put('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // If user already has a password, verify old password
    if (user.passwordHash) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'كلمة المرور الحالية مطلوبة' });
      }
      const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }
    }

    // Hash and save new password
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (e: any) {
    console.error('[change-password] Error:', e.message);
    res.status(500).json({ error: 'فشل تغيير كلمة المرور' });
  }
});



app.get('/api/customer/my-ticket', authenticateToken, async (req: AuthRequest, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { customerId: req.user!.userId },
    include: { client: true, aiProposal: true, storeDetails: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json(ticket);
});

app.post('/api/customer/approve-design', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ticketId, action, feedback } = req.body;
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, customerId: req.user!.userId }
    });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    // Accept both DESIGN (legacy) and PENDING_CLIENT_APPROVAL (new flow)
    if (!['DESIGN', 'PENDING_CLIENT_APPROVAL'].includes(ticket.stage)) {
      return res.status(400).json({ error: 'الطلب ليس في مرحلة انتظار الاعتماد' });
    }

    if (action === 'APPROVE') {
      // Change stage to CLIENT_APPROVED — designer will assign developer and move to DEVELOPMENT
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          stage: 'CLIENT_APPROVED',
          stageEnteredAt: new Date(),
          customerApproved: true,
        },
        include: {
          client: true,
          aiProposal: true,
          storeDetails: true,
          accountManager: true,
          designer: true,
          developer: true,
        }
      });
      // Notify designer about approval
      await prisma.notification.createMany({
        data: [
          {
            role: 'DESIGNER',
            ticketId,
            title: '✅ اعتماد التصاميم',
            message: `العميل اعتمد التصاميم. يرجى تعيين مطوّر وتحويل الطلب إلى مرحلة التطوير.`,
            isPriority: true
          },
          {
            role: 'ADMIN',
            ticketId,
            title: '✅ اعتماد عميل للتصاميم',
            message: `العميل اعتمد التصاميم. ينتظر الطلب تعيين مطوّر وتحويله للتطوير.`,
            isPriority: true
          }
        ]
      });
      res.json({ success: true, ticket: updated });

    } else if (action === 'REVISE') {
      // Change stage to CLIENT_REVISION — ticket returns to designer
      const newNote = `\n--- تعليق العميل (طلب تعديل تصميم) ---\n${feedback}`;
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          stage: 'CLIENT_REVISION',
          stageEnteredAt: new Date(),
          customerApproved: false,
          staffNotes: (ticket.staffNotes || '') + newNote,
        },
        include: {
          client: true,
          aiProposal: true,
          storeDetails: true,
          accountManager: true,
          designer: true,
          developer: true,
        }
      });
      // Notify designer about revision request
      await prisma.notification.createMany({
        data: [
          {
            role: 'DESIGNER',
            ticketId,
            title: '✏️ طلب تعديل تصميم',
            message: `العميل طلب تعديلات على التصاميم. ملاحظاته: ${feedback}`,
            isPriority: true
          },
          {
            role: 'ADMIN',
            ticketId,
            title: '✏️ طلب تعديل من العميل',
            message: `العميل طلب تعديلات. ملاحظاته: ${feedback}`,
            isPriority: false
          }
        ]
      });
      res.json({ success: true, ticket: updated });
    } else {
      res.status(400).json({ error: 'إجراء غير صالح' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'حدث خطأ' });
  }
});

// Designer: Submit designs to client for approval
app.post('/api/designer/submit-for-approval', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { role, userId } = req.user!;
    if (!['DESIGNER', 'ADMIN'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { ticketId } = req.body;
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (!['DESIGN', 'CLIENT_REVISION'].includes(ticket.stage)) {
      return res.status(400).json({ error: 'يجب أن يكون الطلب في مرحلة التصميم أو طلب التعديل' });
    }

    // Ensure design files exist before sending to client
    if (!ticket.designLogoUrl) {
      return res.status(400).json({ error: 'يجب رفع ملفات التصميم (شعار + بنرات) قبل إرسالها للعميل' });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: 'PENDING_CLIENT_APPROVAL', stageEnteredAt: new Date() }
    });

    // Notify the customer (targeted by userId on ticket)
    if (ticket.customerId) {
      await prisma.notification.create({
        data: {
          userId: ticket.customerId,
          ticketId,
          title: '🎨 طلب اعتماد التصاميم',
          message: 'لديك طلب اعتماد قائم. يرجى مراجعة تصاميم متجرك واعتمادها أو طلب التعديل.',
          isPriority: true
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        ticketId,
        userId,
        action: 'DESIGN_SUBMITTED_FOR_APPROVAL',
        details: JSON.stringify({ stage: 'PENDING_CLIENT_APPROVAL' })
      }
    });

    res.json({ success: true, ticket: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'حدث خطأ' });
  }
});

// Designer: After CLIENT_APPROVED — move to DEVELOPMENT (requires developer assigned)
app.post('/api/designer/move-to-development', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { role, userId } = req.user!;
    if (!['DESIGNER', 'ADMIN'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { ticketId } = req.body;
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (ticket.stage !== 'CLIENT_APPROVED') {
      return res.status(400).json({ error: 'يجب أن تكون التصاميم معتمدة من العميل أولاً' });
    }
    if (!ticket.developerId) {
      return res.status(400).json({ error: 'يجب تعيين مطوّر من فريق البرمجة قبل التحويل إلى التطوير' });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: 'DEVELOPMENT', stageEnteredAt: new Date() }
    });

    await prisma.notification.create({
      data: {
        userId: ticket.developerId,
        ticketId,
        title: '💻 طلب جديد للتطوير',
        message: 'تم تحويل طلب بتصاميم معتمدة إليك. يرجى البدء بالتطوير.',
        isPriority: true
      }
    });

    await prisma.auditLog.create({
      data: {
        ticketId,
        userId,
        action: 'MOVED_TO_DEVELOPMENT',
        details: JSON.stringify({ stage: 'DEVELOPMENT', developerId: ticket.developerId })
      }
    });

    res.json({ success: true, ticket: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'حدث خطأ' });
  }
});

// ── Developer: Mark Work as Complete ─────────────────────────────────────────
app.post('/api/developer/complete-work', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ticketId } = req.body;
    const userId = req.user!.userId;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!['ADMIN', 'DEVELOPER'].includes(req.user!.role))
      return res.status(403).json({ error: 'غير مصرح' });
    if (!['DEVELOPMENT', 'DEVELOPMENT_REVISION'].includes(ticket.stage))
      return res.status(400).json({ error: 'الطلب ليس في مرحلة التطوير' });
    if (ticket.developerId !== userId && req.user!.role !== 'ADMIN')
      return res.status(403).json({ error: 'أنت لست المطوّر المعيّن لهذا الطلب' });

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: 'PENDING_AM_REVIEW', stageEnteredAt: new Date() },
      include: { client: true, aiProposal: true, storeDetails: true, accountManager: true, designer: true, developer: true }
    });

    // Notify the Account Manager assigned to this ticket
    if (ticket.accountManagerId) {
      await prisma.notification.create({
        data: {
          userId: ticket.accountManagerId,
          ticketId,
          title: '🔍 طلب مراجعة من المطوّر',
          message: `أنهى المطوّر العمل على الطلب وهو بانتظار مراجعتك وموافقتك.`,
          isPriority: true
        }
      });
    }
    // Also notify by role
    await prisma.notification.create({
      data: {
        role: 'ACCOUNT_MANAGER',
        ticketId,
        title: '🔍 طلب جاهز للمراجعة',
        message: `أنهى المطوّر العمل على طلب وهو بانتظار مراجعتك.`,
        isPriority: true
      }
    });

    await prisma.auditLog.create({
      data: {
        ticketId,
        userId,
        action: 'DEVELOPER_COMPLETED',
        details: JSON.stringify({ from: ticket.stage, to: 'PENDING_AM_REVIEW' })
      }
    }).catch(() => {});

    res.json({ success: true, ticket: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'حدث خطأ' });
  }
});

// ── Account Manager: Review Developer Work ────────────────────────────────────
app.post('/api/am/review-development', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ticketId, action, feedback } = req.body;
    const userId = req.user!.userId;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(req.user!.role))
      return res.status(403).json({ error: 'غير مصرح' });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (ticket.stage !== 'PENDING_AM_REVIEW')
      return res.status(400).json({ error: 'الطلب ليس في مرحلة انتظار المراجعة' });

    if (action === 'APPROVE') {
      const { siteUrl } = req.body;

      // Move directly to DELIVERED — AM is the final approver
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          stage: 'DELIVERED',
          stageEnteredAt: new Date(),
          deliveredSiteUrl: siteUrl?.trim() || null,
        },
        include: { client: true, aiProposal: true, storeDetails: true, accountManager: true, designer: true, developer: true }
      });

      // Notify the customer
      if (ticket.customerId) {
        await prisma.notification.create({
          data: {
            userId: ticket.customerId,
            ticketId,
            title: '🎉 تم الانتهاء من مشروعك!',
            message: `يسعدنا إبلاغك بأن مشروعك اكتمل بنجاح وهو الآن جاهز للاستخدام.${siteUrl ? ` رابط الموقع: ${siteUrl}` : ''}`,
            isPriority: true
          }
        });
      }
      // Notify ADMIN
      await prisma.notification.create({
        data: {
          role: 'ADMIN',
          ticketId,
          title: '✅ طلب مُسلَّم',
          message: `وافق مدير الحساب وتم تسليم الطلب للعميل.`,
          isPriority: false
        }
      });

      await prisma.auditLog.create({
        data: { ticketId, userId, action: 'AM_APPROVED_DELIVERED',
          details: JSON.stringify({ to: 'DELIVERED', siteUrl }) }
      }).catch(() => {});

      res.json({ success: true, ticket: updated });

    } else if (action === 'REVISE') {
      if (!feedback?.trim())
        return res.status(400).json({ error: 'يرجى إرفاق ملاحظات التعديل' });

      const newNote = `\n--- ملاحظات مدير الحساب (طلب تعديل تطوير) ---\n${feedback}`;
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          stage: 'DEVELOPMENT_REVISION',
          stageEnteredAt: new Date(),
          staffNotes: (ticket.staffNotes || '') + newNote,
        },
        include: { client: true, aiProposal: true, storeDetails: true, accountManager: true, designer: true, developer: true }
      });

      // Notify developer
      if (ticket.developerId) {
        await prisma.notification.create({
          data: {
            userId: ticket.developerId,
            ticketId,
            title: '⚠️ طلب تعديل من مدير الحساب',
            message: `طلب مدير الحساب تعديلات على العمل. ملاحظاته: ${feedback}`,
            isPriority: true
          }
        });
      }
      await prisma.notification.create({
        data: {
          role: 'DEVELOPER',
          ticketId,
          title: '⚠️ تعديلات مطلوبة',
          message: `طلب مدير الحساب تعديلات. ملاحظاته: ${feedback}`,
          isPriority: true
        }
      });

      await prisma.auditLog.create({
        data: { ticketId, userId, action: 'AM_REQUESTED_REVISION',
          details: JSON.stringify({ feedback, to: 'DEVELOPMENT_REVISION' }) }
      }).catch(() => {});

      res.json({ success: true, ticket: updated });
    } else {
      res.status(400).json({ error: 'إجراء غير صالح' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'حدث خطأ' });
  }
});

app.get('/api/tickets', authenticateToken, async (req: AuthRequest, res) => {
  const tickets = await prisma.ticket.findMany({
    include: { client: true, aiProposal: true, storeDetails: true, accountManager: true, designer: true, developer: true },
    orderBy: { createdAt: 'desc' }
  });
  const enriched = tickets.map(t => ({
    ...t,
    slaBreached: isSlaBreached(t.stage, t.stageEnteredAt),
    slaRemainingHours: getSlaRemainingHours(t.stage, t.stageEnteredAt),
    stageLabel: STAGE_LABELS[t.stage as keyof typeof STAGE_LABELS] || t.stage
  }));
  res.json(enriched);
});

app.put('/api/tickets/:id/stage', authenticateToken, async (req: AuthRequest, res) => {
  const id = req.params['id'] as string;
  const stage = req.body['stage'] as string;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: 'Not found' });

  if (ticket.stage === 'DEVELOPMENT' && stage === 'REVIEW') {
    const cl = JSON.parse(ticket.checklists || '[]');
    if (!areChecklistItemsComplete(ticket.stage, cl)) return res.status(400).json({ error: 'Checklist incomplete' });
  }

  if (ticket.stage === 'LEGAL_PROCESSING' && stage !== 'INTAKE' && stage !== 'LEGAL_PROCESSING') {
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: id },
      include: { client: true, storeDetails: true }
    });
    const clientData = (fullTicket as any)?.client;
    const storeData = (fullTicket as any)?.storeDetails;
    const hasDoc = clientData?.documentFileUrl || clientData?.legalDocUrl;
    
    const missing = [];
    if (!hasDoc) missing.push('وثيقة العمل الحر');
    if (!storeData?.domainName) missing.push('اسم الدومين');
    if (!storeData?.sallaStoreUrl) missing.push('رابط متجر سلة / زد');
    
    if (missing.length > 0) {
      return res.status(400).json({ error: `يرجى (حفظ البيانات القانونية) والتأكد من تعبئة: ${missing.join('، ')}` });
    }
  }

  if (stage === 'DESIGN' && !ticket.designerId) {
    return res.status(400).json({ error: 'يجب تعيين مصمم (عضو للفريق) قبل تغيير الحالة إلى التصميم.' });
  }

  if (['DESIGN', 'CLIENT_REVISION'].includes(ticket.stage) &&
      !['INTAKE', 'LEGAL_PROCESSING', 'DESIGN', 'CLIENT_REVISION', 'PENDING_CLIENT_APPROVAL'].includes(stage)) {
    const missing = [];
    if (!ticket.designLogoUrl) missing.push('شعار المتجر');
    
    let banners: string[] = [];
    try { banners = JSON.parse(ticket.designBannersUrl || '[]'); } catch { banners = ticket.designBannersUrl ? [ticket.designBannersUrl] : []; }
    if (banners.length === 0 && stage !== 'CLIENT_REVISION') missing.push('البنرات');

    if (missing.length > 0) {
      return res.status(400).json({ error: `يرجى من المصمم (حفظ ملفات التصميم) والتأكد من إرفاق: ${missing.join('، ')}` });
    }
  }

  if (stage === 'DEVELOPMENT' && !ticket.developerId) {
    return res.status(400).json({ error: 'يجب تعيين مطور (عضو للفريق) قبل تغيير الحالة إلى التطوير.' });
  }
  if (stage === 'REVIEW' && !ticket.qaId) {
    return res.status(400).json({ error: 'يجب تعيين مراجع جودة (عضو للفريق) قبل تغيير الحالة إلى المراجعة.' });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { stage, stageEnteredAt: new Date(), isSlaBreached: false },
    include: { client: true }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: id,
      userId: req.user!.userId,
      action: 'STAGE_CHANGED',
      details: JSON.stringify({ from: ticket.stage, to: stage })
    }
  }).catch(() => {});

  const targetRole = getRoleForStage(stage);
  if (targetRole) {
    await prisma.notification.create({ data: {
      role: targetRole as string, ticketId: id, title: 'New Task',
      message: `Ticket moved to ${stage}`, isPriority: true
    }});
  }
  res.json(updated);
});

app.put('/api/tickets/:id/assign', authenticateToken, async (req: AuthRequest, res) => {
  const id = req.params['id'] as string;
  const { accountManagerId, designerId, developerId } = req.body;
  const updated = await prisma.ticket.update({
    where: { id },
    data: { accountManagerId, designerId, developerId }
  });
  res.json(updated);
});

app.get('/api/staff', authenticateToken, async (req: AuthRequest, res) => {
  const staff = await prisma.user.findMany({ where: { role: { not: 'CUSTOMER' } } });
  res.json(staff);
});

app.put('/api/tickets/:id/checklist', authenticateToken, async (req: AuthRequest, res) => {
  const id = req.params['id'] as string;
  const { checklist } = req.body;
  const updated = await prisma.ticket.update({ where: { id }, data: { checklists: JSON.stringify(checklist) } });
  res.json(updated);
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId: req.user!.userId }, { role: req.user!.role }] },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notifications);
});

// Admin: Staff CRUD
app.get('/api/admin/staff', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  const staff = await prisma.user.findMany({ where: { role: { not: 'CUSTOMER' } } });
  res.json(staff);
});

app.post('/api/admin/staff', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  const { name, email, role, password } = req.body;
  const user = await prisma.user.create({ data: {
    name, email, role, passwordHash: password ? await bcrypt.hash(password, 10) : null
  }});
  res.json(user);
});

// ── Save AI Proposal for authenticated customers ───────────────────────────────
// Called when an already-logged-in customer confirms the AI proposal.
// Updates (or creates) the aiProposal linked to their ticket so the dashboard
// can display the full brand identity: colors, slogan, brandVoice, etc.
app.post('/api/tickets/save-ai-proposal', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    const {
      selectedName,
      colorPalette,
      brandVoice,
      brandVision,
      brandDescription,
      slogan,
      brandColors,
      typography,
      rationale,
      logoDescription,
      referenceLogos,
      generatedLogoUrl,
      // intake fields
      businessName,
      industry,
      description,
      targetAudience,
    } = req.body;

    // Find the customer's ticket
    const ticket = await prisma.ticket.findFirst({
      where: { customerId: userId },
      include: { aiProposal: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'لم يتم العثور على طلب مرتبط بحسابك' });
    }

    const proposalData = {
      businessName:     selectedName || businessName || '',
      selectedName:     selectedName || businessName || '',
      industry:         industry || '',
      brandVoice:       brandVoice || '',
      brandVision:      brandVision || slogan || '',
      brandDescription: brandDescription || logoDescription || description || '',
      selectedColors:   JSON.stringify(colorPalette || []),
      referenceLogos:   JSON.stringify(referenceLogos || []),
      generatedLogoUrl: generatedLogoUrl || null,
      suggestedNames:   JSON.stringify([selectedName].filter(Boolean)),
    };

    if (ticket.aiProposal) {
      // Update existing aiProposal
      await prisma.aIProposal.update({
        where: { id: ticket.aiProposal.id },
        data: proposalData,
      });
    } else {
      // Create new aiProposal linked to the ticket
      await prisma.aIProposal.create({
        data: { ...proposalData, ticketId: ticket.id },
      });
    }

    // Also update ClientInfo with latest intake data
    const clientInfo = await prisma.clientInfo.findFirst({ where: { id: ticket.clientId || '' } });
    if (clientInfo) {
      await prisma.clientInfo.update({
        where: { id: clientInfo.id },
        data: {
          ...(businessName  && { businessName }),
          ...(industry      && { industry }),
          ...(description   && { description }),
          ...(targetAudience && { targetAudience }),
        },
      });
    }

    console.log(`[save-ai-proposal] Saved for userId=${userId}, ticketId=${ticket.id}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[save-ai-proposal] Error:', error.message);
    res.status(500).json({ error: error.message || 'فشل حفظ بيانات الهوية' });
  }
});

async function start() {

  validateEncryptionKey();
  await prisma.$connect();
  app.listen(port, () => console.log(`Server on ${port}`));
}
start();
