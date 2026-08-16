import crypto from "crypto";
import { sendEmail } from "../utils/email.js";

/**
 * Generates a 6-digit cryptographically secure numeric OTP string.
 */
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Sends a 6-digit OTP code to the recipient email (Free via Brevo / SMTP).
 */
export const sendEmailOTP = async (toEmail, otp, subject = "Your Binserp Verification Code") => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-bottom: 8px;">Binserp Verification</h2>
      <p style="color: #4b5563; font-size: 14px; margin-bottom: 20px;">Use the verification code below to complete your authentication request:</p>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111827;">
        ${otp}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  return await sendEmail({
    to: toEmail,
    subject,
    html: htmlContent,
  });
};

/**
 * Generates a zero-cost WhatsApp Deep Link for sending OTP manually via WhatsApp.
 * Opens WhatsApp Web or WhatsApp Mobile App with pre-filled OTP message.
 */
export const getWhatsAppDeepLink = (phoneNumber, otp) => {
  const cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, "");
  const encodedText = encodeURIComponent(`Your Binserp verification OTP code is ${otp}. Valid for 10 minutes.`);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
};
