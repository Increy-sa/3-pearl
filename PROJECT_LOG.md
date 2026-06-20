# 📋 PROJECT LOG — Fawri.net (Salla Automated E-Commerce Onboarding Platform)

> **Last Updated:** June 18, 2026  
> **Version:** 3.0.0  
> **Status:** Production-Ready — 6-Stage Workflow  
> **Domain:** fawri.net  
> **Repository:** https://github.com/ahmedhelm-y/Salla-Task-Manager.git

---

## 1. Project Overview

This platform is an **automated e-commerce store onboarding system** built for the Salla ecosystem. It streamlines the entire journey from customer intake to brand identity creation — replacing manual processes with an AI-powered, self-service pipeline backed by a comprehensive staff management dashboard.

### Core Workflow

```
Adtopia Webhook → INTAKE → SEO_STORE_SETUP → DESIGN → DEVELOPMENT → SEO_FINAL → DELIVERED
```

A new customer arrives via the Adtopia advertising webhook (or direct signup), fills out their legal and business information, receives AI-generated brand suggestions (names, color palettes, and SVG logos), selects their preferences, and is immediately onboarded with a personalized tracking dashboard. Internal staff manage the pipeline through a separate RBAC-protected admin dashboard with archive/delete capabilities.

---

## 2. Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Vite, TypeScript | SPA with component-based architecture |
| **Styling** | Tailwind CSS 4 | Utility-first, mobile-first responsive design (RTL) |
| **Backend** | Node.js, Express, TypeScript | REST API server with modular routing |
| **ORM** | Prisma | Type-safe database access and migrations |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Relational storage |
| **File Storage** | Supabase Storage + Local Uploads | Document and image persistence |
| **AI Engine** | Google Gemini API (2.5-flash + 2.5-flash-lite) | Brand name, palette, and SVG logo generation |
| **Auth** | JWT + bcryptjs | Stateless auth with password hashing |
| **State** | Zustand | Client-side state with localStorage persistence |
| **Validation** | Custom Regex (dual-layer) | Frontend + Backend input validation |
| **Process Manager** | PM2 | Production process management |
| **Web Server** | Nginx | Reverse proxy, static serving, SSL |
| **Dev Tooling** | ts-node-dev, Vite HMR | Hot-reloading for both frontend and backend |

### Key Dependencies

```
Frontend: react, react-router-dom, zustand, lucide-react, @supabase/supabase-js
Backend:  express, prisma, @google/generative-ai, jsonwebtoken, bcryptjs, cors, multer
DevOps:   pm2, nginx, certbot
```

---

## 3. Features Implemented

### 3.1 Two-Step Authentication System

Secure login flow with role-aware behavior:

- **Step 1 — Email Verification:** `POST /api/auth/verify-email` checks if user exists and returns role.
- **Step 2 — Password (Staff only):** If the user is ADMIN/ACCOUNT_MANAGER/SEO/DESIGNER/DEVELOPER with a password set, a password field animates in with a green verified badge showing the user's name.
- **Direct Login (Customers):** Customers without passwords log in directly after email verification.
- **Change Password:** All staff can change their password from Settings (`PUT /api/auth/change-password`).

**Technical Details:**
- Password hashing: `bcryptjs` with salt rounds
- JWT tokens with userId, role, expiration
- Frontend: `useAuthStore` (Zustand) persists user, token, and `isProfileComplete` flag

---

### 3.2 Role-Based Access Control (RBAC)

Six distinct roles with granular permissions:

| Role | Dashboard Access | Archive/Delete | Approve Docs | Manage Staff | Settings |
|------|:---:|:---:|:---:|:---:|:---:|
| **ADMIN** | ✅ Full | ✅ | ✅ | ✅ | ✅ Full |
| **ACCOUNT_MANAGER** | ✅ Full | ✅ | ✅ | ❌ | ✅ Password only |
| **DESIGNER** | ✅ Assigned tickets | ❌ | ❌ | ❌ | ✅ Password only |
| **DEVELOPER** | ✅ Assigned tickets | ❌ | ❌ | ❌ | ✅ Password only |
| **SEO** | ✅ All tickets | ❌ | ❌ | ❌ | ✅ Password only |
| **CUSTOMER** | ✅ Own dashboard | ❌ | ❌ | ❌ | ❌ |

**Guards:**
- `StaffGuard` — blocks CUSTOMER from `/dashboard`
- `ClientGuard` — redirects incomplete profiles to `/client` onboarding

