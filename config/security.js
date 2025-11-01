const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// API Security Config
const apiSecurity = {
  // CORS Options
  corsOptions: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Helmet Configuration (Security Headers)
  helmetOptions: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.example.com"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }
};

// Safe XSS Middleware Wrapper
const safeXSS = (req, res, next) => {
  if (req.originalUrl.includes('/upload-image') || req.originalUrl.includes('/certificates')) {
    return next();
  }

  try {
    if (req.body) {
      for (let key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = xss(req.body[key]);
        }
      }
    }
    next();
  } catch (err) {
    console.warn("XSS Sanitization Skipped due to error:", err.message);
    next();
  }
};


// Configure Security Middleware
const configureSecurityMiddleware = (app) => {
  // Basic Security Headers
  app.use(helmet(apiSecurity.helmetOptions));

  // CORS
  app.use(cors(apiSecurity.corsOptions));

  // Rate Limiting
  app.use('/api', limiter);



  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Additional Security Headers
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    next();
  });
};

module.exports = {
  configureSecurityMiddleware,
  apiSecurity,
  limiter
};