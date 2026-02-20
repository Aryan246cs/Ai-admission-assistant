import axios from "axios";

export async function triggerCall(phone, leadId) {
  try {
    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phone
        },
        metadata: {
          leadId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error("Vapi Call Error:", error.response?.data || error.message);
    throw error;
  }
}