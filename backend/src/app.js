import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import draftRoutes from './routes/draftRoutes.js';
import roomRoutes from './routes/roomRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded audio static directory
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health & Readiness check (Section D1 Requirement)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Roxstar Voice Draft & Room Backend'
  });
});

// API Routes
app.use('/api/drafts', draftRoutes);
app.use('/api/rooms', roomRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

export default app;
