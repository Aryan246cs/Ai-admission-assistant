import cron from 'node-cron';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';

class CallWorker {
  constructor() {
    this.isRunning = false;
  }

  start() {
    // Run every 1 minute
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        logger.debug('Call worker already running, skipping...');
        return;
      }

      this.isRunning = true;
      
      try {
        await this.processCallQueue();
      } catch (error) {
        logger.error(`Call worker execution failed: ${error.message}`);
      } finally {
        // Always reset flag to prevent permanent lock
        this.isRunning = false;
      }
    });

    logger.info('Call worker started - running every 1 minute');
  }

  async processCallQueue() {
    try {
      // Fetch 5 pending leads
      const leads = await Lead.find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(5);

      if (leads.length === 0) {
        logger.debug('No pending leads in queue');
        return;
      }

      logger.info(`Processing ${leads.length} leads from call queue`);

      for (const lead of leads) {
        try {
          // Update status to calling and increment attempts
          lead.status = 'calling';
          lead.attempts += 1;
          await lead.save();

          logger.info(`Simulated call initiated for lead: ${lead.name} (${lead.email}) - Attempt ${lead.attempts}`);

          // Simulate call outcome
          // TODO: Replace with actual Vapi/Twilio integration
          const outcome = await this.simulateCallOutcome(lead);

          // Update lead based on outcome
          if (outcome === 'completed') {
            lead.status = 'completed';
          } else if (outcome === 'no_answer') {
            // Check if max attempts reached
            if (lead.attempts >= 3) {
              lead.status = 'failed';
              logger.warn(`Lead ${lead.name} marked as failed after ${lead.attempts} attempts`);
            } else {
              lead.status = 'pending'; // Retry later
            }
          } else if (outcome === 'failed') {
            lead.status = 'failed';
          }

          await lead.save();
          logger.info(`Call outcome for ${lead.name}: ${outcome} (status: ${lead.status})`);
          
        } catch (error) {
          logger.error(`Failed to process lead ${lead._id}: ${error.message}`);
          
          // Mark lead as failed if processing error occurs
          try {
            lead.status = 'failed';
            await lead.save();
          } catch (saveError) {
            logger.error(`Failed to update lead status: ${saveError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Call worker error: ${error.message}`);
    }
  }

  /**
   * Simulates call outcome for testing
   * TODO: Replace with actual voice API integration (Vapi/Twilio)
   * 
   * @returns {string} 'completed', 'no_answer', or 'failed'
   */
  async simulateCallOutcome(lead) {
    // Simulate random outcomes for testing
    // In production, this would be determined by actual call result
    const outcomes = ['completed', 'no_answer', 'no_answer', 'completed'];
    const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    // Simulate call duration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return randomOutcome;
  }

  // Manual trigger for testing
  async triggerManually() {
    logger.info('Manual call queue trigger');
    await this.processCallQueue();
  }
}

export default new CallWorker();
