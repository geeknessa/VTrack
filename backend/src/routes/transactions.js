const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveCurrencyConversion } = require('../utils/money');
const router = express.Router();

router.use(requireAuth);

// Export Transactions to CSV (placed before parameterized routes)
router.get('/export', async (req, res) => {
  try {
    const txRes = await db.query(
      `SELECT t.id, t.occurred_at, t.type, t.amount, t.currency, t.exchange_rate,
              t.converted_amount, t.note, t.source_group, c.name as category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       ORDER BY t.occurred_at DESC`,
      [req.userId]
    );

    const headers = [
      'Transaction ID',
      'Date & Time (UTC)',
      'Type',
      'Category',
      'Amount',
      'Currency',
      'Exchange Rate',
      'Converted Home Amount',
      'Note',
      'Source Group'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = txRes.rows.map(row => {
      const majorAmount = (Number(row.amount) / 100).toFixed(2);
      const majorConverted = (Number(row.converted_amount || row.amount) / 100).toFixed(2);
      return [
        escapeCsv(row.id),
        escapeCsv(new Date(row.occurred_at).toISOString()),
        escapeCsv(row.type),
        escapeCsv(row.category_name || 'Uncategorised'),
        escapeCsv(majorAmount),
        escapeCsv(row.currency),
        escapeCsv(row.exchange_rate || 1.0),
        escapeCsv(majorConverted),
        escapeCsv(row.note || ''),
        escapeCsv(row.source_group || 'general')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const today = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vtrack_transactions_${today}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: { message: 'Failed to export transactions.' } });
  }
});

// Create Transaction
router.post('/', async (req, res) => {
  const { type, amount, currency, exchange_rate: reqRate, category_id, note, occurred_at } = req.body;

  if (!type || !amount || !currency) {
    return res.status(400).json({ error: { message: 'Type, amount, and currency are required.' } });
  }

  try {
    const { exchangeRate, convertedAmount } = await resolveCurrencyConversion(
      amount,
      currency,
      req.userId,
      reqRate
    );

    const insertRes = await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, exchange_rate, converted_amount, category_id, note, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))
       RETURNING *`,
      [req.userId, type, amount, currency, exchangeRate, convertedAmount, category_id || null, note || null, occurred_at || null]
    );

    return res.status(201).json({
      message: type === 'expense' ? 'Spend logged!' : 'Income logged!',
      transaction: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Transaction creation error:', err);
    return res.status(500).json({ error: { message: 'Could not save transaction. Please try again.' } });
  }
});

// ── Gemini Multimodal Financial Document Parser Helper ──────────────────────
async function parseTransactionDocumentWithGeminiVision(base64Data, mimeType = 'image/jpeg', docType = 'receipt') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend .env');
  }

  const prompt = `You are a financial document parser specialized in Nigerian bank statements, bank transfer alerts (GTBank, Access, Zenith, Opay, Kuda, Moniepoint, PalmPay, etc.) and POS / store receipts.
Document type: ${docType === 'bank_statement' ? 'Bank Statement or Transfer Alert' : 'Receipt or POS Slip'}.

Carefully analyze the image and extract all distinct financial transactions.
For receipts: extract the individual purchase items or total store charge.
For bank statements / alerts: extract each debit or credit entry shown.

For each transaction, provide:
1. "date": The transaction date in "YYYY-MM-DD" format. If no year is present, assume ${new Date().getFullYear()}. If no date is found, use today's date "${new Date().toISOString().split('T')[0]}".
2. "description": Clean, concise merchant, counterparty, or transaction narrative (e.g. "Food Court - Zulkys", "Opay Transfer to Chinedu", "Chicken Republic", "Supermarket Groceries", "MTN Airtime").
3. "amount": The amount in Nigerian Naira as an integer or decimal number (e.g. 2500 for ₦2,500, 15000 for ₦15,000, 350.50 for ₦350.50). Do NOT return kobo; return standard Naira units.
4. "type": "expense" for purchases, debits, payments sent, or bank fees. "income" for inflows, salary, gifts, or money received.
5. "suggested_category": The most appropriate category from this list:
   - "Food & Groceries"
   - "Snacks & Drinks"
   - "Transport & Commute"
   - "Data & Airtime"
   - "Academics & Books"
   - "Health & Toiletries"
   - "Rent & Utilities"
   - "Outings & Hangouts"
   - "Clothes & Fashion"
   - "Tech & Accessories"
   - "Gifts & Giving"
   - "Entertainment & Subscriptions"

Return strictly valid JSON:
{
  "document_type": "${docType}",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": string,
      "amount": number,
      "type": "expense" | "income",
      "suggested_category": string
    }
  ]
}`;

  const models = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.5-flash'
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        return { ...parsed, model_used: model };
      }

      if (data.error) {
        console.warn(`[AI Transaction Vision] Model ${model} returned:`, data.error.code, data.error.message?.slice(0, 80));
        lastError = new Error(data.error.message || `API error (${data.error.code})`);
      }
    } catch (err) {
      console.warn(`[AI Transaction Vision] Error calling ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All vision models were temporarily busy. Please try again.');
}

