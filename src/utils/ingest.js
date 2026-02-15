import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import ragService from '../services/rag.service.js';
import { initializeChroma } from '../config/chroma.js';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DocumentIngestion {
  constructor() {
    this.chunkSize = 1000;
    this.chunkOverlap = 200;
  }

  async loadPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      logger.error(`Failed to load PDF: ${error.message}`);
      throw error;
    }
  }

  loadTextFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to load text file: ${error.message}`);
      throw error;
    }
  }

  chunkText(text, metadata = {}) {
    const chunks = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += this.chunkSize - this.chunkOverlap) {
      const chunk = words.slice(i, i + this.chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push({
          pageContent: chunk,
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            source: metadata.source || 'unknown'
          }
        });
      }
    }

    return chunks;
  }

  async ingestDocuments(documentsPath) {
    try {
      // Initialize ChromaDB
      await initializeChroma();
      await ragService.initializeCollection();

      const files = fs.readdirSync(documentsPath);
      let totalChunks = 0;

      for (const file of files) {
        const filePath = path.join(documentsPath, file);
        const ext = path.extname(file).toLowerCase();

        logger.info(`Processing: ${file}`);

        let text = '';
        
        if (ext === '.pdf') {
          text = await this.loadPDF(filePath);
        } else if (ext === '.txt' || ext === '.md') {
          text = this.loadTextFile(filePath);
        } else {
          logger.warn(`Skipping unsupported file type: ${file}`);
          continue;
        }

        const chunks = this.chunkText(text, {
          source: file,
          fileType: ext
        });

        await ragService.addDocuments(chunks);
        totalChunks += chunks.length;

        logger.info(`✓ Processed ${file}: ${chunks.length} chunks`);
      }

      const stats = await ragService.getCollectionStats();
      logger.info(`\n✓ Ingestion complete!`);
      logger.info(`Total chunks added: ${totalChunks}`);
      logger.info(`Collection stats: ${JSON.stringify(stats)}`);

    } catch (error) {
      logger.error(`Ingestion failed: ${error.message}`);
      throw error;
    }
  }
}

// CLI execution
const ingestion = new DocumentIngestion();
const docsPath = process.argv[2] || path.join(process.cwd(), 'documents');

if (!fs.existsSync(docsPath)) {
  logger.error(`Documents directory not found: ${docsPath}`);
  logger.info('Usage: node src/utils/ingest.js [documents_path]');
  process.exit(1);
}

logger.info(`Starting document ingestion from: ${docsPath}`);
ingestion.ingestDocuments(docsPath)
  .then(() => {
    logger.info('Ingestion completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Ingestion failed: ${error.message}`);
    process.exit(1);
  });
