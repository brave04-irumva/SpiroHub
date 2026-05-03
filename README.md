# SpiroHub — Daystar University International Student Compliance Registry

SpiroHub is a production-grade, role-based compliance management platform built for Daystar University's International Office. It tracks and manages the visa, student pass, and permit workflows for all international students from a single centralized dashboard.

Live: **https://spirohub.vercel.app**  
Repository: **https://github.com/brave04-irumva/SpiroHub**

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Roles and Access](#roles-and-access)
5. [Features](#features)
6. [Database Schema](#database-schema)
7. [Compliance Pipeline](#compliance-pipeline)
8. [API Routes](#api-routes)
9. [Environment Variables](#environment-variables)
10. [Getting Started](#getting-started)
11. [Deployment](#deployment)

---

## Overview

International students at Daystar University require active tracking of their immigration documents — Student Passes, Extensions, and Regularization cases. SpiroHub replaces manual spreadsheets with a structured, auditable digital system where:

- **Admins** provision accounts, manage officers, and oversee all cases
- **Officers** manage individual student files, upload documents, and advance cases through the compliance pipeline
- **Students** view their own case status, upload requested documents, and self-edit their profile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS v4 |
| Icons | lucide-react ^1.8.0 |
| Charts | Recharts ^3.8.1 |
| Auth & Database | Supabase (PostgreSQL + Row Level Security) |
| Email | Resend ^6.12.2 |
| Deployment | Vercel (auto-deploy from GitHub main) |
| Version Control | Git + GitHub |

---

## Project Structure

```
spirohub/
├── app/
│   ├── layout.tsx              # Root layout: sidebar, auth guard, dark mode, mobile nav
│   ├── page.tsx                # Dashboard: stats, charts, compliance queue
│   ├── globals.css             # Tailwind v4 global styles
│   │
│   ├── login/page.tsx          # Login with email + password (show/hide toggle)
│   ├── register/page.tsx       # Officer self-registration (daystar.ac.ke only)
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── status/page.tsx         # Public visa status checker
│   │
│   ├── directory/
│   │   ├── page.tsx            # Student list, new case form, CSV import
│   │   └── [id]/page.tsx       # Individual case file: timeline, checklist, docs, edit
│   │
│   ├── alerts/page.tsx         # Expiring/expired permits with one-click email
│   ├── activity/page.tsx       # Recent case events feed
│   ├── analytics/page.tsx      # Charts: nationality, case type, stage breakdown
│   ├── audit/page.tsx          # Admin-only full audit log
│   ├── settings/page.tsx       # Officers + students management, account provisioning
│   │
│   ├── student/page.tsx        # Student portal: status, doc vault, self-edit profile
│   │
│   └── api/
│       └── admin/
│           ├── provision-account/route.ts   # Create Auth user + DB profile in one step
│           └── delete-account/route.ts      # Delete Auth user + DB record
│
├── lib/
│   └── supabase.ts             # Supabase client (anon key)
│
├── types/
│   └── index.ts                # TypeScript types: CaseStage, RiskState, Student, etc.
│
├── utils/
│   └── compliance.ts           # getRiskState(), getStatusStyles()
│
├── public/                     # Static assets
├── next.config.ts
├── tsconfig.json
├── tailwind.config (via postcss.config.mjs)
└── .env.local                  # Local environment variables (not committed)
```

---

## Roles and Access

| Role | Access |
|---|---|
| `ADMIN` | Full access: all pages including Audit Log and Settings. Can provision/delete accounts. |
| `OFFICER` | Operational access: Directory, Alerts, Activity, Analytics, Settings (view). |
| `STUDENT` | Student portal only (`/student`). Can view own case and upload documents. |

Role is determined at login by querying the `officers` or `students` table against the authenticated email. Students are redirected to `/student`; officers and admins go to `/`.

---

## Features

### Dashboard
- Live stats: Total Cases, Expired, Expiring Soon, Compliant, Overdue
- Risk distribution pie chart and pipeline stage bar chart
- Compliance queue with search, bulk selection, and bulk stage advancement
- CSV export of all cases

### Directory
- Full student list with search
- New case form: student_id, name, email, nationality, phone, course, case type, expiry dates
- CSV bulk import
- Case types: `STUDENT_PASS`, `EXTENSION`, `REGULARIZATION`

### Case File (`/directory/[id]`)
- Student profile (editable by officer including phone and course)
- 6-stage pipeline timeline with one-click advancement
- Predefined document checklist per case type (10 docs for STUDENT_PASS/REGULARIZATION, 12 for EXTENSION)
- Document request management: add individually or request all missing
- File upload vault: officer uploads on behalf of student, logs `DOCUMENT_UPLOADED` event
- Case event timeline: full audit trail per case
- EFNS reference number and expiry date fields

### Alerts
- Auto-detects expired and expiring-soon permits
- One-click email dispatch per student

### Activity Feed
- Chronological feed of all case events across all students

### Analytics
- Nationality breakdown, case type distribution, pipeline stage distribution

### Audit Log (Admin only)
- Full system event log with actor, action, and timestamp

### Settings
- Authorized Personnel table: officers and students with role badges and delete
- One-click account provisioning: creates Supabase Auth user and DB profile simultaneously
- Student provisioning fields: admission number, nationality, phone, course
- Dark mode toggle (persisted in `localStorage`)

### Student Portal (`/student`)
- Live permit status card with risk indicator
- Document request list with file upload against each request
- Self-edit profile: full_name, nationality, phone, course

### Auth
- Email + password login with show/hide password toggle
- Forgot password and reset password flow (uses production domain for redirect)
- `@daystar.ac.ke` domain enforced on officer self-registration
- Supabase Auth session management with auto-redirect on sign-out

---

## Database Schema

### `students`
| Column | Type |
|---|---|
| id | UUID PK |
| student_id | TEXT (admission number) |
| full_name | TEXT |
| email | TEXT |
| nationality | TEXT |
| phone | TEXT |
| course | TEXT |
| created_at | TIMESTAMPTZ |

### `officers`
| Column | Type |
|---|---|
| id | UUID PK |
| full_name | TEXT |
| email | TEXT |
| role | TEXT (`ADMIN`, `OFFICER`) |

### `compliance_cases`
| Column | Type |
|---|---|
| id | UUID PK |
| student_id | UUID FK → students |
| current_stage | TEXT |
| case_type | TEXT |
| permit_expiry_date | DATE |
| passport_expiry_date | DATE |
| efns_reference_number | TEXT |
| updated_at | TIMESTAMPTZ |

### `document_requests`
| Column | Type |
|---|---|
| id | UUID PK |
| case_id | UUID FK → compliance_cases |
| title | TEXT |
| status | TEXT (`PENDING`, `FULFILLED`) |
| due_date | DATE |
| created_at | TIMESTAMPTZ |

### `case_events`
| Column | Type |
|---|---|
| id | UUID PK |
| case_id | UUID FK → compliance_cases |
| event_type | TEXT |
| description | TEXT |
| created_by | TEXT |
| created_at | TIMESTAMPTZ |

### `announcements`
| Column | Type |
|---|---|
| id | UUID PK |
| message | TEXT |
| created_by | TEXT |
| is_active | BOOLEAN |
| created_at | TIMESTAMPTZ |

### `system_settings`
| Column | Type |
|---|---|
| key | TEXT PK |
| value | TEXT |
| updated_at | TIMESTAMPTZ |

All tables have Row Level Security (RLS) enabled with `authenticated` user policies.

---

## Compliance Pipeline

Cases move through 6 ordered stages:

```
DOCUMENTS_PENDING
      ↓
DOCUMENTS_SUBMITTED
      ↓
UNDER_REVIEW
      ↓
SUBMITTED_TO_IMMIGRATION
      ↓
APPROVED
      ↓
COMPLETED
```

Every stage change is logged as a `STAGE_CHANGE` event in `case_events`.

---

## API Routes

### `POST /api/admin/provision-account`
Creates a Supabase Auth user and inserts the matching DB profile in one operation.

**Body:**
```json
{
  "email": "student@daystar.ac.ke",
  "password": "tempPassword123",
  "role": "STUDENT",
  "full_name": "Jane Doe",
  "student_id": "DSU/INT/001",
  "nationality": "Kenyan",
  "phone": "+254700000000",
  "course": "BSc Computer Science"
}
```

### `POST /api/admin/delete-account`
Deletes Auth user and DB record. Cannot delete the default admin account.

**Body:**
```json
{
  "email": "student@daystar.ac.ke",
  "role": "STUDENT"
}
```

Both routes use the Supabase **service role key** server-side only. It is never exposed to the browser.

---

## Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`.env.local` is already in `.gitignore` and must never be committed to Git.

Set the same variables in Vercel → Project → Settings → Environment Variables for production.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project with the schema above applied
- Vercel CLI (`npm i -g vercel`) for manual deploys

### Install and run locally

```bash
git clone https://github.com/brave04-irumva/SpiroHub.git
cd SpiroHub
npm install
# copy and fill in your keys
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

---

## Deployment

Auto-deploy is active: every push to `main` on GitHub triggers a Vercel production deploy.

To deploy manually from your machine:

```bash
vercel --prod
```

Vercel project: https://vercel.com/brave-irumvas-projects/spirohub  
Production URL: https://spirohub.vercel.app

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side API routes (`/api/admin/*`) and never sent to the browser.
- If the key is ever exposed, rotate it immediately in Supabase → Project Settings → API, update it in Vercel env vars, and redeploy.
- RLS is enabled on all tables — unauthenticated or cross-user queries are blocked at the database level.
- Officer registration enforces `@daystar.ac.ke` email domain.

---

## License

Private — Daystar University International Office. All rights reserved.