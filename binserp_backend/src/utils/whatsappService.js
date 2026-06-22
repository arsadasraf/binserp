import twilio from "twilio";

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH;
// For Twilio sandbox, the default number is +14155238886. 
// If using a production sender, use TWILIO_WHATSAPP_NUMBER
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

let client;
try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
  } else {
    console.warn("⚠️ Twilio credentials missing from .env. WhatsApp OTP will not be sent.");
  }
} catch (error) {
  console.error("Twilio initialization error:", error);
}

const formatPhoneNumber = (number) => {
  if (!number) return number;
  let formattedNumber = String(number).trim();
  // Remove spaces, hyphens, parentheses
  formattedNumber = formattedNumber.replace(/[\s\-\(\)]/g, "");
  
  // If it doesn't start with +, assume India (+91) by default
  if (!formattedNumber.startsWith("+")) {
    formattedNumber = `+91${formattedNumber}`;
  }
  
  return `whatsapp:${formattedNumber}`;
};

export const sendWhatsAppVerificationCode = async (contactNumber, verificationCode, companyName) => {
  if (!client) {
    console.log(`[SIMULATED WHATSAPP] To: ${formatPhoneNumber(contactNumber)} | Code: ${verificationCode}`);
    return true;
  }

  try {
    const formattedTo = formatPhoneNumber(contactNumber);
    const from = twilioWhatsAppNumber.startsWith("whatsapp:") 
      ? twilioWhatsAppNumber 
      : `whatsapp:${twilioWhatsAppNumber}`;

    const message = await client.messages.create({
      body: `Your BinsAnalytics verification code is: *${verificationCode}*. Welcome, ${companyName}!`,
      from: from,
      to: formattedTo
    });

    console.log(`WhatsApp OTP sent to ${formattedTo}. Message SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error("Critical WhatsApp sending Error:", error);
    throw new Error(`WhatsApp sending failed: ${error.message}`);
  }
};
