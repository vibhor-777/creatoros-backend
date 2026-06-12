const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');

// Load environment variables immediately at the entry phase
dotenv.config();

const app = express();

// Initialize Database Connection with safety traps
connectDB();

// --- GLOBAL PRODUCTION MIDDLEWARES ---
app.use(helmet()); // Secures HTTP headers to protect against web vulnerabilities
app.use(cors({
  origin: '*', // Adjust this to your frontend domain in production for tight security
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting to mitigate Denial of Service (DoS) attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// --- APPLICATION ROUTES ---
// Basic Root Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'CreatorOS API Server is running seamlessly in production mode.',
    timestamp: new Date()
  });
});

// Dynamic Route Registrations (Add your custom API endpoints below)
// Example: app.use('/api/v1/auth', require('./src/routes/authRoutes'));

// --- GLOBAL ERROR HANDLING & NOT FOUND MIDDLEWARES ---
// 404 Route Catch-all Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Requested Endpoint Not Found on this Server.' });
});

// Global Centralized Error Middleware
app.use((err, req, res, next) => {
  console.error(`Runtime Exception intercepted: ${err.message}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error encountered.',
      status: err.status || 500
    }
  });
});

// --- NETWORK BINDING & RUNTIME SERVER INITIALIZATION ---
// Hostinger uses dynamic ports passed via process.env.PORT. Fallback to 8080 for standard containers.
const PORT = process.env.PORT || 8080;

// Explicitly bind to '0.0.0.0' to ensure internal container proxy routing doesn't drop connections
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(` SERVER INITIALIZATION SUCCESSFUL                   `);
  console.log(` Running on Port: ${PORT}                          `);
  console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`===================================================`);
});

// --- PROCESS-LEVEL EXCEPTION TRAPS (Anti-Crash Layer) ---
// Handle asynchronous code failures (e.g., Unhandled Database Promises)
process.on('unhandledRejection', (err) => {
  console.error(`CRITICAL FAILURE (Unhandled Rejection): ${err.message}`);
  // Gracefully close server listener before terminating the node instance
  server.close(() => {
    process.exit(1); // Exit code 1 alerts Hostinger Process Manager to restart the worker cleanly
  });
});

// Handle synchronous code runtime exceptions (e.g., Calling an undefined variable)
process.on('uncaughtException', (err) => {
  console.error(`CRITICAL FAILURE (Uncaught Exception): ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});
