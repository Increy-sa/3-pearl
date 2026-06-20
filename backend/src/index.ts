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

// CORS: accept both localhost (dev) and production domain
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://fawri.net',
  'https://www.fawri.net',
].filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development; tighten in production if needed
    }
  },
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
// Prisma Client v5.20.0 — regenerated with SeoChecklist fields (sallaEmail, sallaPassword, packageType)

// Third-Party Webhooks
app.use('/api/webhooks', webhookRoutes);

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, "");
    const finalFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(uploadsDir, finalFileName), base64Data, 'base64');

    // Auto-detect the correct base URL from the request
    // This handles both local dev and production behind nginx proxy
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || `localhost:${port}`;
    const detectedBaseUrl = `${protocol}://${host}`;
    // Use detected URL, but allow BASE_URL override if it's not localhost
    const envBaseUrl = process.env.BASE_URL || '';
    const baseUrl = (envBaseUrl && !envBaseUrl.includes('localhost')) ? envBaseUrl : detectedBaseUrl;

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
    { name: 'نورة', email: 'seo@agency.com', role: 'SEO' },
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
    // Auto-detect base URL from request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || `localhost:${port}`;
    const detectedBaseUrl = `${protocol}://${host}`;
    const envBaseUrl = process.env.BASE_URL || '';
    const baseUrl = (envBaseUrl && !envBaseUrl.includes('localhost')) ? envBaseUrl : detectedBaseUrl;
    
    const logoUrl = await generateLogoSVG(brandName, industry, colors, baseUrl);
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
        generatedLogoUrl: data.generatedLogoUrl || null,
        selectedLogoType: data.selectedLogoType || null,
        selectedLogoTypeName: data.selectedLogoTypeName || null,
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

  const isStaff = ['ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'SEO'].includes(user.role);
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
  const isStaff = ['ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'SEO'].includes(user.role);
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

// ════════════════════════════════════════════════════════════════
// INTAKE STAGE — Data Request / Response / Documents endpoints
// ════════════════════════════════════════════════════════════════

// أ- طلب بيانات إضافية من العميل (AM → Customer)
app.post('/api/tickets/:id/data-request', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const { role, userId } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (!message?.trim()) {
      return res.status(400).json({ error: 'نص الطلب مطلوب' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    const dataRequest = await prisma.dataRequest.create({
      data: {
        ticketId: id,
        fromRole: 'ACCOUNT_MANAGER',
        message: message.trim(),
      }
    });

    // Notify the customer
    if (ticket.customerId) {
      await prisma.notification.create({
        data: {
          userId: ticket.customerId,
          ticketId: id,
          title: '📋 طلب بيانات إضافية',
          message: 'مدير الحساب يطلب منك بيانات إضافية. يرجى الاطلاع والرد.',
          isPriority: true,
        }
      });
    }

    res.json(dataRequest);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إرسال الطلب' });
  }
});

// ب- رد العميل على طلب البيانات (Customer → AM)
app.post('/api/tickets/:id/data-response', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const { role, userId } = req.user!;

    if (role !== 'CUSTOMER') {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (!message?.trim()) {
      return res.status(400).json({ error: 'نص الرد مطلوب' });
    }

    // Verify ticket belongs to this customer
    const ticket = await prisma.ticket.findFirst({
      where: { id, customerId: userId }
    });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    const dataRequest = await prisma.dataRequest.create({
      data: {
        ticketId: id,
        fromRole: 'CUSTOMER',
        message: message.trim(),
      }
    });

    // Notify AM and ADMIN
    await prisma.notification.createMany({
      data: [
        {
          role: 'ACCOUNT_MANAGER',
          ticketId: id,
          title: '💬 رد العميل على طلب البيانات',
          message: 'العميل أرسل رداً على طلب البيانات الإضافية.',
          isPriority: true,
        },
        {
          role: 'ADMIN',
          ticketId: id,
          title: '💬 رد عميل على طلب بيانات',
          message: 'العميل أرسل رداً على طلب بيانات إضافية.',
          isPriority: false,
        }
      ]
    });

    res.json(dataRequest);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إرسال الرد' });
  }
});

// ج- جلب كل طلبات البيانات لتيكت معين
app.get('/api/tickets/:id/data-requests', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user!;

    // Customers can only see their own ticket's data requests
    if (role === 'CUSTOMER') {
      const ticket = await prisma.ticket.findFirst({
        where: { id, customerId: userId }
      });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const dataRequests = await prisma.dataRequest.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' }
    });

    res.json(dataRequests);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب البيانات' });
  }
});

