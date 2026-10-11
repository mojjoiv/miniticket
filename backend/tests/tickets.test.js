const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Pool } = require('pg');
const { createApp } = require('../app');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = createApp(pool);
const marker = `integration-${Date.now()}-`;

test('ticket API integration', async (t) => {
  await pool.query('SELECT 1');
  t.after(async () => {
    await pool.query('DELETE FROM tickets WHERE title LIKE $1', [`${marker}%`]);
    await pool.end();
  });

  let created;
  await t.test('POST /tickets creates a ticket with defaults', async () => {
    const response = await request(app).post('/tickets').send({
      title: `${marker}created ticket`,
      description: 'Created by API integration test'
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.title, `${marker}created ticket`);
    assert.equal(response.body.status, 'open');
    assert.equal(response.body.priority, 'medium');
    assert.ok(response.body.id);
    assert.ok(response.body.created_at);
    created = response.body;
  });

  await t.test('POST /tickets rejects an empty title', async () => {
    const response = await request(app).post('/tickets').send({ title: '   ' });
    assert.equal(response.status, 400);
  });

  await t.test('PATCH /tickets/:id updates status and priority', async () => {
    const response = await request(app).patch(`/tickets/${created.id}`)
      .send({ status: 'in_progress', priority: 'high' });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'in_progress');
    assert.equal(response.body.priority, 'high');
  });

  await t.test('GET /tickets supports status filter and pagination', async () => {
    const response = await request(app).get('/tickets?status=in_progress&page=1&limit=5');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data));
    assert.ok(response.body.data.every((ticket) => ticket.status === 'in_progress'));
    assert.equal(response.body.pagination.page, 1);
    assert.equal(response.body.pagination.limit, 5);
  });

  await t.test('GET /tickets/stats returns counts grouped by status', async () => {
    const response = await request(app).get('/tickets/stats');
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.open, 'number');
    assert.equal(typeof response.body.in_progress, 'number');
    assert.equal(typeof response.body.closed, 'number');
    assert.ok(response.body.in_progress >= 1);
  });
});
