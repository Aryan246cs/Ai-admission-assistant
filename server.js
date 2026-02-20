import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { connectDB } from './src/config/database.js';
import { initializeChroma } from './src/config/chroma.js';
import callWorker from './src/workers/call.worker.js';
import { logger } from './src/utils/logger.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB (non-blocking)
    connectDB().catch(err => {
      logger.error('MongoDB connection failed, but server will continue');
    });

    // Initialize ChromaDB
    try {
      await initializeChroma();
    } catch (error) {
      logger.warn('ChromaDB connection failed - RAG features will be limited');
      logger.warn('Make sure ChromaDB is running: docker run -p 8000:8000 chromadb/chroma');
    }

    // Start call worker
    callWorker.start();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