---

### 3.3 AI Brand Generator

The brand generation engine uses Google Gemini to produce creative, industry-tailored suggestions.

- **Name Generation:** 5 unique brand name suggestions with Arabic/English descriptions.
- **Palette Generation:** 3 harmonious color palettes (4 colors each) with creative titles.
- **SVG Logo Generation:** Clean, scalable SVG logos based on selected brand name, industry, and colors.
- **Mix & Match:** Users can independently select any name from one suggestion and any palette from another.
- **Manual Override:** Users can type a custom brand name or add/remove individual colors via a color picker.
- **Review Before Redirect:** Authenticated customers review AI results before confirming → no premature dashboard redirect.

**Technical Details:**
- Models: `gemini-2.5-flash` → fallback to `gemini-2.5-flash-lite`
- Temperature: `1.8` for high creativity
- Response format: Structured JSON with `names[]` and `palettes[]` arrays
- Logo output: Raw SVG extracted from markdown → Base64 → server upload → persistent URL

---

### 3.4 Legal Onboarding Flow (Two-Path System)

#### Path A — "نعم، متوفرة" (Has existing document)
- Upload field for Commercial Register or Freelance Document (PDF/Image).
- Standard customer info fields (name, email, phone, national ID, IBAN).
- All fields validated with real-time regex restrictions.

#### Path B — "لا، أحتاج استخراج" (Needs document issuance)
- **National ID Upload:** Photo of the national ID or residency card.
- **Full Name (as in ID):** Text field for the legal name.
- **Absher Phone:** The phone number linked to the Absher government portal.
- Info box explaining the issuance process.

**Data Flow:**
```
LegalInfoForm.tsx (collects data)
    ↓ onNext(legalData)
ClientIntakeForm.tsx (spreads into payload)
    ↓ POST /api/tickets/create-with-ai
Backend index.ts (saves to ClientInfo via Prisma + re-links ticket)
    ↓ GET /api/customer/my-ticket
CustomerDashboard.tsx (renders conditionally with smart detection)
```

**Pre-filling (Adtopia Users):**
- Name, email, phone from webhook data → readOnly with "(مسجّل)" label
- Fields are grayed out to prevent tampering

---

### 3.5 Document Approval Workflow

Complete staff-to-customer approval pipeline:

1. **Customer submits** legal data during onboarding
2. **Staff panel** (`TicketDetailPanel`) shows:
   - Full client info (name, email, phone, national ID, IBAN)
   - Document links (uploaded commercial register or ID photo)
   - Extraction status with Absher details
3. **Approve button** (ADMIN + AM only): `PUT /api/staff/tickets/:id/approve-docs`
4. **Customer dashboard** updates:
   - ⏳ **Before approval:** Yellow "قيد المراجعة" badge
   - ✅ **After approval:** Green "تمت المراجعة" badge with confirmation message

**Smart Detection:** Even if `needsLegalExtraction` wasn't saved correctly in DB, the system infers extraction status from `nationalIdUrl` / `fullNameInId` presence.

---

### 3.6 Adtopia Webhook Integration

Secure webhook endpoint for external lead ingestion:

- **Endpoint:** `POST /api/webhooks/adtopia`
- **Auth:** Static Bearer token (`ADTOPIA_WEBHOOK_SECRET`)
- **Validation:** Only processes orders with `status: "successful"`
- **Actions:**
  1. Creates `User` with role `CUSTOMER` + bcrypt-hashed random password
  2. Creates placeholder `ClientInfo` with name, email, phone
  3. Creates `Ticket` in `INTAKE` stage
  4. Login response includes `isProfileComplete: false` → forces onboarding

---

### 3.7 Ticket Management (Archive & Delete)

Admin dashboard capabilities:

| Feature | Access | Endpoint |
|---------|--------|----------|
| **Archive** | ADMIN + AM | `PUT /api/staff/tickets/:id/archive` (toggle) |
| **Delete** | ADMIN + AM | `DELETE /api/staff/tickets/:id` (cascading) |
| **View Archived** | All staff | `GET /api/staff/tickets?archived=true` |

- Always-visible "التفاصيل" button (no hover required)
- Confirmation modal with distinct warning levels (amber for archive, red for delete)
- "أرشيف الطلبات" tab with unarchive capability

---

### 3.8 Input Validation (Dual-Layer)

