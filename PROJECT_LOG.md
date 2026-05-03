# 📋 PROJECT LOG — Salla Automated E-Commerce Onboarding Platform

> **Last Updated:** April 27, 2026  
> **Version:** 1.0.0-beta  
> **Status:** Active Development

---

## 1. Project Overview

This platform is an **automated e-commerce store onboarding system** built for the Salla ecosystem. It streamlines the entire journey from customer intake to brand identity creation — replacing manual processes with an AI-powered, self-service pipeline.

### Core Workflow

```
Customer Intake → Legal Verification → AI Brand Generation → Dashboard & Tracking
```

A new customer fills out their legal and business information, receives AI-generated brand suggestions (names, color palettes, and logos), selects their preferences, and is immediately onboarded with a personalized tracking dashboard. Internal staff manage the pipeline through a separate admin dashboard.

---

## 2. Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Vite, TypeScript | SPA with component-based architecture |
| **Styling** | Tailwind CSS 4 | Utility-first, mobile-first responsive design |
| **Backend** | Node.js, Express, TypeScript | REST API server with modular routing |
| **ORM** | Prisma | Type-safe database access and migrations |
| **Database** | SQLite (dev) | Lightweight relational storage |
| **File Storage** | Supabase Storage + Local Uploads | Document and image persistence |
| **AI Engine** | Google Gemini API (v1beta) | Brand name, palette, and logo generation |
| **Auth** | JWT (jsonwebtoken) | Stateless authentication with role-based access |
| **Dev Tooling** | ts-node-dev, Vite HMR | Hot-reloading for both frontend and backend |

### Key Dependencies

```
Frontend: react, react-router-dom, zustand, lucide-react, @supabase/supabase-js
Backend:  express, prisma, @google/generative-ai, jsonwebtoken, bcryptjs, cors, multer
```

---

## 3. Features Implemented

### 3.1 AI Brand Generator

The brand generation engine uses Google Gemini to produce creative, industry-tailored suggestions.

- **Name Generation:** 5 unique brand name suggestions with Arabic/English descriptions, tuned for the selected industry (عطور, ملابس, إلكترونيات, قهوة, etc.).
- **Palette Generation:** 3 harmonious color palettes (4 colors each) with creative titles, generated alongside the names in a single API call.
- **Mix & Match:** Users can independently select any name from one suggestion and any palette from another — they are not locked to a single bundle.
- **Manual Override:** Users can type a custom brand name or add/remove individual colors via a color picker.

**Technical Details:**
- Model: `gemini-2.5-flash` → fallback to `gemini-2.5-flash-lite`
- Temperature: `1.8` for high creativity
- Response format: Structured JSON with `names[]` and `palettes[]` arrays

---

### 3.2 AI Logo Generator

Dynamic SVG logo generation powered by Gemini's creative capabilities.

- Generates a clean, scalable SVG logo based on the selected brand name, industry, and color palette.
- Supports iterative regeneration ("توليد نسخة أخرى") with version tracking.
- Logos are uploaded to the server and persisted via the ticket system.

**Technical Details:**
- Model: `gemini-2.5-flash` → fallback to `gemini-2.5-flash-lite`
- Output: Raw SVG extracted from markdown code blocks
- Storage: Base64 → server upload → persistent URL

---

### 3.3 Legal Onboarding Flow (Two-Path System)

The onboarding handles two distinct customer scenarios:

#### Path A — "نعم، متوفرة" (Has existing document)
- Upload field for Commercial Register or Freelance Document (PDF/Image).
- Standard customer info fields (name, email, phone, national ID, IBAN).

#### Path B — "لا، أحتاج استخراج" (Needs document issuance)
- **National ID Upload:** Photo of the national ID or residency card.
- **Full Name (as in ID):** Text field for the legal name.
- **Absher Phone:** The phone number linked to the Absher government portal.
- Info box explaining the issuance process.
- All three fields are transmitted through the full pipeline: `LegalInfoForm` → `BrandIdentityBoard` → `create-final` API → `ClientInfo` (Prisma) → `CustomerDashboard`.

**Data Flow:**
```
LegalInfoForm.tsx (collects data)
    ↓ onNext(legalData)
BrandIdentityBoard.tsx (spreads into payload)
    ↓ POST /api/tickets/create-final
Backend index.ts (saves to ClientInfo via Prisma)
    ↓ GET /api/customer/my-ticket
CustomerDashboard.tsx (renders conditionally)
```

