import { describe, it, expect } from 'vitest';
import { toMinorUnits, toMajorUnits, formatMoney, convertCurrency } from './money.js';

describe('VTrack Money Logic & Minor Units', () => {
  it('correctly converts major units to integer minor units', () => {
    expect(toMinorUnits(1500.50, 'NGN')).toBe(150050);
    expect(toMinorUnits('250.75', 'USD')).toBe(25075);
    expect(toMinorUnits(0, 'NGN')).toBe(0);
  });

  it('correctly converts integer minor units back to major units', () => {
    expect(toMajorUnits(150050, 'NGN')).toBe(1500.50);
    expect(toMajorUnits(25075, 'USD')).toBe(250.75);
  });

  it('formats NGN with Naira symbol ₦ (U+20A6) and proper commas', () => {
    expect(formatMoney(150050, 'NGN')).toBe('₦1,500.50');
    expect(formatMoney(2500000, 'NGN')).toBe('₦25,000.00');
    expect(formatMoney(100, 'USD')).toBe('$1.00');
  });

  it('converts minor units using exchange rate deterministically', () => {
    // e.g. 100 USD cents ($1.00) at 1500 NGN per USD
    const converted = convertCurrency(100, 1500.0);
    expect(converted).toBe(150000); // 150,000 Kobo = ₦1,500.00
  });
});
