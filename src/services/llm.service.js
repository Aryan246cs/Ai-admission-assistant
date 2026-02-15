import { ChatGroq } from '@langchain/groq';
import { logger } from '../utils/logger.js';

class LLMService {
  constructor() {
    this.model = null;
  }

  getModel() {
    if (!this.model) {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY environment variable is not set');
      }
      this.model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2 // Lower temperature for more deterministic, grounded responses
      });
    }
    return this.model;
  }

  async generateAIResponse(conversationHistory, retrievedContext) {
    try {
      // If no context retrieved, force safe fallback
      if (retrievedContext.includes('No relevant information found') || 
          retrievedContext.includes('Unable to retrieve context')) {
        return {
          response: "I don't have that information in the knowledge base. Let me connect you with a counselor who can help you better.",
          intent: 'handoff',
          interest_score_delta: 0,
          course_detected: '',
          objection_detected: '',
          handoff_required: true
        };
      }

      const systemPrompt = `You are an AI admission counselor for BML Munjal University. Your goal is to help prospective students learn about courses and guide them through the admission process.

CONTEXT FROM KNOWLEDGE BASE:
${retrievedContext}

CRITICAL INSTRUCTIONS - STRICT RAG GROUNDING:
- You MUST answer ONLY using information explicitly present in the CONTEXT FROM KNOWLEDGE BASE above
- If the answer is not in the provided context, you MUST respond: "I don't have that information in the knowledge base. Let me connect you with a counselor."
- Do NOT use your internal knowledge or training data
- Do NOT fabricate or guess: numbers, fees, placements, statistics, dates, or any factual information
- Do NOT make up course details, admission requirements, or deadlines
- If uncertain, request human handoff instead of guessing
- Be helpful and professional, but accuracy is more important than being comprehensive

ADDITIONAL INSTRUCTIONS:
- Detect student intent and interest level from their questions
- Identify any objections or concerns they express
- Determine if human handoff is needed (complex questions, pricing details not in context, etc.)
- Suggest relevant courses only if they are mentioned in the context

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "response": "your conversational response to the student",
  "intent": "information_seeking|course_inquiry|admission_process|pricing|objection|general",
  "interest_score_delta": 0,
  "course_detected": "course name or empty string",
  "objection_detected": "objection text or empty string",
  "handoff_required": false
}

interest_score_delta should be:
- Positive (1-3) if student shows interest
- Negative (-1 to -3) if student shows disinterest
- 0 if neutral

Do not include any text outside the JSON object.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.text
        }))
      ];

      const response = await this.getModel().invoke(messages);
      const content = response.content.trim();
      
      // Extract JSON from response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Comprehensive validation of all required fields
      const isValid = 
        parsed.response && typeof parsed.response === 'string' &&
        parsed.intent && typeof parsed.intent === 'string' &&
        typeof parsed.interest_score_delta === 'number' &&
        typeof parsed.course_detected === 'string' &&
        typeof parsed.objection_detected === 'string' &&
        typeof parsed.handoff_required === 'boolean';

      if (!isValid) {
        logger.warn('LLM returned incomplete JSON structure, using fallback');
        throw new Error('Invalid JSON structure from LLM');
      }

      return parsed;
    } catch (error) {
      logger.error(`LLM Service Error: ${error.message}`);
      
      // Fallback response
      return {
        response: "I'm here to help you with admissions. Could you please rephrase your question?",
        intent: 'general',
        interest_score_delta: 0,
        course_detected: '',
        objection_detected: '',
        handoff_required: false
      };
    }
  }
}

export default new LLMService();
