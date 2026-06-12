const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const { generateServiceOutput } = require('../services/openaiService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const createService = asyncHandler(async (req, res) => {
  const { title, summary, category, baseAmount, deliveryMode = 'one_time', aiEnabled = false } = req.body;

  if (!title || !summary || !category || baseAmount === undefined) {
    return sendError(res, 'title, summary, category and baseAmount are required', 400);
  }

  const service = await Service.create({
    creator: req.user._id,
    title,
    summary,
    category,
    deliveryMode,
    pricing: {
      baseAmount: Number(baseAmount),
      currency: req.body.currency || 'INR',
      billingCycleDays: Number(req.body.billingCycleDays || 30)
    },
    availability: {
      active: true,
      turnaroundDays: Number(req.body.turnaroundDays || 3),
      slotsPerWeek: Number(req.body.slotsPerWeek || 5)
    },
    aiConfig: {
      enabled: Boolean(aiEnabled),
      promptTemplate: req.body.promptTemplate || ''
    }
  });

  return sendSuccess(res, { service }, 'Service created', 201);
});

const listServices = asyncHandler(async (req, res) => {
  const query = { 'availability.active': true };
  if (req.query.category) {
    query.category = req.query.category;
  }

  const services = await Service.find(query)
    .populate('creator', 'fullName username')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendSuccess(res, { services, count: services.length }, 'Services fetched');
});

const getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.serviceId).populate('creator', 'fullName username');
  if (!service) {
    return sendError(res, 'Service not found', 404);
  }

  return sendSuccess(res, { service }, 'Service fetched');
});

const requestService = asyncHandler(async (req, res) => {
  const { requirements } = req.body;
  const service = await Service.findById(req.params.serviceId);

  if (!service) {
    return sendError(res, 'Service not found', 404);
  }

  let aiOutput = '';
  if (service.aiConfig.enabled && (process.env.ENABLE_AI_SERVICES || 'true') === 'true') {
    aiOutput = await generateServiceOutput({
      systemPrompt: service.aiConfig.promptTemplate || 'You are a helpful AI project assistant.',
      userPrompt: requirements || 'Please help me get started.'
    });
  }

  service.metrics.totalRequests += 1;
  await service.save();

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: service.creator,
    service: service._id,
    transactionType: 'service',
    paymentGateway: 'manual',
    amount: service.pricing.baseAmount,
    currency: service.pricing.currency,
    status: 'pending',
    metadata: {
      requirements,
      aiOutput
    }
  });

  return sendSuccess(
    res,
    {
      requestId: transaction._id,
      estimatedCost: service.pricing.baseAmount,
      aiOutput
    },
    'Service request created',
    201
  );
});

module.exports = {
  createService,
  listServices,
  getServiceById,
  requestService
};