// د- اعتماد بيانات العميل (AM يوافق على البيانات)
app.put('/api/tickets/:id/approve-intake', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Resolve the latest unresolved data request
    const latestRequest = await prisma.dataRequest.findFirst({
      where: { ticketId: id, isResolved: false },
      orderBy: { createdAt: 'desc' }
    });

    if (latestRequest) {
      await prisma.dataRequest.update({
        where: { id: latestRequest.id },
        data: { isResolved: true }
      });
    }

    // Mark all unresolved as resolved
    await prisma.dataRequest.updateMany({
      where: { ticketId: id, isResolved: false },
      data: { isResolved: true }
    });

    // Notify the customer
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (ticket?.customerId) {
      await prisma.notification.create({
        data: {
          userId: ticket.customerId,
          ticketId: id,
          title: '✅ تم اعتماد بياناتك',
          message: 'تم اعتماد بياناتك بنجاح من قبل مدير الحساب.',
          isPriority: true,
        }
      });
    }

    res.json({ success: true, message: 'تم اعتماد البيانات بنجاح' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل الاعتماد' });
  }
});

// هـ- رفع وثيقة العمل الحر أو السجل التجاري
app.put('/api/tickets/:id/upload-documents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { freelanceDocUrl, commercialRegUrl } = req.body;
    const { role } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const updateData: any = {};
    if (freelanceDocUrl !== undefined) updateData.freelanceDocUrl = freelanceDocUrl;
    if (commercialRegUrl !== undefined) updateData.commercialRegUrl = commercialRegUrl;

    const updated = await prisma.ticket.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل رفع الوثائق' });
  }
});

// ════════════════════════════════════════════════════════════════
// SEO_STORE_SETUP STAGE — Proposals / Sub-Steps / Transfer
// ════════════════════════════════════════════════════════════════

// أ- حفظ/تحديث مقترحات SEO (upsert)
app.put('/api/tickets/:id/seo-proposals', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });

    const { storeName1, storeName2, storeName3, storeName4, domain1, domain2, domain3, domain4 } = req.body;

    // Find existing or create
    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });

    const proposalData = { storeName1, storeName2, storeName3, storeName4, domain1, domain2, domain3, domain4 };

    let proposal;
    if (existing) {
      proposal = await prisma.seoProposal.update({
        where: { id: existing.id },
        data: proposalData
      });
    } else {
      proposal = await prisma.seoProposal.create({
        data: { ticketId: id, ...proposalData }
      });
    }

    res.json(proposal);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل حفظ المقترحات' });
  }
});

// ب- إرسال المقترحات لمدير الحساب
app.put('/api/tickets/:id/seo-proposals/send-to-am', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });

    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!existing) return res.status(404).json({ error: 'لا توجد مقترحات' });

    const proposal = await prisma.seoProposal.update({
      where: { id: existing.id },
      data: { status: 'SENT_TO_AM' }
    });

    // Notify AM
    await prisma.notification.create({
      data: {
        role: 'ACCOUNT_MANAGER',
        ticketId: id,
        title: '📋 مقترحات أسماء ودومينات جديدة',
        message: 'فريق SEO أرسل مقترحات الأسماء والدومينات للمراجعة.',
        isPriority: true,
      }
    });

    res.json(proposal);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إرسال المقترحات' });
  }
});

// ج- رد مدير الحساب على المقترحات
app.put('/api/tickets/:id/seo-proposals/am-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { role } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!existing) return res.status(404).json({ error: 'لا توجد مقترحات' });

    if (action === 'APPROVE') {
      const proposal = await prisma.seoProposal.update({
        where: { id: existing.id },
        data: { status: 'AM_APPROVED', amNotes: null }
      });
      res.json(proposal);
    } else if (action === 'REVISION') {
      const proposal = await prisma.seoProposal.update({
        where: { id: existing.id },
        data: { status: 'AM_REVISION', amNotes: notes || '' }
      });
      res.json(proposal);
    } else {
      res.status(400).json({ error: 'إجراء غير صالح' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل المراجعة' });
  }
});

// د- عرض المقترحات على العميل (AM يرسلها للعميل)
app.put('/api/tickets/:id/seo-proposals/send-to-client', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!existing) return res.status(404).json({ error: 'لا توجد مقترحات' });

    const proposal = await prisma.seoProposal.update({
      where: { id: existing.id },
      data: { status: 'SENT_TO_CLIENT' }
    });

    // Notify customer
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (ticket?.customerId) {
      await prisma.notification.create({
        data: {
          userId: ticket.customerId,
          ticketId: id,
          title: '🏪 مقترحات اسم المتجر والدومين',
          message: 'تم إعداد مقترحات لاسم ودومين متجرك. يرجى المراجعة والاختيار.',
          isPriority: true,
        }
      });
    }

    res.json(proposal);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل إرسال المقترحات للعميل' });
  }
});

