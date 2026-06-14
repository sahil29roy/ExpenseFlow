const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const logger = require('./utils/logger');
const { initializeDatabase, pool } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const groupRoutes = require('./routes/groupRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const csvImportRoutes = require('./routes/csvImportRoutes');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/errors');
require('dotenv').config();

const app = express();

// 1. SECURITY HEADERS & CORS
app.use(helmet());

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// 2. RATE LIMITING
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply global limiter to API paths
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Limit each IP to 10 registration/login requests per 15 minutes
  message: {
    status: 'fail',
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);

const csvImportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit each IP to 5 CSV imports per 15 minutes
  message: {
    status: 'fail',
    message: 'Too many CSV import requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/expenses/import', csvImportLimiter);

// 3. LOGGING MIDDLEWARE (MORGAN ROUTED TO WINSTON)
const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

app.use(express.json());

// 4. API SWAGGER INTERACTIVE DOCUMENTATION
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 5. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expenses', csvImportRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Expense Sharing System API is healthy.',
    timestamp: new Date().toISOString(),
  });
});

// 6. UNHANDLED ROUTES
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// 7. CENTRALIZED ERROR HANDLING MIDDLEWARE
app.use(errorHandler);

// 8. START SERVER WITH DB CONNECTION CHECK
const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  try {
    logger.info('Testing PostgreSQL database connection...');
    await initializeDatabase();
    
    server = app.listen(PORT, () => {
      logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`Swagger interactive API documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Fatal: Server failed to start due to database connection error.', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown handlers
const gracefulShutdown = (signal, err) => {
  logger.error(`${signal} received! Shutting down gracefully...`, err);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      pool.end().then(() => {
        logger.info('Database connection pool terminated.');
        process.exit(1);
      });
    });
  } else {
    pool.end().then(() => {
      logger.info('Database connection pool terminated.');
      process.exit(1);
    });
  }
};

process.on('uncaughtException', (err) => gracefulShutdown('UNCAUGHT_EXCEPTION', err));
process.on('unhandledRejection', (err) => gracefulShutdown('UNHANDLED_REJECTION', err));
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      pool.end().then(() => {
        logger.info('Database connection pool terminated.');
        process.exit(0);
      });
    });
  } else {
    pool.end().then(() => {
      process.exit(0);
    });
  }
});