// ── POST /api/transactions/ai-scan (Gemini Vision Importer) ─────────────────
router.post('/ai-scan', async (req, res) => {
  const { image, mimeType, docType = 'receipt' } = req.body;
  if (!image) {
    return res.status(400).json({ error: { message: 'Image data is required.' } });
  }

  try {
    let base64Clean = image;
    let finalMimeType = mimeType || 'image/jpeg';
    if (image.includes(';base64,')) {
      const parts = image.split(';base64,');
      finalMimeType = parts[0].replace('data:', '');
      base64Clean = parts[1];
    }

    const aiResult = await parseTransactionDocumentWithGeminiVision(base64Clean, finalMimeType, docType);
    const rawTxList = Array.isArray(aiResult.transactions) ? aiResult.transactions : [];

    // Fetch user categories to match IDs
    const catRes = await db.query(
      `SELECT id, name FROM categories WHERE user_id IS NULL OR user_id = $1`,
      [req.userId]
    );
    const categories = catRes.rows;

    const formattedTransactions = rawTxList.map((tx, idx) => {
      // Find matching category id
      const matchedCat = categories.find(c =>
        c.name.toLowerCase() === (tx.suggested_category || '').toLowerCase()
      ) || categories.find(c =>
        c.name.toLowerCase().includes((tx.suggested_category || '').toLowerCase())
      );

      // Amount to minor units (kobo)
      const nairaAmount = Math.max(0, Number(tx.amount) || 0);
      const minorAmount = Math.round(nairaAmount * 100);

      return {
        id: `scan-${Date.now()}-${idx}`,
        date: tx.date || new Date().toISOString().split('T')[0],
        description: (tx.description || 'Scanned Transaction').trim(),
        amount: minorAmount,
        type: tx.type === 'income' ? 'income' : 'expense',
        category_id: matchedCat ? matchedCat.id : (categories[0]?.id || null),
        category_name: matchedCat ? matchedCat.name : (categories[0]?.name || 'Uncategorised'),
        currency: 'NGN'
      };
    });

    return res.json({
      success: true,
      document_type: docType,
      transactions: formattedTransactions,
      model_used: aiResult.model_used
    });
  } catch (err) {
    console.error('AI transaction scan error:', err);
    return res.status(500).json({
      error: { message: err.message || 'Failed to scan document with Gemini Vision.' }
    });
  }
});

// ── POST /api/transactions/batch (Batch Import Transactions) ────────────────
router.post('/batch', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: { message: 'A non-empty transactions array is required.' } });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const inserted = [];

    for (const tx of transactions) {
      const type = tx.type === 'income' ? 'income' : 'expense';
      const amount = Math.max(1, parseInt(tx.amount, 10) || 0);
      const currency = tx.currency || 'NGN';
      const categoryId = tx.category_id || null;
      const note = tx.note || tx.description || null;
      const occurredAt = tx.occurred_at || tx.date || new Date().toISOString();

      const { exchangeRate, convertedAmount } = await resolveCurrencyConversion(
        amount,
        currency,
        req.userId
      );

      const resInsert = await client.query(
        `INSERT INTO transactions (user_id, type, amount, currency, exchange_rate, converted_amount, category_id, note, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.userId, type, amount, currency, exchangeRate, convertedAmount, categoryId, note, occurredAt]
      );
      inserted.push(resInsert.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: `Successfully imported ${inserted.length} transaction${inserted.length === 1 ? '' : 's'}!`,
      count: inserted.length,
      transactions: inserted
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch transaction import error:', err);
    return res.status(500).json({ error: { message: 'Failed to import transactions. Please try again.' } });
  } finally {
    client.release();
  }
});

// Get Transaction Summary (supports optional ?from=&to= date range)
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [req.userId];
    let dateFilter = '';
    if (from) { params.push(from); dateFilter += ` AND occurred_at >= $${params.length}`; }
    if (to)   { params.push(to);   dateFilter += ` AND occurred_at <= $${params.length}`; }

    const summaryRes = await db.query(
      `SELECT type, SUM(COALESCE(converted_amount, amount)) as total
       FROM transactions
       WHERE user_id = $1 AND source_group IS DISTINCT FROM 'piggybank'${dateFilter}
       GROUP BY type`,
      params
    );
    
    let income = 0;
    let expense = 0;
    summaryRes.rows.forEach(row => {
      if (row.type === 'income') income = Number(row.total);
      if (row.type === 'expense') expense = Number(row.total);
    });

    // Find highest expense category in the same date range
    const catParams = [req.userId];
    let catDateFilter = '';
    if (from) { catParams.push(from); catDateFilter += ` AND t.occurred_at >= $${catParams.length}`; }
    if (to)   { catParams.push(to);   catDateFilter += ` AND t.occurred_at <= $${catParams.length}`; }

    const catRes = await db.query(
      `SELECT c.name as category_name, SUM(COALESCE(t.converted_amount, t.amount)) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense' AND t.source_group IS DISTINCT FROM 'piggybank'
         ${catDateFilter}
       GROUP BY c.id, c.name
       ORDER BY total DESC
       LIMIT 1`,
      catParams
    );

    const highestExpenseCategory = catRes.rows.length > 0 ? catRes.rows[0].category_name : null;
    
    return res.json({ income, expense, highest_expense_category: highestExpenseCategory });
  } catch (err) {
    console.error('Summary fetch error:', err);
    return res.status(500).json({ error: { message: 'Could not fetch summary.' } });
  }
});

// Get Spending by Category
router.get('/by-category', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [req.userId];
    let dateFilter = '';
    if (from) { params.push(from); dateFilter += ` AND t.occurred_at >= $${params.length}`; }
    if (to)   { params.push(to);   dateFilter += ` AND t.occurred_at <= $${params.length}`; }

    const result = await db.query(
      `SELECT 
         COALESCE(c.name, 'Uncategorised') as category_name,
         COALESCE(c.icon_key, 'tag') as category_icon,
         SUM(COALESCE(t.converted_amount, t.amount)) as total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND t.source_group IS DISTINCT FROM 'piggybank'
         ${dateFilter}
       GROUP BY c.id, c.name, c.icon_key
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

    return res.json({ categories: result.rows });
  } catch (err) {
    console.error('Category breakdown error:', err);
    return res.status(500).json({ error: { message: 'Could not fetch category breakdown.' } });
  }
});

