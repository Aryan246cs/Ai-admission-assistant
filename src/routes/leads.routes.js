import express from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import fs from 'fs';
import Lead from '../models/Lead.js';
import conversationService from '../services/conversation.service.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { AppError } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload leads from CSV
router.post('/upload-leads', upload.single('file'), asyncWrapper(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const leads = [];
  const filePath = req.file.path;

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (row.name && row.phone && row.email) {
          leads.push({
            name: row.name.trim(),
            phone: row.phone.trim(),
            email: row.email.trim().toLowerCase(),
            status: 'pending'
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Clean up uploaded file
  fs.unlinkSync(filePath);

  if (leads.length === 0) {
    throw new AppError('No valid leads found in CSV', 400);
  }

  // Insert leads (skip duplicates)
  let insertedCount = 0;
  let skippedCount = 0;
  const duplicateReasons = [];

  for (const leadData of leads) {
    try {
      await Lead.create(leadData);
      insertedCount++;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - determine which field
        const duplicateField = error.message.includes('email') ? 'email' : 
                              error.message.includes('phone') ? 'phone' : 'unknown';
        duplicateReasons.push({
          name: leadData.name,
          field: duplicateField,
          value: duplicateField === 'email' ? leadData.email : leadData.phone
        });
        skippedCount++;
        logger.debug(`Duplicate lead skipped: ${leadData.name} (${duplicateField}: ${leadData[duplicateField]})`);
      } else {
        logger.error(`Failed to insert lead ${leadData.name}: ${error.message}`);
      }
    }
  }

  logger.info(`CSV Upload: ${insertedCount} inserted, ${skippedCount} skipped`);

  res.status(201).json({
    success: true,
    message: 'Leads uploaded successfully',
    data: {
      total: leads.length,
      inserted: insertedCount,
      skipped: skippedCount,
      duplicates: duplicateReasons.length > 0 ? duplicateReasons : undefined
    }
  });
}));

// Manual chat test
router.post('/chat-test', asyncWrapper(async (req, res) => {
  const { leadId, message } = req.body;

  if (!leadId || !message) {
    throw new AppError('leadId and message are required', 400);
  }

  const result = await conversationService.processMessage(leadId, message);

  res.json({
    success: true,
    data: result
  });
}));

// Get lead details
router.get('/leads/:id', asyncWrapper(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  res.json({
    success: true,
    data: lead
  });
}));

// Get all leads with pagination
router.get('/leads', asyncWrapper(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;

  const query = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [leads, total] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

export default router;
