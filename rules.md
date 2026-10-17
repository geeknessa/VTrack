# VTrack - Anti-Slop & Design Rules

## 1. Design Tokens & Color Palette
derived from reference pink soft rose/blush base:
- **Base (Light Background)**: `#FFF5F8` (Soft blush tint)
- **Card Fill / Surface**: `#FFFFFF`
- **Border**: `#F7D6E3` (Subtle soft rose border)
- **Primary Pink Accent**: `#F24E8E` (Vibrant deep pink - WCAG AA compliant on light & dark)
- **Text Primary**: `#2A1A22` (Deep rich plum/charcoal)
- **Text Secondary / Muted**: `#735C66`
- **Red (Errors & Overspending ONLY)**: `#D32F2F` (Strictly reserved for negative budget/error states)
- **Success / Green (Income/Goals ONLY)**: `#2E7D32`

## 2. Anti-Slop Rules (Strict Enforcement)
1. **NO Drop Shadows or Glows**: Separate surfaces using borders (`border border-[var(--color-border)]`) and subtle background fills.
2. **NO Emojis Anywhere**: Use inline SVG icons or custom SVG sets. Emojis in UI are forbidden.
3. **NO Gradients**: Flat colors only (especially no AI purple/pink gradients).
4. **NO Lucide Sparkles**: Do not use the `Sparkles` icon from lucide-react. It looks like generic AI slop.
4. **NO Spinners**: Use skeleton loaders (`animate-pulse` background blocks) matching the exact element dimensions.
5. **Human & Actionable Error Messages**: Explain what happened and what to do next. Never show raw SQL codes or generic "Something went wrong". Always preserve form inputs on failure.
6. **Fixed Spacing Scale**: Use 4px, 8px, 12px, 16px, 24px, 32px (`p-1`, `p-2`, `p-3`, `p-4`, `p-6`, `p-8`).
7. **NO Lorem Ipsum or Placeholder Text**: All copy must be meaningful and derived from `strings.ts`.
8. **Mascot (Coin Buddy)**: SVG round coin with cheeks, notebook, animated moods (happy, counting, celebrating, worried, sleepy, waving).

## 3. Financial Computation Rules
1. **Minor Units Storage**:
   - `1 NGN` = `100 Kobo`. Stored in DB as integer `100`.
   - `1 USD` = `100 Cents`. Stored in DB as integer `100`.
   - Formatters convert minor units to display string (e.g. `formatMoney(150000, 'NGN')` -> `₦1,500.00`).
2. **Immutable Converted Amounts**:
   - Every transaction saves `amount` (minor units), `currency`, `exchange_rate`, `converted_amount` (minor units of user's home currency).
   - Rate updates do NOT re-convert historical records.

## 4. Voice & Tone
- All strings in `frontend/src/i18n/strings.ts`.
- Tone: Warm, playful, encouraging, non-judgmental, clear second-person ("You", "Your").
- Example messages:
  - Empty: "Nothing here yet. Tap + and tell me about your first spend."
  - Logged: "Got it. Jollof, ₦1,500. Noted."
  - Warning: "Food is running a bit hot this week. Eating in a couple of times could cool it down."
