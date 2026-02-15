# Startup Issue Fix

## Problem

When running `npm start`, the server failed with error:
```
Error: Groq API key not found. Please set the GROQ_API_KEY environment variable
```

## Root Causes

### 1. LLM Service Initialization Timing
The `LLMService` class was instantiating `ChatGroq` in the constructor, which runs at module load time - BEFORE `dotenv.config()` loads the environment variables.

```javascript
// BEFORE (Broken)
class LLMService {
  constructor() {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY, // undefined at this point!
      ...
    });
  }
}
```

### 2. MongoDB URI Special Characters
The `.env` file had unencoded special characters in the password:
```
MONGO_URI=...:<aps@1976>@...
```

The `@` symbol needs to be URL-encoded as `%40`.

## Solutions Applied

### Fix 1: Lazy Loading for LLM Service

Changed the LLM service to use lazy initialization:

```javascript
// AFTER (Fixed)
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
        temperature: 0.2
      });
    }
    return this.model;
  }

  async generateAIResponse(conversationHistory, retrievedContext) {
    // Use this.getModel() instead of this.model
    const response = await this.getModel().invoke(messages);
    ...
  }
}
```

**Benefits:**
- Model is only created when first needed (after dotenv loads)
- Clear error message if GROQ_API_KEY is missing
- No initialization overhead if LLM is never used

### Fix 2: URL-Encoded MongoDB Password

Updated `.env` file:
```
# BEFORE
MONGO_URI=mongodb+srv://user:<aps@1976>@host...

# AFTER
MONGO_URI=mongodb+srv://user:aps%401976@host...
```

**URL Encoding Reference:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

### Fix 3: Health Check Protection

Updated health check to handle missing API key gracefully:

```javascript
// Check Groq API
try {
  if (!process.env.GROQ_API_KEY) {
    health.dependencies.groq = { 
      status: 'error', 
      message: 'GROQ_API_KEY not configured' 
    };
    health.status = 'degraded';
  } else {
    // Test API connection
    ...
  }
}
```

## Files Modified

1. **src/services/llm.service.js**
   - Added `getModel()` lazy initialization method
   - Changed `this.model.invoke()` to `this.getModel().invoke()`

2. **src/app.js**
   - Added GROQ_API_KEY check in health endpoint

3. **.env**
   - URL-encoded MongoDB password

## Verification

Server now starts successfully:

```bash
npm start

# Output:
# [INFO] MongoDB Connected: ...
# [INFO] Call worker started - running every 1 minute
# [INFO] Server running on port 5000
# [INFO] Health check: http://localhost:5000/health
```

Health check shows all systems operational:

```bash
curl http://localhost:5000/health/detailed

# Response:
{
  "status": "healthy",
  "dependencies": {
    "mongodb": { "status": "connected" },
    "chromadb": { "status": "connected" },
    "groq": { "status": "connected" }
  }
}
```

## ChromaDB Note

ChromaDB is optional for basic operation. If not running, you'll see:

```
[WARN] ChromaDB connection failed - RAG features will be limited
[WARN] Make sure ChromaDB is running: docker run -p 8000:8000 chromadb/chroma
```

This is expected and doesn't prevent the server from starting. RAG features will work once ChromaDB is started.

## Testing

1. **Basic Health Check:**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Detailed Health Check:**
   ```bash
   curl http://localhost:5000/health/detailed
   ```

3. **Upload Test Leads:**
   ```bash
   curl -X POST http://localhost:5000/api/upload-leads \
     -F "file=@test-leads.csv"
   ```

4. **View Leads:**
   ```bash
   curl http://localhost:5000/api/leads
   ```

## Common Issues

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change PORT in .env
PORT=5001
```

### MongoDB Connection Failed
```
[ERROR] MongoDB Connection Error: ...
```

**Solution:**
- Verify MONGO_URI is correct
- Check MongoDB Atlas network access (whitelist your IP)
- Ensure password is URL-encoded

### Groq API Key Invalid
```
[ERROR] Groq API error: Invalid API key
```

**Solution:**
- Get new API key from https://console.groq.com
- Update GROQ_API_KEY in .env
- Restart server

## Summary

✅ Server starts successfully  
✅ MongoDB connected  
✅ Groq API accessible  
✅ Worker running  
✅ All endpoints operational  
⚠️ ChromaDB optional (start separately for RAG features)

The lazy loading pattern ensures environment variables are loaded before any external services are initialized, preventing startup errors.