Real-time restrictions on every form field:

| Field | Pattern | Max Length | Restriction |
|-------|---------|-----------|-------------|
| **Phone** | `^(05)[0-9]{8}$` | 10 | Digits only |
| **National ID** | `^[12][0-9]{9}$` | 10 | Digits only |
| **IBAN** | `^SA[0-9]{22}$` | 24 | Alphanumeric, auto-uppercase |
| **Email** | Standard email regex | — | Standard validation |
| **Name** | Arabic/English (2–60 chars) | 60 | Letters + spaces |

**Backend validators:** `backend/src/utils/validators.ts` — `validateLoginBody`, `validateOnboardingBody`, `validateLegalBody`
**Frontend validators:** `frontend/src/utils/validators.ts` — matching client-side rules

---

### 3.9 Customer Dashboard

Full-featured tracking dashboard:

- **6-step progress pipeline** with responsive stepper (horizontal desktop / vertical mobile)
- **Brand Identity Section:** Store name, logo, color palette, mood board
- **Legal Documents Section:** Smart 3-way status (approved / pending review / needs extraction)
- **Client Profile Tab:** Read-only display of all customer data
- **Design Approval:** Customer can approve/reject uploaded design assets

---

### 3.10 Responsive UI/UX (Mobile-First)

Every component follows a mobile-first approach:

| Component | Mobile (<640px) | Desktop (≥1024px) |
|-----------|----------------|-------------------|
| **Sidebar** | Hamburger ≡ → slide-in drawer | Full 288px sidebar |
| **Stepper** | Vertical compact list | Horizontal with connecting line |
| **Form Fields** | Single column, full-width | 2-column grid |
| **Tables** | Horizontal scroll with `overflow-x-auto` | Full table |
| **Cards** | `grid-cols-1` | `grid-cols-2 lg:grid-cols-3` |
| **Modals** | Full-width, responsive padding | Centered with `max-w-md` |
| **Detail Panel** | Full-width drawer | `max-w-2xl` side panel |
| **Buttons** | `active:scale-95`, touch-friendly sizes | Standard hover effects |

**Global CSS Enhancements:**
```css
html { scroll-behavior: smooth; -webkit-tap-highlight-color: transparent; }
/* Thin scrollbar, focus-visible outlines, scrollbar-hide utility */
```

---

## 4. Backend Infrastructure

### 4.1 Model Fallback System

```typescript
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
for (const modelName of MODELS) {
  try { /* ... */ } catch (err) { /* try next model */ }
}
```

### 4.2 File Upload System

```
Client → Base64 encode → POST /api/upload → Server saves to /uploads/ → Returns public URL
```

- Upload URL is dynamic via `BASE_URL` environment variable

### 4.3 Database Schema (Prisma)

```prisma
model ClientInfo {
  id                    String   @id @default(uuid())
  customerName          String
  email                 String?
  phone                 String?
  nationalId            String?
  iban                  String?
  businessName          String
  industry              String
  hasDocument           Boolean  @default(false)
  documentFileUrl       String?
  hasLegalDoc           Boolean  @default(true)
  needsLegalExtraction  Boolean  @default(false)
  nationalIdUrl         String?
  fullNameInId          String?
  absherPhone           String?
  docsApproved          Boolean  @default(false)
}

model Ticket {
  id             String   @id @default(uuid())
  stage          String   @default("INTAKE")
  isArchived     Boolean  @default(false)
  // ... workflow fields, assignments, relations
}
```

### 4.4 Authentication

- **Two-Step Login:** Email verification → password for staff
- **Customer Auto-Creation:** Via webhook or form submission
- **JWT Tokens:** With userId, role, expiration
- **Route Protection:** Frontend guards + backend `authenticateToken` middleware
- **Password Management:** bcrypt hashing, change password endpoint

---

## 5. Key Files & Architecture

