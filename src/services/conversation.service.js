import llmService from './llm.service.js';
import ragService from './rag.service.js';
import Lead from '../models/Lead.js';
import CallLog from '../models/CallLog.js';
import { logger } from '../utils/logger.js';

class ConversationService {
  async processMessage(leadId, userMessage) {
    try {
      // Fetch lead with current transcript
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Retrieve context from ChromaDB
      const retrievedContext = await ragService.retrieveContext(userMessage);

      // Generate AI response using current transcript + new message
      const conversationHistory = [
        ...lead.transcript,
        { role: 'user', text: userMessage }
      ];

      const aiResult = await llmService.generateAIResponse(
        conversationHistory,
        retrievedContext
      );

      // Atomic transcript updates to prevent race conditions
      const userMessageEntry = {
        role: 'user',
        text: userMessage,
        timestamp: new Date()
      };

      const assistantMessageEntry = {
        role: 'assistant',
        text: aiResult.response,
        timestamp: new Date()
      };

      // Calculate new interest score
      const newInterestScore = Math.max(0, Math.min(100, 
        lead.interest_score + aiResult.interest_score_delta
      ));

      // Prepare update object
      const updateData = {
        $push: {
          transcript: {
            $each: [userMessageEntry, assistantMessageEntry]
          }
        },
        interest_score: newInterestScore
      };

      if (aiResult.course_detected) {
        updateData.course_interest = aiResult.course_detected;
      }

      // Generate summary if transcript is long enough
      if (conversationHistory.length > 4) {
        updateData.summary = this.generateSummary([...conversationHistory.slice(-6), assistantMessageEntry]);
      }

      // Atomic update to prevent concurrent modification issues
      const updatedLead = await Lead.findByIdAndUpdate(
        leadId,
        updateData,
        { new: true }
      );

      // Create call log entry
      await CallLog.create({
        leadId: lead._id,
        duration: 0,
        intents: [aiResult.intent],
        objection_detected: aiResult.objection_detected,
        handoff_required: aiResult.handoff_required,
        raw_transcript: `User: ${userMessage}\nAI: ${aiResult.response}`
      });

      logger.info(`Processed message for lead ${leadId}`, {
        intent: aiResult.intent,
        interestDelta: aiResult.interest_score_delta
      });

      return {
        response: aiResult.response,
        lead: {
          id: updatedLead._id,
          name: updatedLead.name,
          interest_score: updatedLead.interest_score,
          course_interest: updatedLead.course_interest,
          status: updatedLead.status
        },
        metadata: {
          intent: aiResult.intent,
          handoff_required: aiResult.handoff_required,
          objection_detected: aiResult.objection_detected
        }
      };
    } catch (error) {
      logger.error(`Conversation Service Error: ${error.message}`);
      throw error;
    }
  }

  generateSummary(recentTranscript) {
    const messages = recentTranscript
      .map(t => `${t.role}: ${t.text}`)
      .join(' | ');
    return messages.substring(0, 500);
  }
}

export default new ConversationService();
