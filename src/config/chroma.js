import { ChromaClient } from 'chromadb';
import { logger } from '../utils/logger.js';

let chromaClient = null;

export const initializeChroma = async () => {
  try {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
    
    await chromaClient.heartbeat();
    logger.info('ChromaDB connected successfully');
    return chromaClient;
  } catch (error) {
    logger.error(`ChromaDB Connection Error: ${error.message}`);
    throw error;
  }
};

export const getChromaClient = () => {
  if (!chromaClient) {
    throw new Error('ChromaDB not initialized. Call initializeChroma() first.');
  }
  return chromaClient;
};