```
Salla Task Manager/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server, all API routes
│   │   ├── routes/
│   │   │   ├── staffRoutes.ts    # Staff dashboard API (tickets, audit, archive, delete)
│   │   │   └── webhookRoutes.ts  # Adtopia webhook integration
│   │   ├── utils/
│   │   │   ├── validators.ts     # Regex-based input validation
│   │   │   └── crypto.ts         # Encryption utilities
│   │   ├── services/
│   │   │   └── geminiService.ts  # AI model configuration & helpers
│   │   └── middleware/           # Auth middleware
│   ├── prisma/
│   │   └── schema.prisma         # Database schema (7 models)
│   ├── uploads/                  # Stored files (images, documents)
│   ├── .env                      # Environment variables
│   └── .env.example              # Template for production
│
├── frontend/
│   ├── src/
│   │   ├── config/
│   │   │   └── api.ts            # Centralized API_URL config
│   │   ├── components/
│   │   │   ├── client/
│   │   │   │   ├── LegalInfoForm.tsx        # Step 1: Legal data + real-time validation
│   │   │   │   ├── ClientIntakeForm.tsx     # Step 2: Business details + AI trigger
│   │   │   │   ├── AIProposalView.tsx       # Step 3: AI results review + confirm
│   │   │   │   └── BrandIdentityBoard.tsx   # Full brand builder (names, colors, logo)
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardLayout.tsx      # Responsive sidebar + hamburger menu
│   │   │   │   ├── TicketBoard.tsx          # Ticket pipeline board
│   │   │   │   └── TicketCard.tsx           # Individual ticket card
│   │   │   └── staff/
│   │   │       └── TicketDetailPanel.tsx    # Full ticket detail drawer (1400+ lines)
│   │   ├── pages/
│   │   │   ├── ClientPortal.tsx             # Onboarding wrapper with stepper
│   │   │   ├── auth/
│   │   │   │   └── Login.tsx               # Two-step login page
│   │   │   ├── admin/
│   │   │   │   ├── StaffDashboard.tsx       # Ticket management + archive tab
│   │   │   │   ├── AdminSettings.tsx        # Settings + change password
│   │   │   │   ├── ManageStaff.tsx          # Staff CRUD management
│   │   │   │   └── ReportsDashboard.tsx     # Analytics (admin only)
│   │   │   └── customer/
│   │   │       └── CustomerDashboard.tsx    # Customer tracking + docs status
│   │   ├── store/
│   │   │   └── useAuthStore.ts             # Zustand auth state (with phone field)
│   │   ├── utils/
│   │   │   └── validators.ts               # Frontend regex validation
│   │   └── index.css                       # Global styles & responsive utilities
│   ├── .env                                # VITE_API_URL
│   └── .env.example
│
├── deployment-configs/
│   ├── ecosystem.config.js    # PM2 production config
│   ├── nginx.conf             # Nginx reverse proxy + SSL + security headers
│   └── setup-server.sh        # Full VPS setup script (Ubuntu 22.04)
│
├── PROJECT_LOG.md             # ← This file
├── PROJECT_PROGRESS.md        # Arabic progress report
└── .gitignore
```

---

## 6. Environment Variables

### Backend (.env)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | Prisma connection string |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `JWT_SECRET` | ✅ | Secret for JWT signing |
| `ADTOPIA_WEBHOOK_SECRET` | ✅ | Bearer token for webhook auth |
| `FRONTEND_URL` | ✅ | CORS allowed origin (e.g., `https://fawri.net`) |
| `BASE_URL` | ✅ | Backend public URL for upload paths |
| `PORT` | ❌ | Server port (default: 5000) |
| `SUPABASE_URL` | ❌ | Supabase project URL |
| `SUPABASE_KEY` | ❌ | Supabase anon key |

### Frontend (.env)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_API_URL` | ✅ | Backend API URL (fallback: `https://fawri.net`) |

---

## 7. Development Environment

| Service | URL | Command |
|---------|-----|---------|
| Frontend | `http://localhost:5173` | `npm run dev` |
| Backend | `http://localhost:5000` | `npm run dev` |
| Build (Frontend) | — | `npm run build` |
| Build (Backend) | — | `npm run build` (→ `dist/`) |
| Start (Backend) | — | `npm start` (→ `node dist/index.js`) |

---

## 8. Deployment (fawri.net)

### Server Details

| Item | Value |
|------|-------|
| **Provider** | Hostinger KVM 2 |
| **OS** | Ubuntu 22.04 LTS |
| **IP** | 72.62.46.104 |
| **Domain** | fawri.net |
| **Stack** | Nginx + PM2 + Node.js 20 |
| **SSL** | Let's Encrypt (Certbot) |

### Architecture

```
Client Browser
    ↓ HTTPS
Nginx (port 443)
    ├── /api/* → Reverse Proxy → Node.js (PM2, port 5000)
    └── /* → Static Files (/var/www/fawri/frontend/dist/)
```

