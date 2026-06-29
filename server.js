console.log("[TELEMETRY 01] Boot sequence initiated.");

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
console.log("[TELEMETRY 02] Core NPM dependencies loaded.");

const connectDB = require('./src/config/database');
console.log("[TELEMETRY 03] Database configuration loaded.");

dotenv.config();
const app = express();
app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://use.fontawesome.com"],
      imgSrc: ["'self'", "data:", "https:"],
      childSrc: ["'self'", "https://checkout.razorpay.com"],
      frameSrc: ["'self'", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://api.studio-z.in", "http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5500", "http://127.0.0.1:5500"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://use.fontawesome.com"]
    }
  }
}));
const allowedOrigins = [
  'https://studio-z.in',
  'https://www.studio-z.in',
  'https://admin.studio-z.in',
  'https://www.admin.studio-z.in',
  'https://green-eel-423839.hostingersite.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow local files (null origin) and dev hosts in development/testing
    if (!origin || allowedOrigins.includes(origin) || origin === 'null') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
const { checkIpBlock } = require('./src/middleware/ipBlock');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(checkIpBlock);
app.use('/uploads', (req, res, next) => {
  // Ensure images and videos are served inline (not as downloads)
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.removeHeader('Content-Disposition');
  next();
}, express.static('uploads'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);
console.log("[TELEMETRY 04] Global middleware configured.");

app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'CreatorOS API Server is running.' });
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many accounts created from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/register', registerLimiter);

// --- TELEMETRY TRAP: MODULE RESOLUTION ---
console.log("[TELEMETRY 05] Attempting dynamic route registrations...");
try {
  app.use('/api/v1/auth', require('./src/routes/authRoutes'));
  app.use('/api/v1/users', require('./src/routes/userRoutes'));
  app.use('/api/v1/products', require('./src/routes/productRoutes'));
  app.use('/api/v1/transactions', require('./src/routes/transactionRoutes'));
  app.use('/api/v1/bounties', require('./src/routes/bountyRoutes'));
  app.use('/api/v1/wallet', require('./src/routes/walletRoutes'));
  app.use('/api/v1/services', require('./src/routes/serviceRoutes'));
  app.use('/api/v1/health', require('./src/routes/healthRoutes'));
  app.use('/api/v1/ai', require('./src/routes/aiRoutes'));
  app.use('/api/v1/upload', require('./src/routes/uploadRoutes'));
  app.use('/api/v1/chat', require('./src/routes/chatRoutes'));
  app.use('/api/v1/suggestions', require('./src/routes/suggestionRoutes'));
  app.use('/api/v1/stats', require('./src/routes/statsRoutes'));
  app.use('/api/v1/financial-aid', require('./src/routes/financialAidRoutes'));
  console.log("[TELEMETRY 06] All dynamic routes successfully mounted.");
} catch (routeError) {
  console.error("=================================================");
  console.error("[CRITICAL TRAP] MODULE RESOLUTION FAILED!");
  console.error(routeError);
  console.error("=================================================");
  process.exit(1); // Force exit so Hostinger logs the error above
}

app.use((req, res, next) => {
  res.status(404).json({ error: 'Requested Endpoint Not Found.' });
});

app.use((err, req, res, next) => {
  console.error(`Runtime Exception intercepted: ${err.message}`);
  res.status(err.status || 500).json({ error: { message: err.message || 'Internal Server Error', status: err.status || 500 }});
});

const PORT = process.env.PORT || 8080;
let server; // Declared outside so error handlers can safely check its existence

try {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TELEMETRY 07] SERVER ACTIVE ON PORT ${PORT}`);
    console.log(`[TELEMETRY 08] INITIATING MONGODB CONNECTION`);
    connectDB();
  });
} catch (listenError) {
  console.error("[CRITICAL TRAP] PORT BINDING FAILED!", listenError);
  process.exit(1);
}

// --- FIXED PROCESS TRAPS ---
process.on('unhandledRejection', (err) => {
  console.error(`[FATAL UNHANDLED REJECTION]:`, err);
  if (server) server.close();
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(`[FATAL UNCAUGHT EXCEPTION]:`, err);
  if (server) server.close();
  process.exit(1);
});
