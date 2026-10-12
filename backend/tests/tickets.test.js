const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Pool } = require('pg');
const { createApp } = require('../app');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = createApp(pool);
const marker = `integration-${Date.now()}-`;

test('ticket API integration', async (t) => {
  // Register cleanup before touching the database so a connection failure does not
  // leave the pool open and hang the test process.
  t.after(async () => {
    try {
      await pool.query('DELETE FROM tickets WHERE title LIKE $1', [`${marker}%`]);
    } finally {
      await pool.end();
    }
  });
  await pool.query('SELECT 1');

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

  await t.test('POST /tickets rejects invalid status and priority values', async () => {
    const invalidStatus = await request(app).post('/tickets').send({
      title: `${marker}invalid status`,
      status: 'waiting'
    });
    assert.equal(invalidStatus.status, 400);

    const invalidPriority = await request(app).post('/tickets').send({
      title: `${marker}invalid priority`,
      priority: 'urgent'
    });
    assert.equal(invalidPriority.status, 400);
  });

  await t.test('PATCH /tickets/:id returns 404 for a missing ticket', async () => {
    const response = await request(app).patch('/tickets/2147483647')
      .send({ status: 'closed' });
    assert.equal(response.status, 404);
  });

  await t.test('GET /tickets rejects invalid pagination', async () => {
    for (const query of ['page=0', 'page=abc', 'limit=0', 'limit=101']) {
      const response = await request(app).get(`/tickets?${query}`);
      assert.equal(response.status, 400, query);
    }
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
