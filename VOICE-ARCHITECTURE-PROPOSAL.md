# 🎙️ VOICE-BASED AI ADMISSION SYSTEM - ARCHITECTURE PROPOSAL

## 📋 OVERVIEW

This document outlines the architecture for extending the existing text-based backend into a **Voice-Based AI Admission Calling System** using Vapi as the voice transport layer.

---

## 🏗️ ARCHITECTURAL PRINCIPLES

### Core Design Philosophy
1. **Vapi = Voice Transport Only** - Handles audio, telephony, speech-to-text, text-to-speech
2. **Our Backend = Intelligence Layer** - All AI logic, RAG, scoring, memory
3. **MongoDB = Single Source of Truth** - All data persists here
4. **Webhook-Driven = Real-Time** - Event-based architecture for live conversations
5. **Modular = Easy to Extend** - Clean separation of concerns

### Why This Architecture?

**Vapi Handles:**
- ✅ Phone call infrastructure
- ✅ Speech-to-text (STT)
- ✅ Text-to-speech (TTS)
- ✅ Call routing
- ✅ Audio streaming

**Our Backend Handles:**
- ✅ Knowledge base (RAG)
- ✅ LLM prompting & response generation
- ✅ Conversation memory
- ✅ Interest scoring
- ✅ Lead management
- ✅ Business logic

---

## 🔄 SYSTEM FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                     VOICE CALL FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. TRIGGER CALL
   ┌──────────┐
   │  Worker  │ ──────> Vapi API: Start Call
   │  (Cron)  │         (leadId, phone, assistant_id)
   └──────────┘
        │
        ↓
   ┌──────────┐
   │   Vapi   │ ──────> Dials student phone
   └──────────┘
        │
        ↓

2. CALL CONNECTED
   ┌──────────┐
   │   Vapi   │ ──────> Webhook: call.started
   └──────────┘         { callId, leadId, status }
        │
        ↓
   ┌──────────┐
   │ Backend  │ ──────> Update Lead: status = 'calling'
   └──────────┘

3. CONVERSATION LOOP
   ┌──────────┐
   │ Student  │ ──────> Speaks
   └──────────┘
        │
        ↓
   ┌──────────┐
   │   Vapi   │ ──────> STT: Audio → Text
   └──────────┘
        │
        ↓
   ┌──────────┐
   │   Vapi   │ ──────> Webhook: message.received
   └──────────┘         { callId, leadId, text, role: 'user' }
        │
        ↓
   ┌──────────┐
   │ Backend  │ ──────> 1. Fetch lead + transcript
   │          │         2. RAG: Retrieve context
   │          │         3. LLM: Generate response
   │          │         4. Update transcript
   │          │         5. Update interest score
   └──────────┘
        │
        ↓
   ┌──────────┐
   │ Backend  │ ──────> Response: { text, metadata }
   └──────────┘
        │
        ↓
   ┌──────────┐
   │   Vapi   │ ──────> TTS: Text → Audio
   └──────────┘
        │
        ↓
   ┌──────────┐
   │ Student  │ <────── Hears AI response
   └──────────┘

   [LOOP CONTINUES]

4. CALL ENDS
   ┌──────────┐
   │   Vapi   │ ──────> Webhook: call.ended
   └──────────┘         { callId, duration, reason }
        │
        ↓
   ┌──────────┐
   │ Backend  │ ──────> 1. Analyze full transcript
   │          │         2. Extract: budget, course, timeline
   │          │         3. Generate final interest score
   │          │         4. Update Lead: status = 'completed'
   │          │         5. Create CallLog summary
   └──────────┘
```

---

## 📦 NEW COMPONENTS TO ADD

### 1. Vapi Service (`src/services/vapi.service.js`)

**Purpose:** Wrapper for Vapi API calls

**Methods:**
```javascript
class VapiService {
  // Trigger outbound call
  async initiateCall(leadId, phone, assistantId)
  
  // Get call status
  async getCallStatus(callId)
  
  // End call programmatically
  async endCall(callId)
  