---

### 3.4 Customer Dashboard

A full-featured, real-time dashboard displaying the customer's onboarding status and brand identity.

#### Tracking Stepper
- **6-step progress pipeline:** تم استلام الطلب → اعتماد الهوية → تأسيس المتجر → تصميم البنرات → الربط والبرمجة → جاهز للتسليم
- **Desktop:** Horizontal layout with circular icons, gradient progress line, `whitespace-nowrap` labels, and status badges (مكتمل / قيد التنفيذ / انتظار).
- **Mobile:** Vertical compact list with highlighted current step and touch-friendly tap targets.

#### Brand Identity Section
- Store name, industry, slogan/description
- AI-generated logo with full-size view link
- Color palette grid (`grid-cols-4 sm:grid-cols-5`) with safe JSON parsing for `selectedColors`
- Reference images gallery (Mood Board)

#### Legal Documents Section
- Conditional rendering based on `hasLegalDoc`:
  - **Document Provided:** Link to view the uploaded commercial register.
  - **Issuance Requested:** Displays full name (ID), Absher phone, and a link to view the national ID copy — all with amber "قيد الاستخراج" status badge.
  - **No Document:** Placeholder message.

#### Client Profile Tab
- Read-only display of customer name, email, phone, national ID, and IBAN.

---

### 3.5 Responsive UI/UX (Mobile-First)

Every component follows a mobile-first approach using Tailwind breakpoints (`sm:`, `md:`, `lg:`).

| Component | Mobile (<640px) | Desktop (≥1024px) |
|-----------|----------------|-------------------|
| **Dashboard Sidebar** | Hidden → Mobile top bar + bottom action bar | Full 288px sidebar with navigation |
| **Stepper** | Vertical compact list | Horizontal with connecting line |
| **Form Fields** | Single column, full-width buttons | 2-column grid |
| **Color Palette** | 4-column grid | 5-column grid |
| **Logo Preview** | 144px × 144px | 224px × 224px |
| **Industry Tags** | Horizontal scroll with hidden scrollbar | Flex wrap |
| **AI Name Cards** | 1-column stack | 3-column grid |
| **Submit Buttons** | Full-width, stacked vertically | Inline with flex |

**Custom CSS Utilities:**
```css
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
```

---

## 4. Backend Infrastructure

### 4.1 Model Fallback System

The AI integration uses a robust fallback chain to handle quota limits and service outages:

```typescript
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

for (const modelName of MODELS) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    // Success → return result
  } catch (err) {
    // Log failure → try next model
  }
}
```

**Resolved Issues:**
- ✅ Fixed `404 models/gemini-2.0-flash is not found` — migrated to `gemini-2.5-flash`
- ✅ Fixed `429 Resource Exhausted` — added `gemini-2.5-flash-lite` as fallback
- ✅ Fixed `503 Service Unavailable` — graceful retry with secondary model
- ✅ Removed all hardcoded/fake fallback data — all responses are genuine AI output

### 4.2 File Upload System

```
Client → Base64 encode → POST /api/upload → Server saves to /uploads/ → Returns public URL
```

- Files are stored in `backend/uploads/` with timestamp-prefixed filenames.
- The `/uploads` directory is served statically via Express.
- Full URLs (e.g., `http://localhost:5000/uploads/1777280073829-Asset.png`) are persisted in the database.

### 4.3 Database Schema (Prisma)

Key models:

```prisma
model ClientInfo {
  id              String   @id @default(uuid())
  customerName    String
  email           String   @unique
  phone           String?
  nationalId      String?
  iban            String?
  businessName    String?
  industry        String?
  description     String?
  hasLegalDoc     Boolean  @default(true)
  documentFileUrl String?
  nationalIdUrl   String?
  fullNameInId    String?
  absherPhone     String?
  // ... relations
}

model AIProposal {
  id               String  @id @default(uuid())
  businessName     String?
  selectedName     String?
  selectedColors   String? // JSON array stored as string
  generatedLogoUrl String?
  referenceLogos   String? // JSON array stored as string
  // ... relations
}
```

### 4.4 Authentication

