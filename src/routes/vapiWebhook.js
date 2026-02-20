import express from "express";

const router = express.Router();

router.post("/vapi/webhook", async (req, res) => {
  const event = req.body;

  console.log("Vapi Event Received:", event.type);

  if (event.type === "call.started") {
    console.log("Call Started:", event.call.id);
  }

  if (event.type === "call.ended") {
    console.log("Call Ended:", event.call.id);
  }

  if (event.type === "transcript") {
    console.log("Transcript chunk:", event.transcript);
  }

  res.status(200).send("OK");
});

export default router;