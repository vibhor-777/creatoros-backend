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

app.use(helmet());
app.use(cors({
  origin: [
    'https://studio-z.in',
    'https://www.studio-z.in',
    'https://green-eel-423839.hostingersite.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);
console.log("[TELEMETRY 04] Global middleware configured.");

app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'CreatorOS API Server is running.' });
});

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
