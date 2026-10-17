const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// Get user categories (global defaults + user created)
router.get('/', async (req, res) => {
  try {
    const categoriesRes = await db.query(
      `SELECT * FROM categories 
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY is_default DESC, kind ASC, name ASC`,
      [req.userId]
    );
    return res.json({ categories: categoriesRes.rows });
  } catch (err) {
    console.error('Categories fetch error:', err);
    return res.status(500).json({ error: { message: 'Failed to fetch categories.' } });
  }
});

// Create custom category
router.post('/', async (req, res) => {
  const { name, icon_key, kind } = req.body;

  if (!name || !kind || !['needs', 'wants'].includes(kind)) {
    return res.status(400).json({
      error: { message: 'Category name and type (needs or wants) are required.', action: 'check_fields' }
    });
  }

  try {
    const newCategory = await db.query(
      `INSERT INTO categories (user_id, name, icon_key, kind, is_default)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [req.userId, name, icon_key || 'tag', kind]
    );

    return res.status(201).json({
      message: 'Category created!',
      category: newCategory.rows[0]
    });
  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ error: { message: 'Failed to create category.' } });
  }
});

module.exports = router;
