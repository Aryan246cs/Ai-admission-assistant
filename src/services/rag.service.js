import { getChromaClient } from '../config/chroma.js';
import { logger } from '../utils/logger.js';

/**
 * RAG Service using ChromaDB native embeddings
 * 
 * EMBEDDING STRATEGY:
 * - Uses ChromaDB's default embedding function (all-MiniLM-L6-v2)
 * - Embeddings are generated server-side by ChromaDB
 * - Same embedding function used for both ingestion and query
 * - No external embedding API required (OpenAI/Groq)
 * - Ensures dimension consistency automatically
 */
class RAGService {
  constructor() {
    this.collectionName = process.env.CHROMA_COLLECTION || 'bml_admissions';
    this.collection = null;
  }

  async initializeCollection() {
    try {
      const client = getChromaClient();
      
      // Get or create collection with ChromaDB native embeddings
      try {
        this.collection = await client.getOrCreateCollection({
          name: this.collectionName,
          metadata: { 'hnsw:space': 'cosine' }
        });
        logger.info(`ChromaDB collection '${this.collectionName}' initialized with native embeddings`);
      } catch (error) {
        logger.error(`Failed to initialize collection: ${error.message}`);
        throw error;
      }

      return this.collection;
    } catch (error) {
      logger.error(`RAG Service Initialization Error: ${error.message}`);
      throw error;
    }
  }

  async addDocuments(documents) {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }

      const ids = documents.map((_, idx) => `doc_${Date.now()}_${idx}`);
      const texts = documents.map(doc => doc.pageContent || doc.text);
      const metadatas = documents.map(doc => doc.metadata || {});

      await this.collection.add({
        ids,
        documents: texts,
        metadatas
      });

      logger.info(`Added ${documents.length} documents to ChromaDB`);
      return { success: true, count: documents.length };
    } catch (error) {
      logger.error(`Add Documents Error: ${error.message}`);
      throw error;
    }
  }

  async retrieveContext(query, topK = 3, filter = {}) {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }

      const queryParams = {
        queryTexts: [query],
        nResults: topK
      };

      if (Object.keys(filter).length > 0) {
        queryParams.where = filter;
      }

      const results = await this.collection.query(queryParams);
      
      if (!results.documents || results.documents.length === 0) {
        return 'No relevant information found in knowledge base.';
      }

      // Combine retrieved documents
      const context = results.documents[0]
        .map((doc, idx) => `[Source ${idx + 1}]: ${doc}`)
        .join('\n\n');

      return context;
    } catch (error) {
      logger.error(`Retrieve Context Error: ${error.message}`);
      return 'Unable to retrieve context from knowledge base.';
    }
  }

  async getCollectionStats() {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }

      const count = await this.collection.count();
      return { collectionName: this.collectionName, documentCount: count };
    } catch (error) {
      logger.error(`Get Stats Error: ${error.message}`);
      return { collectionName: this.collectionName, documentCount: 0 };
    }
  }
}

export default new RAGService();
