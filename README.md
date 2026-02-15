# AI Voice Admission Campaign System

Production-ready Node.js backend for an intelligent admission campaign system using AI-powered conversations, RAG (Retrieval-Augmented Generation), and automated lead management.

## Tech Stack

- **Runtime**: Node.js (LTS) with ES Modules
- **Framework**: Express.js
- **AI/LLM**: LangChain + Groq API (llama-3.3-70b-versatile)
- **Vector Database**: ChromaDB (self-hosted)
- **Database**: MongoDB Atlas with Mongoose ODM
- **Scheduling**: node-cron
- **File Processing**: csv-parser, pdf-parse

## Features

- ✅ RAG-based intelligent conversation system with strict grounding
- ✅ Lead management with interest scoring
- ✅ CSV bulk lead upload with duplicate detection (email + phone)
- ✅ Automated call queue worker with proper state machine
- ✅ Campaign reporting and analytics
- ✅ Document ingestion for knowledge base
- ✅ Conversation transcript tracking (atomic updates)
- ✅ Intent detection and objection handling
- ✅ Hallucination prevention through context-only responses
- ✅ Comprehensive health checks for all dependencies
- ✅ Ready for voice integration (Vapi/Twilio)

## Project Structure

```
admission-ai/
├── src/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic (LLM, RAG, Conversation)
│   ├── workers/         # Background jobs (Call queue)
│   ├── models/          # Mongoose schemas
│   ├── config/          # Database and ChromaDB config
│   ├── utils/           # Helpers (logger, error handler, ingestion)
│   └── app.js           # Express app setup
├── server.js            # Server entry point
├── .env.example         # Environment variables template
├── package.json
└── README.md
```

## Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `MONGO_URI`: MongoDB Atlas connection string
- `GROQ_API_KEY`: Your Groq API key (get from https://console.groq.com)
- `CHROMA_URL`: ChromaDB server URL (default: http://localhost:8000)

### 3. Start ChromaDB

Using Docker (recommended):

```bash
docker run -p 8000:8000 chromadb/chroma
```

Or using Python:

```bash
pip install chromadb
chroma run --path ./chroma_data
```

### 4. Prepare Knowledge Base Documents

Create a `documents/` folder and add your admission-related documents:

```bash
mkdir documents
# Add PDF or text files about courses, admission process, etc.
```

### 5. Run Document Ingestion

```bash
npm run ingest
# Or specify custom path:
node src/utils/ingest.js /path/to/documents
```

### 6. Start the Server

```bash
npm start
# Or for development with auto-reload:
npm run dev
```

Server will start on `http://localhost:5000`

## API Endpoints

### Health Check
```bash
GET /health
# Basic health check

GET /health/detailed
# Comprehensive health check with dependency status:
# - MongoDB connection
# - ChromaDB collection accessibility
# - Groq API reachability
```

### Upload Leads (CSV)
```bash
POST /api/upload-leads
Content-Type: multipart/form-data

# CSV format: name,phone,email
# Example:
# John Doe,+919876543210,john@example.com
# Jane Smith,+919876543211,jane@example.com
```

### Chat Test (Manual Testing)
```bash
POST /api/chat-test
Content-Type: application/json

{
  "leadId": "507f1f77bcf86cd799439011",
  "message": "Tell me about BTech programs"
}
```

### Get Lead Details
```bash
GET /api/leads/:id
```

### List All Leads
```bash
GET /api/leads?page=1&limit=20&status=pending
```

### Export Campaign Report
```bash
GET /api/export-report
# Downloads CSV with: name,phone,status,interest_score,course_interest,summary
```

### Campaign Statistics
```bash
GET /api/stats
```

## Testing the System

### 1. Upload Sample Leads

Create `sample-leads.csv`:
```csv
name,phone,email
Alice Johnson,+919876543210,alice@test.com
Bob Williams,+919876543211,bob@test.com
Carol Davis,+919876543212,carol@test.com
```

Upload:
```bash
curl -X POST http://localhost:5000/api/upload-leads \
  -F "file=@sample-leads.csv"
```

### 2. Test Conversation

```bash
curl -X POST http://localhost:5000/api/chat-test \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "YOUR_LEAD_ID",
    "message": "What courses do you offer in engineering?"
  }'
```

### 3. Check Call Queue Worker

The worker runs automatically every minute and processes pending leads. Check logs:
```
[INFO] Call worker started - running every 1 minute
[INFO] Simulated call initiated for lead: Alice Johnson...
```

### 4. Export Report

```bash
curl http://localhost:5000/api/export-report -o report.csv
```

## How It Works

### RAG Architecture

**Embedding Strategy:**
- Uses ChromaDB's native embedding function (all-MiniLM-L6-v2)
- Embeddings generated server-side by ChromaDB
- No external embedding API required
- Consistent embedding function for both ingestion and query
- Automatic dimension consistency

### Conversation Flow with Strict Grounding

1. **User Message** → Received via `/chat-test` endpoint
2. **Context Retrieval** → RAG service queries ChromaDB for relevant information
3. **Grounding Check** → If no context found, returns safe handoff response
4. **LLM Processing** → Groq API generates structured response with:
   - Conversational reply (context-only, no hallucination)
   - Intent classification
   - Interest score delta
   - Course detection
   - Objection detection
   - Handoff flag
5. **Atomic Update** → Lead record updated atomically using `$push`:
   - Transcript appended (race-condition safe)
   - Interest score adjusted
   - Course interest captured
6. **Response** → AI reply sent back to user

### Hallucination Prevention

- Temperature reduced to 0.2 for deterministic responses
- Explicit prompt instruction: "Answer ONLY using provided context"
- Pre-check: If no context retrieved, force handoff response
- Instruction to never fabricate numbers, fees, statistics
- Safe fallback on any LLM error

### Call Queue Worker

- Runs every 1 minute via cron
- Fetches 5 pending leads (FIFO)
- Updates status: pending → calling → completed/failed/no_answer
- Increments attempt counter
- Implements retry logic:
  - Max 3 attempts before marking as failed
  - No answer → returns to pending for retry
  - Completed → final state
  - Failed → final state
- Protected against concurrent execution with try-finally
- Logs simulated call outcomes (ready for Vapi integration)

### Interest Scoring

- Starts at 0 for new leads
- Increases (+1 to +3) when student shows interest
- Decreases (-1 to -3) when student shows disinterest
- Clamped between 0-100
- Used for lead prioritization

## Production Deployment

### Environment Variables

Ensure all production values are set:
```bash
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...
GROQ_API_KEY=gsk_...
CHROMA_URL=http://chroma-service:8000
```

### Database Migration

If you have existing data, run the phone index migration:
```bash
node src/utils/migrate-phone-index.js
```

This ensures the unique phone index is created without conflicts.

### Docker Deployment (Optional)

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t admission-ai .
docker run -p 5000:5000 --env-file .env admission-ai
```

### Monitoring

- Check logs for errors and performance
- Monitor MongoDB Atlas metrics
- Track ChromaDB collection size
- Set up alerts for failed calls

## Next Steps: Voice Integration

To integrate with Vapi or Twilio:

1. Update `src/workers/call.worker.js`
2. Add Vapi SDK: `npm install @vapi-ai/web`
3. Replace simulated call with actual API call
4. Handle voice transcription → conversation service
5. Stream AI responses back to voice channel

## Troubleshooting

### ChromaDB Connection Failed
```bash
# Make sure ChromaDB is running:
docker ps | grep chroma
# Or restart:
docker run -p 8000:8000 chromadb/chroma
```

### MongoDB Connection Error
- Check MONGO_URI format
- Verify network access in MongoDB Atlas
- Ensure IP whitelist includes your server

### Groq API Errors
- Verify API key is valid
- Check rate limits
- Monitor usage at console.groq.com

### No Documents Retrieved
- Run ingestion script first
- Check ChromaDB collection: `GET /health/detailed`
- Verify documents folder has content

### Worker Not Processing Leads
- Check logs for errors
- Verify leads exist with status='pending'
- Check worker flag isn't stuck (restart server)

### Duplicate Lead Errors
- Leads are unique by email OR phone
- Check which field is duplicate in response
- Use different email/phone combination

## License

MIT

## Support

For issues or questions, check logs and ensure all services are running properly.
