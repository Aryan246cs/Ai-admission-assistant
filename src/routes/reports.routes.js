import express from 'express';
import Lead from '../models/Lead.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Export campaign report as CSV
router.get('/export-report', asyncWrapper(async (req, res) => {
  const leads = await Lead.find({}).select(
    'name phone status interest_score course_interest summary'
  ).lean();

  // Generate CSV
  const csvHeader = 'name,phone,status,interest_score,course_interest,summary\n';
  const csvRows = leads.map(lead => {
    const summary = (lead.summary || '').replace(/,/g, ';').replace(/\n/g, ' ');
    return `"${lead.name}","${lead.phone}","${lead.status}",${lead.interest_score},"${lead.course_interest || ''}","${summary}"`;
  }).join('\n');

  const csv = csvHeader + csvRows;

  logger.info(`Exported report with ${leads.length} leads`);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="campaign-report-${Date.now()}.csv"`);
  res.send(csv);
}));

// Get campaign statistics
router.get('/stats', asyncWrapper(async (req, res) => {
  const [
    totalLeads,
    statusCounts,
    avgInterestScore,
    topCourses
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $group: { _id: null, avg: { $avg: '$interest_score' } } }
    ]),
    Lead.aggregate([
      { $match: { course_interest: { $ne: '' } } },
      { $group: { _id: '$course_interest', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  const statusMap = {};
  statusCounts.forEach(item => {
    statusMap[item._id] = item.count;
  });

  res.json({
    success: true,
    data: {
      totalLeads,
      statusBreakdown: statusMap,
      averageInterestScore: avgInterestScore[0]?.avg || 0,
      topCourses: topCourses.map(c => ({ course: c._id, count: c.count }))
    }
  });
}));

export default router;
