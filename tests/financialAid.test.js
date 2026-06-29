const request = require('supertest');
const express = require('express');

// Mock mongoose models
jest.mock('../src/models/User', () => {
  return {
    findById: jest.fn().mockResolvedValue({
      _id: 'user123',
      fullName: 'John Doe',
      financialAidStatus: 'none',
      save: jest.fn().mockResolvedValue(true)
    })
  };
});

jest.mock('../src/models/FinancialAid', () => {
  const mockSave = jest.fn().mockResolvedValue(true);
  const mockModel = jest.fn().mockImplementation(() => {
    return {
      _id: 'aid123',
      user: 'user123',
      fullName: 'John Doe',
      monthlyIncome: 500,
      howHelpful: 'How helpful content...',
      whyAfford: 'Why afford content...',
      status: 'applied',
      save: mockSave
    };
  });
  
  mockModel.countDocuments = jest.fn().mockResolvedValue(0);
  mockModel.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([])
    })
  });
  
  return mockModel;
});

// Mock email service
jest.mock('../src/services/emailService', () => {
  return {
    notifyAdminNewFinancialAid: jest.fn().mockResolvedValue(true),
    notifyUserFinancialAidResult: jest.fn().mockResolvedValue(true)
  };
});

// Mock auth middleware
jest.mock('../src/middleware/auth', () => {
  return {
    auth: (req, res, next) => {
      req.user = { _id: 'user123', role: 'admin' };
      next();
    },
    authorize: (...roles) => (req, res, next) => next()
  };
});

const financialAidRoutes = require('../src/routes/financialAidRoutes');

describe('Financial Aid Routes', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/financial-aid', financialAidRoutes);
  });

  test('POST /api/v1/financial-aid/apply submits application successfully', async () => {
    const res = await request(app)
      .post('/api/v1/financial-aid/apply')
      .send({
        fullName: 'John Doe',
        monthlyIncome: 500,
        howHelpful: 'This will help me access notes for study '.repeat(5),
        whyAfford: 'I am a student with no background income '.repeat(5)
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('submitted successfully');
  });

  test('GET /api/v1/financial-aid/pending lists applications', async () => {
    const res = await request(app).get('/api/v1/financial-aid/pending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
