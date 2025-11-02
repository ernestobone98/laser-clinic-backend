require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('./middleware/auth');

// Routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const procedureRoutes = require('./routes/procedures');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Logging
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON requests
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/api', authRoutes);
// Temporarily remove authentication for development
app.use('/api/pacientes', patientRoutes);
app.use('/api/proceduras', procedureRoutes);
app.use('/api/zonas', procedureRoutes); // zonas is in procedures

module.exports = app;