import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { generateBrandProposal, generateLogoSVG } from './services/geminiService';
import { authenticateToken, AuthRequest } from './middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { encrypt, decrypt, validateEncryptionKey } from './utils/crypto';
import { STAGES, STAGE_LABELS, SLA_HOURS, isValidTransition, isSlaBreached, getSlaRemainingHours } from './config/stages';
import { STAGE_CHECKLISTS, areChecklistItemsComplete, getRoleForStage } from './config/workflow';
import staffRoutes from './routes/staffRoutes';

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Staff Operations API
app.use('/api/staff', staffRoutes);

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, "");
    const finalFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(uploadsDir, finalFileName), base64Data, 'base64');
    res.json({ url: `http://localhost:5000/uploads/${finalFileName}` });
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

// Ticket Logic
app.post('/api/tickets/create-final', async (req, res) => {
  try {
    const data = req.body;

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
      hasLegalDoc: data.hasLegalDoc ?? true,
      documentFileUrl: data.legalDocUrl || null,
      legalDocUrl: data.legalDocUrl || null,
      nationalIdUrl: data.nationalIdUrl || null,
      fullNameInId: data.fullNameInId || null,
      absherPhone: data.absherPhone || null
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

app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isActive === false) return res.status(403).json({ error: 'الحساب معطل من قبل الإدارة' });
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
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
  const { id } = req.params;
  const { stage } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: 'Not found' });

  if (ticket.stage === 'DEVELOPMENT' && stage === 'REVIEW') {
    const cl = JSON.parse(ticket.checklists || '[]');
    if (!areChecklistItemsComplete(ticket.stage, cl)) return res.status(400).json({ error: 'Checklist incomplete' });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { stage, stageEnteredAt: new Date(), isSlaBreached: false },
    include: { client: true }
  });

  const targetRole = getRoleForStage(stage);
  if (targetRole) {
    await prisma.notification.create({ data: {
      role: targetRole, ticketId: id, title: 'New Task',
      message: `Ticket moved to ${stage}`, isPriority: true
    }});
  }
  res.json(updated);
});

app.put('/api/tickets/:id/assign', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
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
  const { id } = req.params;
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

async function start() {
  validateEncryptionKey();
  await prisma.$connect();
  app.listen(port, () => console.log(`Server on ${port}`));
}
start();
