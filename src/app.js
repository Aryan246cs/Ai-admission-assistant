import express from 'express';
import mongoose from 'mongoose';
import leadsRoutes from './routes/leads.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import vapiWebhookRoutes from './routes/vapiWebhook.js';
import ragService from './services/rag.service.js';
import { ChatGroq } from '@langchain/groq';
import { errorHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Voice Admission Campaign System is running',
    timestamp: new Date().toISOString()
  });
});

// Detailed health check with dependency status
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: { status: 'unknown', message: '' },
      chromadb: { status: 'unknown', message: '' },
      groq: { status: 'unknown', message: '' }
    }
  };

  // Check MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.dependencies.mongodb = { status: 'connected', message: 'MongoDB is accessible' };
    } else {
      health.dependencies.mongodb = { status: 'disconnected', message: 'MongoDB not connected' };
      health.status = 'degraded';
    }
  } catch (error) {
    health.dependencies.mongodb = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  // Check ChromaDB
  try {
    const stats = await ragService.getCollectionStats();
    health.dependencies.chromadb = { 
      status: 'connected', 
      message: `Collection accessible with ${stats.documentCount} documents` 
    };
  } catch (error) {
    health.dependencies.chromadb = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  // Check Groq API
  try {
    if (!process.env.GROQ_API_KEY) {
      health.dependencies.groq = { status: 'error', message: 'GROQ_API_KEY not configured' };
      health.status = 'degraded';
    } else {
      const testModel = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        temperature: 0
      });
      
      // Simple test invocation with timeout
      const testPromise = testModel.invoke([{ role: 'user', content: 'ping' }]);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      await Promise.race([testPromise, timeoutPromise]);
      health.dependencies.groq = { status: 'connected', message: 'Groq API is reachable' };
    }
  } catch (error) {
    health.dependencies.groq = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json({
    success: health.status === 'healthy',
    data: health
  });
});

// Routes
app.use('/api', vapiWebhookRoutes);
app.use('/api', leadsRoutes);
app.use('/api', reportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
