# VTrack - Product Requirements Document (PRD)

## 1. Overview & Core Mission
VTrack is a specialized, mobile-first budget and expense tracker/planner designed specifically for university students whose primary income source is an allowance (daily, weekly, biweekly, monthly, or irregular) from a sponsor.

VTrack empowers students to:
- Quickly log expenses and income (under 10 seconds).
- Track runway ("how long will my allowance last?").
- Plan spending without rigid monthly-only assumptions.
- Share transparent spending reports with sponsors if needed.
- Achieve savings goals without financial jargon or guilt.

---

## 2. Target Persona & Key UX Requirements
- **Persona**: University students living on fixed/intermittent sponsor allowances.
- **Goal Types**:
  1. `see_spending`: Track where every naira/dollar goes.
  2. `make_last`: Ensure funds stretch until the next allowance date.
  3. `save`: Build savings for specific goals (laptop, emergency fund, trips).
- **Key UX Guidelines**:
  - Jakob's Law: Banking app style (bottom tab bar, transactions grouped by date, central + add button).
  - Hick's Law: Max 5 bottom tabs, top 6 categories in quick pick.
  - Law of Proximity: Group closely related figures and input fields.
  - Miller's Law: 5-step onboarding, max ~7 items per visible chunk.
  - Von Restorff Effect: Exactly ONE dominant focal point per screen (e.g. "Left This Period" on Home).

---

## 3. Technology Stack & Architecture

### Backend
- Node.js + Express (JSON API strictly under `/api`).
- PostgreSQL using `pg` driver (no ORM).
- Plain SQL migration files numbered `001_initial_schema.sql`, `002_seed_catalog.sql`, etc.
- Password hashing with `bcrypt` or `argon2`.
- Session management via httpOnly cookies (`express-session` or custom secure token cookie).
- Deterministic rules engine (NO AI/LLM API calls).

### Frontend
- React 18 + Vite + TypeScript.
- React Router DOM v6.
- TanStack Query (React Query) for state, skeleton loaders, and optimistic updates.
- Tailwind CSS driven by CSS variables for design tokens.
- Recharts for data visualizations (donut charts, bar charts).
- `zod` for request/form validation.
- Web Application: Installable PWA with manifest & service worker.
- Fonts: `Fredoka` (Headings & Large Numbers), `Nunito` (Body). Self-hosted font files supporting Naira `₦` (U+20A6) and tabular figures.

---

## 4. Money & Financial Rules
1. **Integer Minor Units**: All monetary values are stored as integers in minor units (e.g. Kobo for NGN, Cents for USD). Never floats.
2. **Multi-Currency & Conversion**:
   - Every transaction stores `amount` (minor units original), `currency`, `exchange_rate` (scaled integer or numeric), and `converted_amount` (minor units home currency).
   - Past transactions are immutable to future rate changes.
   - Home currency is selectable (default: NGN).
   - Exchange rates cached in `fx_rates` table, refreshed at most 2x daily from a free API supporting NGN. Fallback to cached rate if offline/unreachable. User can override exchange rate per entry.
3. **Period & Allowance Model**:
   - Period types: `weekly`, `biweekly`, `monthly`, `custom_days`, `manual`.
   - Start & end dates defined by `period_anchor_date` & `expected_next_income_date` or user manual trigger.
   - Per-day figure calculated based on expected next income date or runway calculation (average daily spend).

---

## 5. Phased Implementation Roadmap
- **Phase 1**: Project structure, DB migrations, seed data, Auth (signup/login/logout/me), User Settings API & frontend shell.
- **Phase 2**: Onboarding (5 steps), Quick Add bottom sheet, Home dashboard, Activity feed, Expenses/Income toggle.
- **Phase 3**: Currency handling, FX rates fetching & caching, rate overrides.
- **Phase 4**: Subscriptions catalog/tracking/reminders & Savings Goals.
- **Phase 5**: Insights dashboard, Rules Engine (deterministic advice), Budget Planner.
- **Phase 6**: Sponsor summary (printable/PDF report), Read-only Share Links, Data Export/Restore, Coin Buddy mascot moods & UI polish.
