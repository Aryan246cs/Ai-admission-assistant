import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database.js';
import Lead from '../models/Lead.js';
import { logger } from './logger.js';

/**
 * Migration script to add unique index on phone field
 * Run this once if you have existing data
 */
async function migratePhoneIndex() {
  try {
    await connectDB();
    
    logger.info('Starting phone index migration...');
    
    // Check for duplicate phone numbers before creating index
    const duplicates = await Lead.aggregate([
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicates.length > 0) {
      logger.warn(`Found ${duplicates.length} duplicate phone numbers:`);
      duplicates.forEach(dup => {
        logger.warn(`  Phone: ${dup._id} (${dup.count} occurrences)`);
      });
      logger.warn('Please resolve duplicates before running this migration');
      process.exit(1);
    }

    // Create unique index on phone
    await Lead.collection.createIndex({ phone: 1 }, { unique: true });
    logger.info('✓ Unique index created on phone field');
    
    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

migratePhoneIndex();
