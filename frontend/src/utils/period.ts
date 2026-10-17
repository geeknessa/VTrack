import { strings } from '../i18n/strings';

export type PeriodMode =
  | 'cycle'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'
  | 'custom'
  | 'all_time';

export interface PeriodOptions {
  period_anchor_date?: string | null;
  expected_next_income_date?: string | null;
  customFrom?: string;
  customTo?: string;
}

export interface PeriodCalculation {
  mode: PeriodMode;
  offset: number;
  from?: string; // ISO string
  to?: string;   // ISO string
  label: string;
  subLabel?: string;
  badge?: string;
  daysRemaining?: number;
  totalDays?: number;
  isCurrent: boolean;
  canStep: boolean;
  hasCycleConfigured: boolean;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function calculatePeriod(
  mode: PeriodMode,
  offset: number,
  options: PeriodOptions = {}
): PeriodCalculation {
  const now = new Date();

  if (mode === 'all_time') {
    return {
      mode,
      offset: 0,
      from: undefined,
      to: undefined,
      label: strings.period.allTime,
      subLabel: 'All recorded activity',
      isCurrent: true,
      canStep: false,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
    };
  }

  if (mode === 'custom') {
    let fromIso: string | undefined;
    let toIso: string | undefined;
    let label = strings.period.customRange;
    let subLabel: string | undefined;

    if (options.customFrom) {
      const [y, m, d] = options.customFrom.split('-').map(Number);
      const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      fromIso = fromDate.toISOString();

      if (options.customTo) {
        const [ty, tm, td] = options.customTo.split('-').map(Number);
        const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        toIso = toDate.toISOString();
        label = `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`;
        subLabel = `${formatDateFull(fromDate)} to ${formatDateFull(toDate)}`;
      } else {
        label = `Since ${formatDateShort(fromDate)}`;
        subLabel = `From ${formatDateFull(fromDate)}`;
      }
    } else if (options.customTo) {
      const [ty, tm, td] = options.customTo.split('-').map(Number);
      const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);
      toIso = toDate.toISOString();
      label = `Until ${formatDateShort(toDate)}`;
      subLabel = `Up to ${formatDateFull(toDate)}`;
    }

    return {
      mode,
      offset: 0,
      from: fromIso,
      to: toIso,
      label,
      subLabel,
      isCurrent: true,
      canStep: false,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
    };
  }

  if (mode === 'daily') {
    const target = new Date();
    target.setDate(now.getDate() + offset);

    const fromDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
    const toDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);

    let label: string;
    if (offset === 0) {
      label = `${strings.period.today} (${formatDateShort(target)})`;
    } else if (offset === -1) {
      label = `${strings.period.yesterday} (${formatDateShort(target)})`;
    } else {
      label = formatDateFull(target);
    }

