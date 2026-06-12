const mongoose = require('mongoose');
const Product = require('../models/Product');
const Bounty = require('../models/Bounty');
const Service = require('../models/Service');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendSuccess, asyncHandler } = require('../utils/responseHelper');

const healthCheck = asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const status = dbState === 1 ? 'ok' : 'degraded';

  return sendSuccess(
    res,
    {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbState === 1,
        readyState: dbState
      }
    },
    'Health check successful'
  );
});

const platformStats = asyncHandler(async (req, res) => {
  const [users, products, bounties, services, transactions] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Product.countDocuments({ isPublished: true }),
    Bounty.countDocuments({ status: 'open' }),
    Service.countDocuments({ 'availability.active': true }),
    Transaction.countDocuments({ status: 'paid' })
  ]);

  return sendSuccess(res, {
    users,
    products,
    openBounties: bounties,
    activeServices: services,
    successfulTransactions: transactions
  });
});

module.exports = {
  healthCheck,
  platformStats
};
