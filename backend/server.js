const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const groupRoutes = require('./routes/groupRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/errors');
require('dotenv').config();

const app = express();

// 1. GLOBAL MIDDLEWARES
app.use(cors());
app.use(express.json());

// 2. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
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

// 3. UNHANDLED ROUTES
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// 4. CENTRALIZED ERROR HANDLING MIDDLEWARE
app.use(errorHandler);

// 5. START SERVER WITH DB CONNECTION CHECK
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Perform database connection and schema check
    console.log('Testing PostgreSQL database connection...');
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal: Server failed to start due to database connection error.');
    process.exit(1);
  }
};

startServer();