    return {
      mode,
      offset,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      label,
      subLabel: target.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      isCurrent: offset === 0,
      canStep: true,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
      totalDays: 1,
    };
  }

  if (mode === 'weekly') {
    const target = new Date();
    target.setDate(now.getDate() + offset * 7);

    const day = target.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(target.getFullYear(), target.getMonth(), target.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    let label: string;
    if (offset === 0) {
      label = `${strings.period.thisWeek} (${formatDateShort(monday)} – ${formatDateShort(sunday)})`;
    } else if (offset === -1) {
      label = `${strings.period.lastWeek} (${formatDateShort(monday)} – ${formatDateShort(sunday)})`;
    } else {
      label = `${formatDateShort(monday)} – ${formatDateShort(sunday)}, ${sunday.getFullYear()}`;
    }

    return {
      mode,
      offset,
      from: monday.toISOString(),
      to: sunday.toISOString(),
      label,
      subLabel: `${formatDateFull(monday)} to ${formatDateFull(sunday)}`,
      isCurrent: offset === 0,
      canStep: true,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
      totalDays: 7,
    };
  }

  if (mode === 'biweekly') {
    const target = new Date();
    target.setDate(now.getDate() + offset * 14);

    const day = target.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate() + diffToMonday - 7, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 13, 23, 59, 59, 999);

    let label = `${formatDateShort(start)} – ${formatDateShort(end)}`;
    if (offset === 0) label = `${strings.period.thisBiweek} (${formatDateShort(start)} – ${formatDateShort(end)})`;

    return {
      mode,
      offset,
      from: start.toISOString(),
      to: end.toISOString(),
      label,
      subLabel: `${formatDateFull(start)} to ${formatDateFull(end)}`,
      isCurrent: offset === 0,
      canStep: true,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
      totalDays: 14,
    };
  }

  if (mode === 'monthly') {
    const targetMonth = now.getMonth() + offset;
    const firstDay = new Date(now.getFullYear(), targetMonth, 1, 0, 0, 0, 0);
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let label = monthName;
    if (offset === 0) label = `${strings.period.thisMonth} (${firstDay.toLocaleDateString('en-US', { month: 'short' })})`;
    else if (offset === -1) label = `${strings.period.lastMonth} (${firstDay.toLocaleDateString('en-US', { month: 'short' })})`;

    return {
      mode,
      offset,
      from: firstDay.toISOString(),
      to: lastDay.toISOString(),
      label,
      subLabel: monthName,
      isCurrent: offset === 0,
      canStep: true,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
      totalDays: lastDay.getDate(),
    };
  }

  if (mode === 'yearly') {
    const targetYear = now.getFullYear() + offset;
    const firstDay = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const lastDay = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    let label = `${targetYear}`;
    if (offset === 0) label = `${strings.period.thisYear} (${targetYear})`;

    return {
      mode,
      offset,
      from: firstDay.toISOString(),
      to: lastDay.toISOString(),
      label,
      subLabel: `Jan 1 – Dec 31, ${targetYear}`,
      isCurrent: offset === 0,
      canStep: true,
      hasCycleConfigured: Boolean(options.period_anchor_date || options.expected_next_income_date),
      totalDays: 365,
    };
  }

  // mode === 'cycle' (Allowance Cycle)
  const hasAnchor = Boolean(options.period_anchor_date);
  const hasExpected = Boolean(options.expected_next_income_date);
  const hasCycleConfigured = hasAnchor || hasExpected;

  let startDate: Date;
  let endDate: Date;

  if (hasAnchor) {
    const rawAnchor = String(options.period_anchor_date).split('T')[0];
    const [ay, am, ad] = rawAnchor.split('-').map(Number);
    startDate = new Date(ay, am - 1, ad, 0, 0, 0, 0);
  } else {
    // Fallback: 1st of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  if (hasExpected) {
    const rawExpected = String(options.expected_next_income_date).split('T')[0];
    const [ey, em, ed] = rawExpected.split('-').map(Number);
    endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  } else {
    // Fallback: End of current month
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Calculate cycle duration and days remaining
  const msDuration = endDate.getTime() - startDate.getTime();
  const totalDays = Math.max(1, Math.round(msDuration / (1000 * 60 * 60 * 24)));

  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  let badge: string | undefined;
  if (hasExpected) {
    if (daysRemaining > 0) {
      badge = strings.period.cycleRemaining.replace('{{days}}', String(daysRemaining));
    } else {
      badge = strings.period.cycleEnded;
    }
  }

  const cycleLabel = `${strings.period.cycleFull} (${formatDateShort(startDate)} – ${formatDateShort(endDate)})`;
  const subLabel = `${formatDateFull(startDate)} to ${formatDateFull(endDate)}`;

  return {
    mode,
    offset: 0,
    from: startDate.toISOString(),
    to: endDate.toISOString(),
    label: cycleLabel,
    subLabel,
    badge,
    daysRemaining: hasExpected ? daysRemaining : undefined,
    totalDays,
    isCurrent: true,
    canStep: false,
    hasCycleConfigured,
  };
}
