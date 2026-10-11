const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const STATUSES = ['open', 'in_progress', 'closed'];
const PRIORITIES = ['low', 'medium', 'high'];

function createApp(pool = new Pool({ connectionString: process.env.DATABASE_URL })) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.post('/tickets', async (req, res, next) => {
    try {
      const { title, description = null, status = 'open', priority = 'medium' } = req.body || {};
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        return res.status(400).json({ error: 'Title is required and must be at most 200 characters.' });
      }
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string.' });
      }
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status must be open, in_progress, or closed.' });
      }
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Priority must be low, medium, or high.' });
      }
      const result = await pool.query(
        'INSERT INTO tickets (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING *',
        [title.trim(), description, status, priority]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/tickets/stats', async (_req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status'
      );
      const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
      for (const row of result.rows) counts[row.status] = row.count;
      return res.json(counts);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/tickets', async (req, res, next) => {
    try {
      const status = req.query.status;
      if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status filter must be open, in_progress, or closed.' });
      }
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Page must be positive and limit must be between 1 and 100.' });
      }

      const values = [];
      let where = '';
      if (status) {
        values.push(status);
        where = 'WHERE status = $1';
      }
      const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM tickets ${where}`, values);
      const total = countResult.rows[0].total;
      const offset = (page - 1) * limit;
      const dataResult = await pool.query(
        `SELECT * FROM tickets ${where} ORDER BY created_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      );
      return res.json({
        data: dataResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/tickets/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Ticket ID must be a positive integer.' });
      }
      const { status, priority } = req.body || {};
      if (status === undefined && priority === undefined) {
        return res.status(400).json({ error: 'Provide status and/or priority to update.' });
      }
      if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status must be open, in_progress, or closed.' });
      }
      if (priority !== undefined && !PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Priority must be low, medium, or high.' });
      }

      const fields = [];
      const values = [];
      if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
      if (priority !== undefined) { values.push(priority); fields.push(`priority = $${values.length}`); }
      values.push(id);
      const result = await pool.query(
        `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Ticket not found.' });
      return res.json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
