/**
 * Money Utility Module for VTrack
 * Enforces integer minor units storage and precise formatting.
 */

// Supported currency definitions
const CURRENCIES = {
  NGN: { symbol: '₦', minorUnitName: 'Kobo', decimals: 2 },
  USD: { symbol: '$', minorUnitName: 'Cents', decimals: 2 },
  GBP: { symbol: '£', minorUnitName: 'Pence', decimals: 2 },
  EUR: { symbol: '€', minorUnitName: 'Cents', decimals: 2 },
  KES: { symbol: 'KSh', minorUnitName: 'Cents', decimals: 2 },
  GHS: { symbol: 'GH₵', minorUnitName: 'Pesewas', decimals: 2 },
};

/**
 * Converts a major unit float string or number to integer minor units.
 * E.g., 1500.50 NGN -> 150050 Kobo
 */
function toMinorUnits(amountMajor, currency = 'NGN') {
  if (amountMajor === undefined || amountMajor === null || amountMajor === '') return 0;
  const num = typeof amountMajor === 'string' ? parseFloat(amountMajor) : amountMajor;
  if (isNaN(num)) return 0;
  const decimals = CURRENCIES[currency]?.decimals ?? 2;
  return Math.round(num * Math.pow(10, decimals));
}

/**
 * Converts integer minor units to major unit decimal number.
 * E.g., 150050 Kobo -> 1500.50
 */
function toMajorUnits(amountMinor, currency = 'NGN') {
  if (!amountMinor) return 0;
  const decimals = CURRENCIES[currency]?.decimals ?? 2;
  return amountMinor / Math.pow(10, decimals);
}

/**
 * Formats minor unit integer into a display string with currency symbol.
 * Handles Naira sign ₦ (U+20A6) explicitly.
 * E.g., 150050 NGN -> "₦1,500.50"
 */
function formatMoney(amountMinor, currency = 'NGN', showDecimals = true) {
  const amount = toMajorUnits(amountMinor || 0, currency);
  const curr = CURRENCIES[currency] || { symbol: currency, decimals: 2 };
  
  const formattedNum = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showDecimals ? curr.decimals : 0,
    maximumFractionDigits: showDecimals ? curr.decimals : 0,
  }).format(amount);

  return `${curr.symbol}${formattedNum}`;
}

/**
 * Converts minor units between currencies using an exchange rate.
 * Result is rounded to nearest integer minor unit in home currency.
 * Past conversions are saved as fixed converted_amount.
 */
function convertCurrency(amountMinorOriginal, rate) {
  if (!amountMinorOriginal || !rate) return 0;
  return Math.round(amountMinorOriginal * rate);
}

const defaultDb = require('../db');

/**
 * Resolves user's home currency and converts an amount in minor units to the home currency.
 */
async function resolveCurrencyConversion(amount, currency, userId, customRate, db = defaultDb) {
  const userSettingsRes = await db.query(
    'SELECT home_currency FROM user_settings WHERE user_id = $1',
    [userId]
  );
  const homeCurrency = userSettingsRes.rows[0]?.home_currency || 'NGN';

  if (!currency || currency.toUpperCase() === homeCurrency.toUpperCase()) {
    return {
      homeCurrency,
      exchangeRate: 1.0,
      convertedAmount: Math.round(Number(amount))
    };
  }

  const txCurr = currency.toUpperCase();
  const homeCurr = homeCurrency.toUpperCase();

  if (customRate && Number(customRate) > 0) {
    const rate = Number(customRate);
    return {
      homeCurrency,
      exchangeRate: rate,
      convertedAmount: Math.round(Number(amount) * rate)
    };
  }

  // Look up fx_rates
  const fxRes = await db.query(
    `SELECT base_currency, target_currency, rate FROM fx_rates
     WHERE (base_currency = $1 AND target_currency = $2)
        OR (base_currency = $2 AND target_currency = $1)
     LIMIT 1`,
    [txCurr, homeCurr]
  );

  if (fxRes.rows.length > 0) {
    const row = fxRes.rows[0];
    let rate = Number(row.rate);
    if (row.base_currency === homeCurr && row.target_currency === txCurr) {
      rate = 1.0 / rate;
    }
    return {
      homeCurrency,
      exchangeRate: rate,
      convertedAmount: Math.round(Number(amount) * rate)
    };
  }

  return {
    homeCurrency,
    exchangeRate: 1.0,
    convertedAmount: Math.round(Number(amount))
  };
}

module.exports = {
  CURRENCIES,
  toMinorUnits,
  toMajorUnits,
  formatMoney,
  convertCurrency,
  resolveCurrencyConversion,
};