// هـ- رد العميل على المقترحات
app.put('/api/tickets/:id/seo-proposals/client-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, selectedName, selectedDomain, notes } = req.body;
    const { role, userId } = req.user!;

    if (role !== 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });

    // Verify ticket belongs to customer
    const ticket = await prisma.ticket.findFirst({ where: { id, customerId: userId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!existing) return res.status(404).json({ error: 'لا توجد مقترحات' });

    if (action === 'APPROVE') {
      const proposal = await prisma.seoProposal.update({
        where: { id: existing.id },
        data: { status: 'CLIENT_APPROVED', selectedName, selectedDomain, clientNotes: notes || null }
      });

      // Notify AM
      await prisma.notification.create({
        data: {
          role: 'ACCOUNT_MANAGER',
          ticketId: id,
          title: '✅ العميل اعتمد المقترحات',
          message: `العميل اختار الاسم: ${selectedName} والدومين: ${selectedDomain}`,
          isPriority: true,
        }
      });

      res.json(proposal);
    } else if (action === 'REVISION') {
      const proposal = await prisma.seoProposal.update({
        where: { id: existing.id },
        data: { status: 'CLIENT_REVISION', clientNotes: notes || '' }
      });

      await prisma.notification.create({
        data: {
          role: 'ACCOUNT_MANAGER',
          ticketId: id,
          title: '⚠️ العميل طلب تعديل المقترحات',
          message: `العميل طلب تعديل مقترحات الاسم/الدومين. ملاحظاته: ${notes || 'لا توجد'}`,
          isPriority: true,
        }
      });

      res.json(proposal);
    } else {
      res.status(400).json({ error: 'إجراء غير صالح' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل المراجعة' });
  }
});

// و- اعتماد نهائي (AM يؤكد اختيارات العميل ويرسلها لـ SEO)
app.put('/api/tickets/:id/seo-proposals/finalize', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { selectedName, selectedDomain } = req.body;
    const { role } = req.user!;

    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const existing = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!existing) return res.status(404).json({ error: 'لا توجد مقترحات' });

    const proposal = await prisma.seoProposal.update({
      where: { id: existing.id },
      data: { isFinalized: true, selectedName, selectedDomain }
    });

    // Move ticket to STORE_SETUP sub-step
    await prisma.ticket.update({
      where: { id },
      data: { seoSubStep: 'STORE_SETUP' }
    });

    res.json(proposal);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل الاعتماد النهائي' });
  }
});

// ز- جلب المقترحات
app.get('/api/tickets/:id/seo-proposals', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user!;

    // Customers can only see their own ticket
    if (role === 'CUSTOMER') {
      const ticket = await prisma.ticket.findFirst({ where: { id, customerId: userId } });
      if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const proposal = await prisma.seoProposal.findFirst({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(proposal || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب المقترحات' });
  }
});

// ح- تحديث الخطوة الفرعية
app.put('/api/tickets/:id/seo-substep', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { subStep } = req.body;
    const { role } = req.user!;

    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { seoSubStep: subStep }
    });

    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث الخطوة' });
  }
});

// ط- تحويل من SEO للمصمم
app.put('/api/tickets/:id/transfer-to-designer', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { assignedDesignerId, seoBrief, customSlaHours } = req.body;
    const { role, userId } = req.user!;

    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (ticket.seoSubStep !== 'READY_TO_TRANSFER') {
      return res.status(400).json({ error: 'يجب إكمال جميع المهام قبل التحويل' });
    }
    if (!assignedDesignerId) {
      return res.status(400).json({ error: 'يجب اختيار المصمم' });
    }
    if (!seoBrief?.trim()) {
      return res.status(400).json({ error: 'يجب كتابة البريف للمصمم' });
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        assignedDesignerId,
        seoBrief: seoBrief.trim(),
        designerId: assignedDesignerId,
        stage: 'DESIGN',
        stageEnteredAt: new Date(),
        customSlaHours: customSlaHours ? parseInt(customSlaHours) : null,
      },
      include: { client: true, aiProposal: true }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        ticketId: id,
        userId,
        action: 'STAGE_CHANGED',
        details: JSON.stringify({ from: 'SEO_STORE_SETUP', to: 'DESIGN', assignedDesignerId })
      }
    }).catch(() => {});

    // Notify designer
    await prisma.notification.create({
      data: {
        userId: assignedDesignerId,
        ticketId: id,
        title: '🎨 مهمة تصميم جديدة',
        message: 'تم تحويل طلب جديد إليك من فريق SEO. يرجى الاطلاع على البريف والبدء بالعمل.',
        isPriority: true,
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل التحويل' });
  }
});