### Deployment Files
- `deployment-configs/ecosystem.config.js` — PM2 config
- `deployment-configs/nginx.conf` — Nginx server block
- `deployment-configs/setup-server.sh` — Full automated VPS setup

---

## 9. Staff Accounts

| Email | Name | Role | Default Password |
|-------|------|------|:---:|
| `admin@agency.com` | مدير النظام | ADMIN | `123456` |
| `am@agency.com` | فيصل مدير الحساب | ACCOUNT_MANAGER | `123456` |
| `dev@agency.com` | احمد مبرمج | DEVELOPER | `123456` |
| `des@agency.com` | medo des | DESIGNER | `123456` |
| `seo@agency.com` | نورة | SEO | `123456` |
| `abdulmuhsen.dm@gmail.com` | عبدالمحسن | ACCOUNT_MANAGER | `123456` |

---

## 10. Future Roadmap

### Immediate (Post-Deployment)
- [ ] Migrate from SQLite to PostgreSQL
- [ ] Configure CDN for uploaded assets
- [ ] Change all staff default passwords

### Phase 7 — Communication & Notifications
- [ ] WhatsApp Business API integration for document approval notifications
- [ ] Email notifications on status changes (SendGrid/Resend)
- [ ] In-app notification bell with real-time updates (WebSocket)

### Phase 8 — Advanced Features
- [ ] Kanban board for visual ticket pipeline management
- [ ] Brand Book PDF export (logo + palette + typography)
- [ ] Social media asset templates
- [ ] Bulk status updates for tickets

### Phase 9 — Production Hardening
- [ ] Docker containerization (frontend + backend + DB)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Rate limiting on AI endpoints
- [ ] Encrypt sensitive fields at rest (National ID, IBAN)
- [ ] Monitoring & error tracking (Sentry)
- [ ] Comprehensive test suite (Vitest + Playwright)

---