// Get Transactions (supports optional ?type=&from=&to=&limit=&offset=)
router.get('/', async (req, res) => {
  try {
    const { type, from, to, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT t.*, c.name as category_name, c.icon_key as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    const params = [req.userId];

    if (type && (type === 'expense' || type === 'income')) {
      params.push(type);
      query += ` AND t.type = $${params.length}`;
    }
    if (from) { params.push(from); query += ` AND t.occurred_at >= $${params.length}`; }
    if (to)   { params.push(to);   query += ` AND t.occurred_at <= $${params.length}`; }

    query += ` ORDER BY t.occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const txRes = await db.query(query, params);
    return res.json({ transactions: txRes.rows });
  } catch (err) {
    console.error('Transaction fetch error:', err);
    return res.status(500).json({ error: { message: 'Could not fetch activity feed.' } });
  }
});

// Update Transaction (Edit)
router.put('/:id', async (req, res) => {
  const txId = req.params.id;
  const { type, amount, currency, exchange_rate: reqRate, category_id, note, occurred_at } = req.body;

  try {
    // Verify ownership
    const checkRes = await db.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, req.userId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Transaction not found.' } });
    }

    const current = checkRes.rows[0];
    const newAmount = amount !== undefined ? Math.round(Number(amount)) : current.amount;
    const newCurrency = currency || current.currency;
    const newType = type || current.type;
    const newCategoryId = category_id !== undefined ? (category_id ? Number(category_id) : null) : current.category_id;
    const newNote = note !== undefined ? (note ? String(note).trim() : null) : current.note;
    const newOccurredAt = occurred_at ? new Date(occurred_at).toISOString() : current.occurred_at;

    const { exchangeRate, convertedAmount } = await resolveCurrencyConversion(
      newAmount,
      newCurrency,
      req.userId,
      reqRate || (newCurrency === current.currency ? current.exchange_rate : null)
    );

    await db.query(
      `UPDATE transactions SET
        type = $1,
        amount = $2,
        currency = $3,
        exchange_rate = $4,
        converted_amount = $5,
        category_id = $6,
        note = $7,
        occurred_at = $8
       WHERE id = $9 AND user_id = $10`,
      [newType, newAmount, newCurrency, exchangeRate, convertedAmount, newCategoryId, newNote, newOccurredAt, txId, req.userId]
    );

    // Fetch joined category details
    const fullRes = await db.query(
      `SELECT t.*, c.name as category_name, c.icon_key as category_icon
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1`,
      [txId]
    );

    return res.json({
      message: 'Transaction updated successfully!',
      transaction: fullRes.rows[0]
    });
  } catch (err) {
    console.error('Transaction update error:', err);
    return res.status(500).json({ error: { message: 'Could not update transaction.' } });
  }
});

// Delete Transaction
router.delete('/:id', async (req, res) => {
  const txId = req.params.id;

  try {
    // Verify ownership
    const checkRes = await db.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, req.userId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Transaction not found.' } });
    }

    const tx = checkRes.rows[0];

    // If this was a piggybank transaction, adjust vault_balance
    if (tx.source_group === 'piggybank') {
      await db.query(
        `UPDATE user_settings
         SET vault_balance = GREATEST(0, vault_balance - $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [tx.amount, req.userId]
      );
    }

    await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [txId, req.userId]);

    return res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    console.error('Transaction delete error:', err);
    return res.status(500).json({ error: { message: 'Could not delete transaction.' } });
  }
});

module.exports = router;