// ════════════════════════════════════════════════════════════════
// DESIGN STAGE — Design Delivery / Review / Transfer to Dev
// ════════════════════════════════════════════════════════════════

// أ- جلب بيانات التصميم
app.get('/api/tickets/:id/design-delivery', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const delivery = await prisma.designDelivery.findFirst({
      where: { ticketId: id }, orderBy: { createdAt: 'desc' }
    });
    res.json(delivery || null);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ب- حفظ تسليم التصميم
app.put('/api/tickets/:id/design-delivery', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const { figmaLink, images } = req.body;
    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : images || '[]';

    const existing = await prisma.designDelivery.findFirst({
      where: { ticketId: id }, orderBy: { createdAt: 'desc' }
    });
    let delivery;
    if (existing) {
      delivery = await prisma.designDelivery.update({
        where: { id: existing.id }, data: { figmaLink, images: imagesJson }
      });
    } else {
      delivery = await prisma.designDelivery.create({
        data: { ticketId: id, figmaLink, images: imagesJson }
      });
    }
    res.json(delivery);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ج- رفع صورة تصميم
app.post('/api/tickets/:id/design-image', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { fileName, fileData } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, "");
    const finalFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(uploadsDir, finalFileName), base64Data, 'base64');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || `localhost:${port}`;
    const detectedBaseUrl = `${protocol}://${host}`;
    const envBaseUrl = process.env.BASE_URL || '';
    const baseUrl = (envBaseUrl && !envBaseUrl.includes('localhost')) ? envBaseUrl : detectedBaseUrl;
    res.json({ url: `${baseUrl}/uploads/${finalFileName}` });
  } catch { res.status(500).json({ error: 'فشل رفع الصورة' }); }
});

// د- إرسال التصميم لـ SEO
app.put('/api/tickets/:id/design-delivery/send-to-seo', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.designDelivery.findFirst({ where: { ticketId: id }, orderBy: { createdAt: 'desc' } });
    if (!existing) return res.status(404).json({ error: 'لا يوجد تسليم' });
    const d = await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'SENT_TO_SEO' } });
    res.json(d);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// هـ- مراجعة SEO للتصميم
app.put('/api/tickets/:id/design-delivery/seo-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const existing = await prisma.designDelivery.findFirst({ where: { ticketId: id }, orderBy: { createdAt: 'desc' } });
    if (!existing) return res.status(404).json({ error: 'لا يوجد تسليم' });
    if (action === 'APPROVE') {
      res.json(await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'SEO_APPROVED', seoNotes: null } }));
    } else if (action === 'REVISION') {
      res.json(await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'SEO_REVISION', seoNotes: notes || '' } }));
    } else { res.status(400).json({ error: 'إجراء غير صالح' }); }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// و- إرسال التصميم للعميل
app.put('/api/tickets/:id/design-delivery/send-to-client', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.designDelivery.findFirst({ where: { ticketId: id }, orderBy: { createdAt: 'desc' } });
    if (!existing) return res.status(404).json({ error: 'لا يوجد تسليم' });
    const d = await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'SENT_TO_CLIENT' } });
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (ticket?.customerId) {
      await prisma.notification.create({ data: { userId: ticket.customerId, ticketId: id, title: '🎨 تصميم متجرك جاهز', message: 'التصاميم جاهزة للاعتماد.', isPriority: true } });
    }
    res.json(d);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ز- رد العميل على التصميم