  // Get call recording
  async getRecording(callId)
}
```

**Dependencies:**
- Vapi SDK (to be installed)
- Environment variable: `VAPI_API_KEY`

---

### 2. Webhook Routes (`src/routes/webhooks.routes.js`)

**Purpose:** Receive real-time events from Vapi

**Endpoints:**

#### `POST /webhooks/vapi/call-started`
- **Event:** Call connected
- **Action:** Update lead status to 'calling'
- **Payload:** `{ callId, leadId, timestamp }`

#### `POST /webhooks/vapi/message`
- **Event:** User spoke (STT complete)
- **Action:** 
  1. Retrieve lead + transcript
  2. Query RAG for context
  3. Generate LLM response
  4. Update transcript atomically
  5. Adjust interest score
  6. Return response to Vapi
- **Payload:** `{ callId, leadId, message, role }`
- **Response:** `{ text, metadata }`

#### `POST /webhooks/vapi/call-ended`
- **Event:** Call disconnected
- **Action:**
  1. Analyze full transcript
  2. Extract key fields (budget, course, timeline, objections)
  3. Calculate final interest score
  4. Update lead status
  5. Create CallLog summary
- **Payload:** `{ callId, leadId, duration, endReason, transcript }`

#### `POST /webhooks/vapi/transcript`
- **Event:** Real-time transcript chunk
- **Action:** Stream transcript to database
- **Payload:** `{ callId, leadId, text, role, timestamp }`

**Security:**
- Signature verification (Vapi webhook secret)
- IP whitelist (optional)
- Rate limiting

---

### 3. Call Trigger Service (`src/services/callTrigger.service.js`)

**Purpose:** Initiate outbound calls via Vapi

**Method:**
```javascript
async function triggerCall(leadId) {
  // 1. Fetch lead from MongoDB
  const lead = await Lead.findById(leadId);
  
  // 2. Prepare Vapi call config
  const callConfig = {
    phoneNumber: lead.phone,
    assistantId: process.env.VAPI_ASSISTANT_ID,
    metadata: {
      leadId: lead._id.toString(),
      name: lead.name,
      email: lead.email
    },
    webhookUrl: `${process.env.BASE_URL}/webhooks/vapi`
  };
  
  // 3. Trigger call via Vapi
  const call = await vapiService.initiateCall(callConfig);
  
  // 4. Update lead with call ID
  await Lead.findByIdAndUpdate(leadId, {
    vapi_call_id: call.id,
    status: 'calling',
    $inc: { attempts: 1 }
  });
  
  return call;
}
```

**Integration Point:** Replace `simulateCallOutcome()` in `call.worker.js`

---

### 4. Enhanced Prompt Pipeline (`src/services/promptBuilder.service.js`)

**Purpose:** Construct dynamic, context-aware system prompts

**Method:**
```javascript
function buildSystemPrompt(lead, conversationHistory, ragContext) {
  return `You are an AI admission counselor for BML Munjal University.

STUDENT INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Current Interest Score: ${lead.interest_score}/100
- Course Interest: ${lead.course_interest || 'Not yet determined'}
- Previous Attempts: ${lead.attempts}

CONVERSATION MEMORY:
${formatConversationHistory(conversationHistory)}

KNOWLEDGE BASE CONTEXT:
${ragContext}

INSTRUCTIONS:
- Be warm, professional, and helpful
- Answer ONLY using the provided knowledge base context
- Detect student's budget, preferred course, and timeline
- Identify objections and address them
- If you don't know something, offer to connect with a counselor
- Keep responses concise (2-3 sentences for voice)
- Use natural, conversational language

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "response": "your spoken response",
  "intent": "information_seeking|course_inquiry|pricing|objection|ready_to_apply",
  "interest_score_delta": 0,
  "course_detected": "",
  "budget_detected": "",
  "timeline_detected": "",
  "objection_detected": "",
  "handoff_required": false
}`;
}
```

**Key Enhancements:**
- Lead context injection
- Conversation memory
- RAG context
- Voice-optimized instructions (concise responses)
- Extended metadata extraction

---

### 5. Enhanced RAG Service

**Current:** Already implemented in `src/services/rag.service.js`

**Enhancements Needed:**
- ✅ Already using ChromaDB native embeddings
- ✅ Already retrieving top-K documents
- ✅ Already injecting into prompts

**Optional Improvements:**
- Add metadata filtering by course
- Cache frequent queries
- Implement semantic caching

**No major changes required** - current implementation is voice-ready

---

### 6. Memory Architecture

**Current:** Already implemented via Lead.transcript

**Structure:**
```javascript
transcript: [{
  role: 'user' | 'assistant' | 'system',
  text: String,
  timestamp: Date
}]
```

**Enhancements for Voice:**
- Add `audio_url` field (optional)
- Add `duration` field (seconds)
- Add `confidence_score` (STT accuracy)

**Token Management:**
- Already implemented: Uses last 6 messages for summary
- For voice: Limit to last 10 exchanges (20 messages)
- Truncate old messages if token limit exceeded

**No major changes required** - current implementation is voice-ready

---

### 7. Lead Scoring Engine (`src/services/scoring.service.js`)

**Purpose:** Analyze full transcript and generate comprehensive score

**Method:**
```javascript
async function analyzeTranscript(leadId) {
  const lead = await Lead.findById(leadId).lean();
  
  // Extract key information
  const analysis = {
    budget: extractBudget(lead.transcript),
    course: extractCourse(lead.transcript),
    timeline: extractTimeline(lead.transcript),
    objections: extractObjections(lead.transcript),
    engagement: calculateEngagement(lead.transcript),
    sentiment: analyzeSentiment(lead.transcript)
  };
  
  // Calculate final interest score
  const finalScore = calculateInterestScore(analysis);
  
  // Update lead
  await Lead.findByIdAndUpdate(leadId, {
    interest_score: finalScore,
    budget_range: analysis.budget,
    preferred_course: analysis.course,
    enrollment_timeline: analysis.timeline,
    objections: analysis.objections,
    summary: generateSummary(lead.transcript, analysis)
  });
  
  return analysis;
}
```

**Scoring Algorithm:**
```javascript
function calculateInterestScore(analysis) {
  let score = 0;
  
  // Budget clarity (+20)
  if (analysis.budget) score += 20;
  
  // Course identified (+20)
  if (analysis.course) score += 20;
  
  // Timeline defined (+15)
  if (analysis.timeline) score += 15;
  
  // Engagement level (+25)
  score += analysis.engagement * 25;
  
  // Sentiment (+20)
  score += (analysis.sentiment + 1) * 10; // -1 to 1 → 0 to 20
  
  // Objections penalty (-10 per objection)
  score -= analysis.objections.length * 10;
  
  return Math.max(0, Math.min(100, score));
}
```

---

### 8. Enhanced Database Models

#### Lead Model Extensions
```javascript
// Add to existing Lead schema
{
  // ... existing fields ...
  
  // Vapi-specific fields
  vapi_call_id: String,
  vapi_assistant_id: String,
  call_duration: Number,
  call_recording_url: String,
  
  // Enhanced scoring fields
  budget_range: String,
  preferred_course: String,
  enrollment_timeline: String,
  objections: [String],
  
  // Voice-specific metadata
  transcript_confidence: Number,
  audio_quality: String
}
```

#### New VapiEvent Model
```javascript
// src/models/VapiEvent.js
const vapiEventSchema = new mongoose.Schema({
  leadId: { type: ObjectId, ref: 'Lead', required: true },
  callId: { type: String, required: true },
  eventType: { 
    type: String, 
    enum: ['call.started', 'call.ended', 'message.received', 'transcript.updated'],
    required: true 
  },
  payload: { type: Object },
  processedAt: { type: Date },
  status: { 
    type: String, 
    enum: ['pending', 'processed', 'failed'],
    default: 'pending'
  }
}, { timestamps: true });
```

**Purpose:** Audit trail for all Vapi events

---

## 🔐 SECURITY CONSIDERATIONS

### Webhook Security
```javascript
// Verify Vapi webhook signature
function verifyWebhookSignature(req) {
  const signature = req.headers['x-vapi-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

### Environment Variables
```env
# Add to .env
VAPI_API_KEY=your_vapi_api_key
VAPI_ASSISTANT_ID=your_assistant_id
VAPI_WEBHOOK_SECRET=your_webhook_secret
BASE_URL=https://your-domain.com
```

---

## 📊 DATA FLOW SUMMARY

### Outbound Call Trigger
```
Worker → triggerCall() → Vapi API → Phone Call
```

### Real-Time Conversation
```
Student Speaks → Vapi STT → Webhook → Backend
  ↓
RAG Retrieval → LLM Generation → Response
  ↓
Backend → Vapi → TTS → Student Hears
```

### Post-Call Analysis
```
Call Ends → Webhook → analyzeTranscript() → Update Lead
```

---

## 🎯 IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Install Vapi SDK
- [ ] Create Vapi service wrapper
- [ ] Add webhook routes
- [ ] Implement signature verification
- [ ] Update Lead model with Vapi fields
- [ ] Create VapiEvent model

### Phase 2: Call Triggering (Week 1)
- [ ] Implement callTrigger service
- [ ] Update worker to use Vapi
- [ ] Handle call.started webhook
- [ ] Test outbound calling

### Phase 3: Real-Time Conversation (Week 2)
- [ ] Implement message webhook handler
- [ ] Enhance prompt builder
- [ ] Test conversation flow
- [ ] Optimize response times

### Phase 4: Post-Call Analysis (Week 2)
- [ ] Implement scoring engine
- [ ] Handle call.ended webhook
- [ ] Extract key fields
- [ ] Generate summaries

### Phase 5: Testing & Optimization (Week 3)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Monitoring & logging

---

## 🚀 ADVANTAGES OF THIS ARCHITECTURE

### Separation of Concerns
- ✅ Vapi handles voice infrastructure
- ✅ Backend handles intelligence
- ✅ Clean interfaces between layers

### Flexibility
- ✅ Easy to switch voice providers
- ✅ Can add multiple LLM providers
- ✅ RAG can be enhanced independently

### Scalability
- ✅ Webhook-based (async, non-blocking)
- ✅ Stateless backend (horizontal scaling)
- ✅ MongoDB handles concurrent writes

### Maintainability
- ✅ Modular services
- ✅ Clear responsibilities
- ✅ Easy to test components

### Cost Efficiency
- ✅ Pay only for voice minutes (Vapi)
- ✅ Control LLM costs (Groq)
- ✅ Optimize RAG queries

---

## 📝 NEXT STEPS

1. **Review this architecture** with your team
2. **Approve the approach** or suggest modifications
3. **Set up Vapi account** and get API keys
4. **Begin Phase 1 implementation**
5. **Test with sample calls**
6. **Iterate and optimize**

---

**This architecture extends your existing backend without breaking changes, maintains clean separation of concerns, and positions you for scalable voice-based admissions.**
