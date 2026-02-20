# 🎙️ VAPI WEBHOOK CONFIGURATION

## ✅ YOUR SERVER IS LIVE!

Your backend is now accessible from the internet via ngrok tunnel.

---

## 🌐 PUBLIC URL

**Ngrok Tunnel URL:**
```
https://landlike-meanspiritedly-madison.ngrok-free.dev
```

---

## 🔗 WEBHOOK URL FOR VAPI

**Copy this URL and paste it in your Vapi Assistant settings:**

```
https://landlike-meanspiritedly-madison.ngrok-free.dev/api/vapi/webhook
```

---

## 📍 WHERE TO PASTE IN VAPI

1. Go to **Vapi Dashboard**: https://dashboard.vapi.ai
2. Select your **Assistant** (ID: `fc3e0ab1-34e5-47a9-a504-085c40a9876d`)
3. Find the **Server URL** or **Webhook URL** field
4. Paste: `https://landlike-meanspiritedly-madison.ngrok-free.dev/api/vapi/webhook`
5. Save

---

## 🧪 TEST YOUR WEBHOOK

You can test if the webhook is accessible:

```bash
curl https://landlike-meanspiritedly-madison.ngrok-free.dev/api/vapi/webhook
```

Expected response: `OK` or `Cannot GET` (POST only)

---

## 📊 WEBHOOK EVENTS HANDLED

Your webhook currently handles these Vapi events:

1. **call.started** - When a call begins
2. **call.ended** - When a call ends
3. **transcript** - Real-time transcript chunks

---

## 🔍 MONITORING

### Check Server Health
```bash
curl https://landlike-meanspiritedly-madison.ngrok-free.dev/health
```

### View Ngrok Dashboard
Open in browser: http://127.0.0.1:4040

This shows:
- All incoming requests
- Request/response details
- Replay requests for debugging

---

## ⚠️ IMPORTANT NOTES

### Ngrok Free Tier Limitations
- URL changes every time you restart ngrok
- Limited to 40 connections/minute
- Session expires after 2 hours (need to restart)

### When Ngrok Restarts
If you restart ngrok, you'll get a NEW URL. You'll need to:
1. Get the new URL from ngrok output
2. Update it in Vapi dashboard

### Keep These Running
Make sure these are always running:
- ✅ Your Node.js server (port 5000)
- ✅ Ngrok tunnel

---

## 🚀 CURRENT STATUS

| Component | Status | URL |
|-----------|--------|-----|
| Node.js Server | ✅ Running | http://localhost:5000 |
| Ngrok Tunnel | ✅ Running | https://landlike-meanspiritedly-madison.ngrok-free.dev |
| Webhook Endpoint | ✅ Ready | /api/vapi/webhook |
| MongoDB | ⚠️ Connection Issue | (Non-blocking) |
| ChromaDB | ⚠️ Not Running | (Optional) |

---

## 📝 NEXT STEPS

1. ✅ Copy webhook URL
2. ✅ Paste in Vapi dashboard
3. ✅ Make a test call
4. ✅ Check logs to see events coming in

---

## 🔧 TROUBLESHOOTING

### If webhook doesn't receive events:
1. Check ngrok is still running
2. Check your server is running (curl localhost:5000/health)
3. Check Vapi dashboard has correct URL
4. Check ngrok dashboard (http://127.0.0.1:4040) for incoming requests

### To restart ngrok:
```bash
# Stop current ngrok
# Then start new one:
ngrok http 5000
# Update URL in Vapi dashboard with new URL
```

---

**Your webhook URL is ready! Paste it in Vapi now.** 🎉