app.put('/api/tickets/:id/design-delivery/client-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { role, userId } = req.user!;
    if (role !== 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const ticket = await prisma.ticket.findFirst({ where: { id, customerId: userId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    const existing = await prisma.designDelivery.findFirst({ where: { ticketId: id }, orderBy: { createdAt: 'desc' } });
    if (!existing) return res.status(404).json({ error: 'لا يوجد تسليم' });
    if (action === 'APPROVE') {
      const d = await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'CLIENT_APPROVED', isFinalized: true, clientNotes: notes || null } });
      await prisma.notification.create({ data: { role: 'ACCOUNT_MANAGER', ticketId: id, title: '✅ العميل اعتمد التصميم', message: 'العميل وافق على التصاميم.', isPriority: true } });
      res.json(d);
    } else if (action === 'REVISION') {
      const d = await prisma.designDelivery.update({ where: { id: existing.id }, data: { status: 'CLIENT_REVISION', clientNotes: notes || '' } });
      await prisma.notification.create({ data: { role: 'ACCOUNT_MANAGER', ticketId: id, title: '⚠️ العميل طلب تعديل التصميم', message: `ملاحظات: ${notes || ''}`, isPriority: true } });
      res.json(d);
    } else { res.status(400).json({ error: 'إجراء غير صالح' }); }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ح- تحويل من التصميم للتطوير
app.put('/api/tickets/:id/transfer-to-dev', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { developerId, devBrief, customSlaHours } = req.body;
    const { role, userId } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    const delivery = await prisma.designDelivery.findFirst({ where: { ticketId: id }, orderBy: { createdAt: 'desc' } });
    if (!delivery?.isFinalized) return res.status(400).json({ error: 'يجب اعتماد التصميم من العميل أولاً' });
    if (!developerId) return res.status(400).json({ error: 'يجب اختيار المطور' });
    const updated = await prisma.ticket.update({
      where: { id },
      data: { developerId, devBrief: devBrief?.trim() || null, stage: 'DEVELOPMENT', stageEnteredAt: new Date(), customSlaHours: customSlaHours ? parseInt(customSlaHours) : null },
      include: { client: true, aiProposal: true }
    });
    await prisma.auditLog.create({ data: { ticketId: id, userId, action: 'STAGE_CHANGED', details: JSON.stringify({ from: 'DESIGN', to: 'DEVELOPMENT', developerId }) } }).catch(() => {});
    await prisma.notification.create({ data: { userId: developerId, ticketId: id, title: '🔧 مهمة تطوير جديدة', message: 'تم تحويل طلب جديد إليك. يرجى البدء بالعمل.', isPriority: true } });
    res.json(updated);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ════════════════════════════════════════════════════════════════
// DEVELOPMENT STAGE — Dev Checklist / SEO Review
// ════════════════════════════════════════════════════════════════

// ط- جلب مهام المطور
app.get('/api/tickets/:id/dev-checklist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const cl = await prisma.devChecklist.findUnique({ where: { ticketId: id } });
    res.json(cl || null);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ي- تحديث مهام المطور
app.put('/api/tickets/:id/dev-checklist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const { designApplied, pagesSetup, uiTested, deliveredToSeo, isSubmittedToSeo } = req.body;
    const data: any = {};
    if (designApplied !== undefined) data.designApplied = designApplied;
    if (pagesSetup !== undefined) data.pagesSetup = pagesSetup;
    if (uiTested !== undefined) data.uiTested = uiTested;
    if (deliveredToSeo !== undefined) data.deliveredToSeo = deliveredToSeo;
    if (isSubmittedToSeo !== undefined) data.isSubmittedToSeo = isSubmittedToSeo;
    const cl = await prisma.devChecklist.upsert({
      where: { ticketId: id }, update: data, create: { ticketId: id, ...data }
    });
    res.json(cl);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ك- مراجعة SEO لعمل المطور
app.put('/api/tickets/:id/dev-checklist/seo-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { role, userId } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const cl = await prisma.devChecklist.findUnique({ where: { ticketId: id } });
    if (!cl) return res.status(404).json({ error: 'لا توجد بيانات' });
    if (action === 'APPROVE') {
      const updated = await prisma.devChecklist.update({ where: { ticketId: id }, data: { seoReviewStatus: 'APPROVED' } });
      // Transition to SEO_FINAL
      await prisma.ticket.update({ where: { id }, data: { stage: 'SEO_FINAL', stageEnteredAt: new Date() } });
      await prisma.auditLog.create({ data: { ticketId: id, userId, action: 'STAGE_CHANGED', details: JSON.stringify({ from: 'DEVELOPMENT', to: 'SEO_FINAL' }) } }).catch(() => {});
      res.json(updated);
    } else if (action === 'REVISION') {
      res.json(await prisma.devChecklist.update({ where: { ticketId: id }, data: { seoReviewStatus: 'REVISION', seoReviewNotes: notes || '' } }));
    } else { res.status(400).json({ error: 'إجراء غير صالح' }); }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ════════════════════════════════════════════════════════════════
// SEO_FINAL STAGE — Final Checklist / AM Review / Client Review / Delivery
// ════════════════════════════════════════════════════════════════

// أ- جلب مهام SEO النهائية
app.get('/api/tickets/:id/seo-final', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const cl = await prisma.seoFinalChecklist.findUnique({ where: { ticketId: id } });
    res.json(cl || null);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ب- تحديث مهام SEO النهائية
app.put('/api/tickets/:id/seo-final', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role === 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const allowed = ['paymentActivated','paymentTested','paymentGatewaysOk','shippingLinked','shippingZonesSet','shippingTested','pageTitlesSet','metaDescSet','urlsOptimized','productsOptimized','contentReviewed','finalInspection'];
    const data: any = {};
    for (const k of allowed) { if (req.body[k] !== undefined) data[k] = req.body[k]; }
    const cl = await prisma.seoFinalChecklist.upsert({
      where: { ticketId: id }, update: data, create: { ticketId: id, ...data }
    });
    res.json(cl);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ج- إرسال لمدير الحساب
app.put('/api/tickets/:id/seo-final/send-to-am', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { brief } = req.body;
    const cl = await prisma.seoFinalChecklist.update({
      where: { ticketId: id }, data: { status: 'SENT_TO_AM', seoBriefToAm: brief || '' }
    });
    await prisma.notification.create({ data: { role: 'ACCOUNT_MANAGER', ticketId: id, title: '📋 المتجر جاهز للمراجعة النهائية', message: 'فريق SEO أنهى جميع المهام.', isPriority: true } });
    res.json(cl);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// د- مراجعة مدير الحساب
app.put('/api/tickets/:id/seo-final/am-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { role } = req.user!;
    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) return res.status(403).json({ error: 'غير مصرح' });
    if (action === 'APPROVE') {
      res.json(await prisma.seoFinalChecklist.update({ where: { ticketId: id }, data: { status: 'AM_APPROVED', amNotes: null } }));
    } else if (action === 'REVISION') {
      res.json(await prisma.seoFinalChecklist.update({ where: { ticketId: id }, data: { status: 'AM_REVISION', amNotes: notes || '' } }));
    } else { res.status(400).json({ error: 'إجراء غير صالح' }); }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// هـ- عرض على العميل
app.put('/api/tickets/:id/seo-final/send-to-client', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) return res.status(403).json({ error: 'غير مصرح' });
    const cl = await prisma.seoFinalChecklist.update({ where: { ticketId: id }, data: { status: 'SENT_TO_CLIENT' } });
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (ticket?.customerId) {
      await prisma.notification.create({ data: { userId: ticket.customerId, ticketId: id, title: '🎉 متجرك جاهز للمراجعة النهائية', message: 'تم الانتهاء من جميع الإعدادات.', isPriority: true } });
    }
    res.json(cl);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// و- رد العميل
app.put('/api/tickets/:id/seo-final/client-review', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { role, userId } = req.user!;
    if (role !== 'CUSTOMER') return res.status(403).json({ error: 'غير مصرح' });
    const ticket = await prisma.ticket.findFirst({ where: { id, customerId: userId } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (action === 'APPROVE') {
      const cl = await prisma.seoFinalChecklist.update({ where: { ticketId: id }, data: { status: 'CLIENT_APPROVED', isFinalized: true, clientNotes: null } });
      await prisma.notification.create({ data: { role: 'ACCOUNT_MANAGER', ticketId: id, title: '✅ العميل اعتمد المراجعة النهائية', message: 'العميل وافق. جاهز للتسليم.', isPriority: true } });
      res.json(cl);
    } else if (action === 'REVISION') {
      const cl = await prisma.seoFinalChecklist.update({ where: { ticketId: id }, data: { status: 'CLIENT_REVISION', clientNotes: notes || '' } });
      await prisma.notification.create({ data: { role: 'ACCOUNT_MANAGER', ticketId: id, title: '⚠️ العميل طلب تعديل', message: `ملاحظات: ${notes || ''}`, isPriority: true } });
      res.json(cl);
    } else { res.status(400).json({ error: 'إجراء غير صالح' }); }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ز- التسليم النهائي
app.put('/api/tickets/:id/final-delivery', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const { role, userId } = req.user!;
    if (!['ADMIN', 'ACCOUNT_MANAGER'].includes(role)) return res.status(403).json({ error: 'غير مصرح' });
    const cl = await prisma.seoFinalChecklist.findUnique({ where: { ticketId: id } });
    if (!cl?.isFinalized) return res.status(400).json({ error: 'يجب اعتماد العميل أولاً' });
    const updated = await prisma.ticket.update({
      where: { id },
      data: { stage: 'DELIVERED', stageEnteredAt: new Date(), isDelivered: true, deliveredAt: new Date(), finalDeliveryNotes: notes || null },
      include: { client: true }
    });
    await prisma.auditLog.create({ data: { ticketId: id, userId, action: 'STAGE_CHANGED', details: JSON.stringify({ from: 'SEO_FINAL', to: 'DELIVERED' }) } }).catch(() => {});
    if (updated.customerId) {
      await prisma.notification.create({ data: { userId: updated.customerId, ticketId: id, title: '🎉 تم تسليم متجرك!', message: 'مبارك! تم تسليم متجرك بنجاح.', isPriority: true } });
    }
    res.json(updated);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// و- تغيير المرحلة (مع تحقق INTAKE)
app.put('/api/tickets/:id/stage', authenticateToken, async (req: AuthRequest, res) => {
  const id = req.params['id'] as string;
  const stage = req.body['stage'] as string;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: 'Not found' });

  // ── INTAKE → next stage: require documents + assignedSeoId + intakeBrief ──
  if (ticket.stage === 'INTAKE' && stage !== 'INTAKE') {
    const { assignedSeoId, intakeBrief, customSlaHours } = req.body;

    if (!ticket.freelanceDocUrl && !ticket.commercialRegUrl) {
      return res.status(400).json({ error: 'يجب رفع وثيقة واحدة على الأقل (وثيقة العمل الحر أو السجل التجاري) قبل التحويل.' });
    }
    if (!assignedSeoId) {
      return res.status(400).json({ error: 'يجب اختيار شخص SEO قبل التحويل.' });
    }
    if (!intakeBrief?.trim()) {
      return res.status(400).json({ error: 'يجب كتابة البريف قبل التحويل.' });
    }

    // Save assignedSeoId and intakeBrief + customSlaHours
    await prisma.ticket.update({
      where: { id },
      data: {
        assignedSeoId,
        intakeBrief: intakeBrief.trim(),
        ...(customSlaHours ? { customSlaHours: parseInt(customSlaHours) } : { customSlaHours: null }),
      }
    });
  }






  if (stage === 'DESIGN' && !ticket.designerId) {
    return res.status(400).json({ error: 'يجب تعيين مصمم (عضو للفريق) قبل تغيير الحالة إلى التصميم.' });
  }

  if (ticket.stage === 'DESIGN' &&
      !['INTAKE', 'SEO_STORE_SETUP', 'DESIGN'].includes(stage)) {
    const missing = [];
    if (!ticket.designLogoUrl) missing.push('شعار المتجر');
    
    let banners: string[] = [];
    try { banners = JSON.parse(ticket.designBannersUrl || '[]'); } catch { banners = ticket.designBannersUrl ? [ticket.designBannersUrl] : []; }
    if (banners.length === 0) missing.push('البنرات');

    if (missing.length > 0) {
      return res.status(400).json({ error: `يرجى من المصمم (حفظ ملفات التصميم) والتأكد من إرفاق: ${missing.join('، ')}` });
    }
  }

  if (stage === 'DEVELOPMENT' && !ticket.developerId) {
    return res.status(400).json({ error: 'يجب تعيين مطور (عضو للفريق) قبل تغيير الحالة إلى التطوير.' });
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

// ════════════════════════════════════════════════════════════════
// PUT /api/tickets/:id/emergency-transfer — ADMIN-only forced stage change
// ════════════════════════════════════════════════════════════════
app.put('/api/tickets/:id/emergency-transfer', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params['id'] as string;
    const { stage, reason } = req.body;

    // Only ADMIN
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'هذا الإجراء مسموح فقط لمدير النظام.' });
    }

    if (!stage || !reason?.trim()) {
      return res.status(400).json({ error: 'يجب تحديد المرحلة وكتابة سبب التحويل.' });
    }

    const validStages = ['INTAKE', 'SEO_STORE_SETUP', 'DESIGN', 'DEVELOPMENT', 'SEO_FINAL', 'DELIVERED'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'المرحلة غير صالحة.' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'الطلب غير موجود.' });

    const updated = await prisma.ticket.update({
      where: { id },
      data: { stage, stageEnteredAt: new Date(), isSlaBreached: false },
      include: { client: true }
    });

    await prisma.auditLog.create({
      data: {
        ticketId: id,
        userId: req.user!.userId,
        action: 'EMERGENCY_TRANSFER',
        details: JSON.stringify({ from: ticket.stage, to: stage, reason: reason.trim() })
      }
    }).catch(() => {});

    res.json(updated);
  } catch (e: any) {
    console.error('[emergency-transfer] Error:', e.message);
    res.status(500).json({ error: 'فشل التحويل الطارئ.' });
  }
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
      // logo type
      selectedLogoType,
      selectedLogoTypeName,
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
      selectedLogoType: selectedLogoType || null,
      selectedLogoTypeName: selectedLogoTypeName || null,
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

// ── SEO Checklist: Get ─────────────────────────────────────────────────────
app.get('/api/tickets/:id/seo-checklist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const checklist = await prisma.seoChecklist.findUnique({ where: { ticketId: id } });
    res.json(checklist || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب بيانات SEO' });
  }
});

// ── SEO Checklist: Upsert ──────────────────────────────────────────────────
app.put('/api/tickets/:id/seo-checklist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    console.log('[SEO PUT] ticketId:', id);
    console.log('[SEO PUT] raw body keys:', Object.keys(data || {}));

    // Remove any non-schema fields
    const allowedFields = [
      'nicheSelected','domainChosen','domainName','gmailCreated','gmailEmail','gmailPassword',
      'sallaAccountCreated','sallaEmail','sallaPassword','domainPurchased','packageUpgraded','packageType',
      'logoDesigned','domainLinked',
      'googleAnalyticsLinked','logoApplied','storeVerified','siloCreated','bankAccountAdded',
      'infoPagesDone','footerDescDone','contactInfoAdded','whatsappButtonAdded',
      'supplierSelected','supplierPlatformName','apiLinked','productsUploaded','productsCategorized',
      'bannerDesigned','seoHomepage','seoCategoriesPage','profitMarginsSet',
      'paymentGatewaysLinked','shippingCompaniesLinked','uiApplied','storeLaunched','linkSentToClient',
      'storeEmail','storePassword',
    ];
    const cleanData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in data) cleanData[key] = data[key];
    }

    console.log('[SEO PUT] cleanData:', cleanData);

    const checklist = await prisma.seoChecklist.upsert({
      where:  { ticketId: id },
      update: cleanData,
      create: { ticketId: id, ...cleanData },
    });
    console.log('[SEO PUT] saved id:', checklist.id);
    res.json(checklist);
  } catch (error: any) {
    console.error('[SEO PUT] error:', error.message);
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات SEO' });
  }
});

async function migrateOldStages() {
  const migrations: Record<string, string> = {
    'LEGAL_PROCESSING': 'INTAKE',
    'PENDING_CLIENT_APPROVAL': 'DESIGN',
    'CLIENT_APPROVED': 'DESIGN',
    'CLIENT_REVISION': 'DESIGN',
    'PENDING_AM_REVIEW': 'DEVELOPMENT',
    'DEVELOPMENT_REVISION': 'DEVELOPMENT',
    'REVIEW': 'SEO_FINAL',
  };
  for (const [oldStage, newStage] of Object.entries(migrations)) {
    const count = await prisma.ticket.updateMany({
      where: { stage: oldStage },
      data: { stage: newStage },
    });
    if (count.count > 0) {
      console.log(`✔ Migrated ${count.count} tickets from ${oldStage} → ${newStage}`);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// LOGO TYPES — Admin-managed, client-selectable
// ════════════════════════════════════════════════════════════════

// GET active logo types (public — any authenticated user)
app.get('/api/logo-types', async (_req: any, res: any) => {
  try {
    const types = await prisma.logoType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json(types);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET all logo types (admin)
app.get('/api/logo-types/all', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const types = await prisma.logoType.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(types);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST create logo type (admin)
app.post('/api/logo-types', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { name, description, imageUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'اسم النوع مطلوب' });
    const maxOrder = await prisma.logoType.aggregate({ _max: { sortOrder: true } });
    const newType = await prisma.logoType.create({
      data: { name: name.trim(), description: description?.trim() || null, imageUrl: imageUrl || null, sortOrder: (maxOrder._max.sortOrder || 0) + 1 }
    });
    res.json(newType);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT update logo type (admin)
app.put('/api/logo-types/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { name, description, imageUrl, isActive, sortOrder } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    const updated = await prisma.logoType.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE logo type (admin)
app.delete('/api/logo-types/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  try {
    await prisma.logoType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT reorder logo types (admin)
app.put('/api/logo-types/reorder', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids مطلوبة' });
    await Promise.all(ids.map((id: string, i: number) => prisma.logoType.update({ where: { id }, data: { sortOrder: i + 1 } })));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

async function start() {

  validateEncryptionKey();
  await prisma.$connect();
  await migrateOldStages().catch(console.error);
  // Migrate old QA role to SEO
  await prisma.user.updateMany({ where: { role: 'QA' }, data: { role: 'SEO' } }).then(r => { if (r.count > 0) console.log(`✔ Migrated ${r.count} users from QA → SEO`); }).catch(console.error);

  // Seed default logo types
  const logoTypeCount = await prisma.logoType.count();
  if (logoTypeCount === 0) {
    const defaults = [
      { name: 'شعار حرفي فقط (Wordmark)', description: 'الشعار يتكون من اسم العلامة التجارية فقط بخط مميز', sortOrder: 1 },
      { name: 'شعار حرفي مع أيقونة (Combination)', description: 'اسم العلامة مع رمز أو أيقونة بجانبه', sortOrder: 2 },
      { name: 'شعار حرف واحد (Lettermark)', description: 'حرف واحد أو اختصار يمثل العلامة التجارية', sortOrder: 3 },
      { name: 'شعار رمزي (Symbol/Icon)', description: 'رمز أو أيقونة فقط بدون نص', sortOrder: 4 },
      { name: 'شعار شعاري (Emblem)', description: 'النص داخل شكل أو إطار (مثل الشعارات الرسمية)', sortOrder: 5 },
    ];
    for (const d of defaults) await prisma.logoType.create({ data: d });
    console.log('✔ Seeded 5 default logo types');
  }

  app.listen(port, () => console.log(`Server on ${port}`));
}
start();
