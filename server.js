const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { connectDatabase } = require('./src/config/database');
const { sendError } = require('./src/utils/responseHelper');

dotenv.config();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

app.use('/api/', limiter);

app.use('/api/v1/auth', require('./src/routes/authRoutes'));
app.use('/api/v1/users', require('./src/routes/userRoutes'));
app.use('/api/v1/products', require('./src/routes/productRoutes'));
app.use('/api/v1/transactions', require('./src/routes/transactionRoutes'));
app.use('/api/v1/bounties', require('./src/routes/bountyRoutes'));
app.use('/api/v1/wallet', require('./src/routes/walletRoutes'));
app.use('/api/v1/services', require('./src/routes/serviceRoutes'));
app.use('/api/v1/health', require('./src/routes/healthRoutes'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CreatorOS backend is running',
    version: 'v1'
  });
});

app.use((req, res) => {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === 'ValidationError') {
    return sendError(res, 'Validation failed', 400, error.errors);
  }

  if (error.name === 'CastError') {
    return sendError(res, 'Invalid resource identifier', 400);
  }

  if (error.code === 11000) {
    return sendError(res, 'Duplicate value violates unique constraint', 409, error.keyValue);
  }

  if (error.name === 'MulterError') {
    return sendError(res, error.message, 400);
  }

  if (error.message === 'Unsupported file type') {
    return sendError(res, error.message, 400);
  }

  const statusCode = Number(error.statusCode || error.status || 500);
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  return sendError(res, message, statusCode);
});

const startServer = async () => {
  try {
    await connectDatabase();

    const port = Number(process.env.PORT || 4000);
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`CreatorOS backend listening on port ${port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
