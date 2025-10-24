require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { configureSecurityMiddleware } = require('./config/security');

// Initialize express app
const app = express();

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply security middleware
configureSecurityMiddleware(app);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abhyaasi')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error(' MongoDB connection error:', err);
    process.exit(1);
  });



// API Routes (to be added)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(' Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // JWT Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});




const userRoutes = require('./routes/user.route')
const CourseRoutes = require('./routes/course.route')
const ModuleRoutes = require('./routes/module.route')
const ProgressRoutes = require('./routes/progress.route')
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/courses', CourseRoutes)
app.use('/api/v1/modules', ModuleRoutes);
app.use('/api/v1/progress', ProgressRoutes);



// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error(' UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err);
  process.exit(1);
});
