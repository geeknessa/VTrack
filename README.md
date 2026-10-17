# VTrack - Student Budget & Allowance Tracker

VTrack is a budget and expense tracker/planner designed specifically for university students whose primary income comes as an allowance from a sponsor.

---

## 1. Stack Overview
- **Database**: PostgreSQL with plain SQL migration files (no ORM).
- **Backend**: Node.js + Express JSON API (`/api`).
- **Frontend**: React + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS with CSS Variable design tokens, Recharts, Zod.
- **Auth**: Email + password (bcrypt), session cookies.
- **Financial Rules**: All amounts stored as integer minor units in PostgreSQL. Immutable conversions.

---

## 2. Setup & Running Locally

### Prerequisites
- Node.js v18+
- PostgreSQL 14+ running locally (Database connection string configured in `backend/.env`)

### Backend Setup & Database Migration
```bash
cd backend
npm install
npm run migrate
npm start
```
The API server runs at `http://localhost:5000`.

### Frontend Setup & Running Dev Server
```bash
cd frontend
npm install
npm run dev
```
The web app runs at `http://localhost:5173`.

---

## 3. Running Financial Math & Rules Engine Tests
Unit tests verify minor unit integer conversions, currency formatting with Naira `₦` (U+20A6) support, and exchange rate calculations:

```bash
cd backend
npm test
```
