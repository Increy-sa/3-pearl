// @ts-nocheck
/**
 * Webhook Routes
 *
 * Handles inbound webhooks from third-party services.
 * Each webhook uses its own static Bearer token for authentication.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// ─── ThreePearl Static Token (loaded from .env) ─────────────────────────────────
// Set ADTOPIA_WEBHOOK_SECRET in your .env file.
// The server will throw at startup if this variable is missing.
const THREEPEARL_STATIC_TOKEN = process.env.ADTOPIA_WEBHOOK_SECRET;
if (!THREEPEARL_STATIC_TOKEN) {
  throw new Error('FATAL: ADTOPIA_WEBHOOK_SECRET is not set in the environment.');
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/threepearl
//
// Receives a new lead/order from ThreePearl and provisions the user + ticket.
//
// Expected payload:
// {
//   "id": 17,
//   "first_name": "طلال",
//   "last_name": "مسعد",
//   "email": "test@gmail.com",
//   "phone": "0122585958",
//   "password": "password123",
//   "order": {
//     "id": 5,
//     "status": "success",
//     "total_amount": "5700.00",
//     "payment_method": "Tabby",
//     "service": { "id": 2, "title": "ادارة السوشيال ميديا" }
//   }
// }
// ────────────────────────────────────────────────────────────────────────────
router.post('/threepearl', async (req, res) => {
  // ── 1. Static Token Validation ─────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const incomingToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!incomingToken || incomingToken !== THREEPEARL_STATIC_TOKEN) {
    console.warn('[webhook/threepearl] ❌ Unauthorized — invalid or missing token.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── 2. Order Status Check ──────────────────────────────────────────────────
  const { first_name, last_name, email, phone, password, order } = req.body;

  const VALID_STATUSES = ['success', 'completed'];
  if (!order || !VALID_STATUSES.includes(order.status)) {
    console.warn(`[webhook/threepearl] ⚠️  Order not successful. Status: "${order?.status}"`);
    return res.status(400).json({ error: 'Order not successful' });
  }

  // ── 3. Validate required fields ────────────────────────────────────────────
  if (!email || !password || !first_name) {
    return res.status(400).json({ error: 'Missing required fields: email, password, first_name' });
  }

  const fullName = `${first_name} ${last_name || ''}`.trim();
  const serviceTitle = order.service?.title || 'خدمة غير محددة';

  try {
    // ── 4a. Hash the incoming plaintext password ───────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── 4b. Upsert the User (create if new, update if exists) ─────────────
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: fullName,
        passwordHash: hashedPassword,
      },
      create: {
        name: fullName,
        email,
        passwordHash: hashedPassword,
        role: 'CUSTOMER',
        isActive: true,
      },
    });

    console.log(`[webhook/threepearl] ✅ User upserted — id: ${user.id}, email: ${user.email}`);

    // ── 4c. Upsert ClientInfo (business/contact data for the ticket) ───────
    // ClientInfo is required by the Ticket model (clientId FK).
    // We use email as the unique key to avoid duplicates on repeat webhooks.
    const existingClient = await prisma.clientInfo.findFirst({
      where: { email },
    });

    const clientData = {
      customerName: fullName,
      businessName: serviceTitle,   // best approximation from available data
      industry: 'غير محدد',
      description: `طلب وارد من ThreePearl — ${serviceTitle}`,
      targetAudience: 'غير محدد',
      email,
      phone: phone || null,
      hasLegalDoc: false,
    };

    const client = existingClient
      ? await prisma.clientInfo.update({ where: { id: existingClient.id }, data: clientData })
      : await prisma.clientInfo.create({ data: clientData });

    // ── 4d. Create the Ticket ──────────────────────────────────────────────
    const ticket = await prisma.ticket.create({
      data: {
        stage: 'INTAKE',
        stageEnteredAt: new Date(),
        checklists: '[]',
        clientId: client.id,
        customerId: user.id,
        // Store ThreePearl order context in staffNotes for the Account Manager
        staffNotes: [
          `📦 خدمة: ${serviceTitle}`,
          `💳 طريقة الدفع: ${order.payment_method || 'غير محدد'}`,
          `💰 المبلغ: ${order.total_amount || 'غير محدد'}`,
          `🆔 رقم الطلب (ThreePearl): ${order.id}`,
        ].join('\n'),
      },
      include: {
        client: true,
      },
    });

    console.log(`[webhook/threepearl] 🎫 Ticket created — id: ${ticket.id}, stage: ${ticket.stage}`);

    // ── 5. Return success ──────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'User and ticket provisioned successfully.',
      data: {
        userId: user.id,
        ticketId: ticket.id,
        stage: ticket.stage,
      },
    });

  } catch (error: any) {
    console.error('[webhook/threepearl] 🔥 Internal error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
