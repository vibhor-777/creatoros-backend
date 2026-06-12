const request = require('supertest');
const express = require('express');
const healthRoutes = require('../src/routes/healthRoutes');

describe('health routes', () => {
  test('GET /api/v1/health returns success response', async () => {
    const app = express();
    app.use('/api/v1/health', healthRoutes);

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('status');
  });
});
