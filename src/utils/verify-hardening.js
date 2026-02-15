import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database.js';
import { initializeChroma } from '../config/chroma.js';
import Lead from '../models/Lead.js';
import ragService from '../services/rag.service.js';
import { logger } from './logger.js';

/**
 * Verification script to test hardening fixes
 */
async function verifyHardening() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    logger.info('Starting hardening verification...\n');

    // Test 1: MongoDB Connection
    logger.info('Test 1: MongoDB Connection');
    try {
      await connectDB();
      await Lead.findOne().limit(1);
      results.passed.push('MongoDB connection and query');
      logger.info('✓ MongoDB connected\n');
    } catch (error) {
      results.failed.push(`MongoDB: ${error.message}`);
      logger.error(`✗ MongoDB failed: ${error.message}\n`);
    }

    // Test 2: Phone Unique Index
    logger.info('Test 2: Phone Unique Index');
    try {
      const indexes = await Lead.collection.getIndexes();
      const hasPhoneIndex = Object.keys(indexes).some(key => key.includes('phone'));
      if (hasPhoneIndex) {
        results.passed.push('Phone unique index exists');
        logger.info('✓ Phone unique index found\n');
      } else {
        results.warnings.push('Phone unique index not found - run migration script');
        logger.warn('⚠ Phone unique index not found\n');
      }
    } catch (error) {
      results.failed.push(`Index check: ${error.message}`);
      logger.error(`✗ Index check failed: ${error.message}\n`);
    }

    // Test 3: ChromaDB Connection
    logger.info('Test 3: ChromaDB Connection');
    try {
      await initializeChroma();
      await ragService.initializeCollection();
      const stats = await ragService.getCollectionStats();
      results.passed.push(`ChromaDB connected (${stats.documentCount} documents)`);
      logger.info(`✓ ChromaDB connected with ${stats.documentCount} documents\n`);
    } catch (error) {
      results.warnings.push(`ChromaDB: ${error.message}`);
      logger.warn(`⚠ ChromaDB warning: ${error.message}\n`);
    }

    // Test 4: RAG Service Architecture
    logger.info('Test 4: RAG Service Architecture');
    try {
      // Check that vectorStore is not used
      const hasVectorStore = ragService.hasOwnProperty('vectorStore');
      if (!hasVectorStore) {
        results.passed.push('RAG service uses native embeddings (no vectorStore)');
        logger.info('✓ RAG architecture cleaned (native embeddings)\n');
      } else {
        results.warnings.push('vectorStore property still exists');
        logger.warn('⚠ vectorStore property found\n');
      }
    } catch (error) {
      results.failed.push(`RAG check: ${error.message}`);
      logger.error(`✗ RAG check failed: ${error.message}\n`);
    }

    // Test 5: Lead Status Enum
    logger.info('Test 5: Lead Status Enum');
    try {
      const schema = Lead.schema.path('status');
      const enumValues = schema.enumValues;
      const requiredStatuses = ['pending', 'calling', 'completed', 'failed', 'no_answer'];
      const hasAllStatuses = requiredStatuses.every(status => enumValues.includes(status));
      
      if (hasAllStatuses) {
        results.passed.push('Lead status enum includes all required states');
        logger.info('✓ Status enum complete\n');
      } else {
        results.failed.push('Lead status enum missing required states');
        logger.error('✗ Status enum incomplete\n');
      }
    } catch (error) {
      results.failed.push(`Status enum check: ${error.message}`);
      logger.error(`✗ Status enum check failed: ${error.message}\n`);
    }

    // Test 6: Transcript Schema
    logger.info('Test 6: Transcript Schema');
    try {
      const transcriptSchema = Lead.schema.path('transcript');
      const hasTimestamp = transcriptSchema.schema.path('timestamp') !== undefined;
      
      if (hasTimestamp) {
        results.passed.push('Transcript includes timestamp field');
        logger.info('✓ Transcript schema correct\n');
      } else {
        results.failed.push('Transcript missing timestamp field');
        logger.error('✗ Transcript schema incomplete\n');
      }
    } catch (error) {
      results.failed.push(`Transcript schema check: ${error.message}`);
      logger.error(`✗ Transcript schema check failed: ${error.message}\n`);
    }

    // Summary
    logger.info('='.repeat(60));
    logger.info('VERIFICATION SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`Passed: ${results.passed.length}`);
    results.passed.forEach(item => logger.info(`  ✓ ${item}`));
    
    if (results.warnings.length > 0) {
      logger.info(`\nWarnings: ${results.warnings.length}`);
      results.warnings.forEach(item => logger.warn(`  ⚠ ${item}`));
    }
    
    if (results.failed.length > 0) {
      logger.info(`\nFailed: ${results.failed.length}`);
      results.failed.forEach(item => logger.error(`  ✗ ${item}`));
    }
    
    logger.info('='.repeat(60));

    if (results.failed.length === 0) {
      logger.info('\n✓ All critical tests passed!');
      if (results.warnings.length > 0) {
        logger.info('⚠ Some warnings present - review above');
      }
      process.exit(0);
    } else {
      logger.error('\n✗ Some tests failed - review above');
      process.exit(1);
    }

  } catch (error) {
    logger.error(`Verification failed: ${error.message}`);
    process.exit(1);
  }
}

verifyHardening();