- **Customer Auto-Creation:** When a new customer completes onboarding, a `User` record is created with role `CUSTOMER` and a random password. A JWT token is returned immediately for seamless login.
- **Staff Login:** Standard email/password authentication for staff users.
- **Route Protection:** Frontend uses `useAuthStore` (Zustand) with localStorage persistence. Backend validates JWT on protected endpoints.

---

## 5. Key Files & Architecture

```
system mange/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server, all API routes
│   │   └── services/
│   │       └── geminiService.ts  # AI model configuration & helpers
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── uploads/                  # Stored files (images, documents)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── client/
│   │   │       ├── LegalInfoForm.tsx        # Step 1: Legal data collection
│   │   │       └── BrandIdentityBoard.tsx   # Step 2: AI brand builder
│   │   ├── pages/
│   │   │   ├── ClientPortal.tsx             # Onboarding wrapper with stepper
│   │   │   └── customer/
│   │   │       └── CustomerDashboard.tsx    # Customer tracking dashboard
│   │   ├── store/
│   │   │   └── useAuthStore.ts             # Zustand auth state
│   │   ├── lib/
│   │   │   └── supabase.ts                 # Supabase client config
│   │   └── index.css                       # Global styles & utilities
│   └── index.html
│
└── PROJECT_LOG.md                # ← This file
```

---

## 6. Development Environment

| Service | URL | Command |
|---------|-----|---------|
| Frontend | `http://localhost:5173` | `npm run dev` |
| Backend | `http://localhost:5000` | `npx ts-node-dev src/index.ts` |

**Environment Variables (Backend):**
```
GEMINI_API_KEY=AIzaSy...
DATABASE_URL=file:./dev.db
JWT_SECRET=...
```

---

## 7. Future Roadmap

### Phase 2 — Security & Data Protection
- [ ] Encrypt sensitive fields (National ID, IBAN) at rest
- [ ] Implement rate limiting on AI endpoints
- [ ] Add CSRF protection and input sanitization (Zod schemas)
- [ ] Migrate from SQLite to PostgreSQL for production

### Phase 3 — Communication & Notifications
- [ ] WhatsApp Business API integration for status updates
- [ ] Email notifications on status changes (SendGrid/Resend)
- [ ] In-app notification bell with real-time updates (WebSocket)

### Phase 4 — Brand Book & Export
- [ ] Generate a downloadable PDF "Brand Book" containing:
  - Logo (SVG + PNG exports)
  - Color palette with hex/RGB/CMYK values
  - Typography recommendations
  - Usage guidelines
- [ ] Social media asset templates (profile pictures, covers)

### Phase 5 — Staff Dashboard Enhancements
- [ ] Kanban board for ticket pipeline management
- [ ] Bulk status updates
- [ ] Document issuance completion workflow (mark "Issuance Requested" → "Completed")
- [ ] Analytics dashboard with conversion funnels

### Phase 6 — Production Readiness
- [ ] Docker containerization (frontend + backend + DB)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] CDN for uploaded assets
- [ ] Monitoring & error tracking (Sentry)
- [ ] Comprehensive test suite (Vitest + Playwright)

---

## 8. Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| Apr 23, 2026 | Initial project scaffold — Salla onboarding system | All |
| Apr 26, 2026 | Fixed AI model 404/429 errors, implemented fallback chain | `index.ts`, `geminiService.ts` |
| Apr 26, 2026 | Full onboarding flow: legal → brand → dashboard | `LegalInfoForm.tsx`, `BrandIdentityBoard.tsx`, `ClientPortal.tsx` |
| Apr 27, 2026 | Added Legal Status two-path flow (document vs issuance) | `LegalInfoForm.tsx`, `schema.prisma`, `index.ts` |
| Apr 27, 2026 | Fixed data flow: nationalIdUrl, fullNameInId, absherPhone | `BrandIdentityBoard.tsx`, `index.ts`, `CustomerDashboard.tsx` |
| Apr 27, 2026 | Full responsive overhaul — mobile-first across all components | `ClientPortal.tsx`, `LegalInfoForm.tsx`, `BrandIdentityBoard.tsx`, `CustomerDashboard.tsx`, `index.css` |
| Apr 27, 2026 | Stepper refactor: horizontal (desktop) + vertical (mobile) | `CustomerDashboard.tsx` |
| Apr 27, 2026 | Color palette fix: safe JSON parsing + grid layout | `CustomerDashboard.tsx` |

---

> **Maintained by:** Development Team  
> **Platform:** Salla E-Commerce Onboarding System