## 11. Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| Apr 23, 2026 | Initial project scaffold — Salla onboarding system | All |
| Apr 26, 2026 | Fixed AI model 404/429 errors, implemented fallback chain | `index.ts`, `geminiService.ts` |
| Apr 26, 2026 | Full onboarding flow: legal → brand → dashboard | `LegalInfoForm.tsx`, `BrandIdentityBoard.tsx`, `ClientPortal.tsx` |
| Apr 27, 2026 | Added Legal Status two-path flow (document vs issuance) | `LegalInfoForm.tsx`, `schema.prisma`, `index.ts` |
| Apr 27, 2026 | Fixed data flow: nationalIdUrl, fullNameInId, absherPhone | `BrandIdentityBoard.tsx`, `index.ts`, `CustomerDashboard.tsx` |
| Apr 27, 2026 | Full responsive overhaul — mobile-first across all components | Multiple frontend files |
| May 17, 2026 | Fixed AI generation functionality issues | `TicketBoard.tsx`, AI-related components |
| May 18, 2026 | **Adtopia Webhook** integration + user auto-creation | `webhookRoutes.ts`, `index.ts` |
| May 18, 2026 | **Onboarding Guard** logic — ClientGuard + StaffGuard | `App.tsx`, `index.ts` |
| May 18, 2026 | **Data pre-filling** — name, email, phone from webhook (readOnly) | `LegalInfoForm.tsx` |
| May 18, 2026 | Fixed `create-with-ai` to save ALL legal data + re-link ticket | `index.ts` |
| May 18, 2026 | Added phone to login response + `useAuthStore` | `index.ts`, `useAuthStore.ts`, `LegalInfoForm.tsx` |
| May 18, 2026 | **Regex Validation** — dual-layer (backend + frontend) | `validators.ts` (×2) |
| May 18, 2026 | **Real-time input restrictions** — numericOnly, ibanKey, maxLength | `LegalInfoForm.tsx` |
| May 19, 2026 | **Document Approval Workflow** — approve button + status display | `TicketDetailPanel.tsx`, `staffRoutes.ts`, `CustomerDashboard.tsx` |
| May 19, 2026 | Added `docsApproved` + `needsLegalExtraction` to schema | `schema.prisma` |
| May 19, 2026 | **Smart Detection** for extraction cases in admin + customer views | `TicketDetailPanel.tsx`, `CustomerDashboard.tsx` |
| May 19, 2026 | **Archive & Delete** — `isArchived` field, archive tab, delete endpoint | `schema.prisma`, `staffRoutes.ts`, `StaffDashboard.tsx` |
| May 19, 2026 | **Two-Step Login** — verify-email + password for staff | `index.ts`, `Login.tsx` |
| May 19, 2026 | **Change Password** — settings page for all staff roles | `AdminSettings.tsx`, `index.ts` |
| May 19, 2026 | **Staff passwords reset** to `123456` for all 6 accounts | Database migration |
| May 19, 2026 | **Settings access** — made accessible to ALL staff roles | `DashboardLayout.tsx`, `AdminSettings.tsx` |
| May 19, 2026 | **Responsive UI overhaul** — hamburger menu, mobile-first, touch-friendly | 8 frontend files + `index.css` |
| May 19, 2026 | **Production readiness** — dynamic API URLs, CORS, build scripts | `config/api.ts`, `.env.example` (×2), 13+ files |
| May 19, 2026 | **TypeScript fixes** — 22 errors → 0, `npm run build` succeeds | 10+ frontend files |
| May 19, 2026 | **Deployment configs** — PM2, Nginx, setup-server.sh for VPS | `deployment-configs/` (3 files) |
| May 19, 2026 | **tsconfig.json fix** — migrated to `nodenext` module resolution | `backend/tsconfig.json` |
| Jun 15, 2026 | **SEO Checklist persistence fix** — synchronized frontend/backend stage configs | `SeoChecklistPanel.tsx`, `stages.ts` |
| Jun 16, 2026 | **Continued development** — ongoing stage workflow development | Multiple files |
| Jun 18, 2026 | **🔄 6-Stage Workflow Consolidation** — removed 7 legacy stages (LEGAL_PROCESSING, PENDING_CLIENT_APPROVAL, CLIENT_APPROVED, CLIENT_REVISION, PENDING_AM_REVIEW, DEVELOPMENT_REVISION, REVIEW) | `schema.prisma`, `stages.ts`, `staffRoutes.ts`, `index.ts` |
| Jun 18, 2026 | **Phase 1: INTAKE** — AM data requests, document upload, SEO person assignment, brief | `DataRequest` model, `IntakeSection`, `staffRoutes.ts` |
| Jun 18, 2026 | **Phase 2: SEO_STORE_SETUP** — SEO proposals (name/domain), store setup checklist, designer transfer | `SeoProposal` model, `SeoStageSection.tsx`, `SeoChecklistPanel.tsx` |
| Jun 18, 2026 | **Phase 3: DESIGN + DEVELOPMENT** — design delivery, client approval, dev checklist, SEO review | `DesignDelivery` model, `DesignSection.tsx`, `DevSection.tsx` |
| Jun 18, 2026 | **Phase 4: SEO_FINAL + DELIVERED** — final SEO checklist, AM delivery, client handoff | `SeoFinalChecklist` model, `SeoFinalSection.tsx` |
| Jun 18, 2026 | **Legacy cleanup** — removed old stage buttons, assignment UI, SLA inputs from TicketDetailPanel | `TicketDetailPanel.tsx` |
| Jun 18, 2026 | **Emergency Transfer** — ADMIN-only stage override with reason + audit log | `index.ts`, `TicketDetailPanel.tsx` |
| Jun 18, 2026 | **🔄 QA → SEO role migration** — replaced QA role with SEO across entire codebase (10+ files) | `schema.prisma`, `index.ts`, `staffRoutes.ts`, `useAuthStore.ts`, 6 frontend components |
| Jun 18, 2026 | **Staff Management overhaul** — table view, search/filter, edit modal, reset password, role-colored badges | `ManageStaff.tsx`, `staffRoutes.ts` |
| Jun 18, 2026 | **New APIs** — `POST /staff/create`, `PUT /staff/:id/update`, `PUT /staff/:id/reset-password`, `GET /staff/by-role/:role` | `staffRoutes.ts` |
| Jun 18, 2026 | **Role-filtered dropdowns** — INTAKE shows SEO only, SEO_STORE_SETUP shows DESIGNER only, DESIGN shows DEVELOPER only | `TicketDetailPanel.tsx`, `SeoStageSection.tsx`, `DesignSection.tsx` |
| Jun 18, 2026 | **Customer Dashboard fix** — added missing `getDesignSubStatus` function, removed old stage references | `CustomerDashboard.tsx` |

---

> **Maintained by:** Development Team  
> **Platform:** Fawri.net — Salla E-Commerce Onboarding System
