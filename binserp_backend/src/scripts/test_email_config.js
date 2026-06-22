import dotenv from "dotenv";
dotenv.config();
import SibApiV3Sdk from "sib-api-v3-sdk";

const sendTestEmail = async () => {
    console.log("Checking Email Config...");
    const apiKey = process.env.BREVO_API_KEY;
    const sender = process.env.EMAIL_FROM;

    console.log("API Key found:", apiKey ? "Yes (starts with " + apiKey.substring(0, 10) + "...)" : "No");
    console.log("Sender:", sender);

    if (!apiKey || !sender) {
        console.error("Missing config!");
        return;
    }

    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const auth = defaultClient.authentications["api-key"];
    auth.apiKey = apiKey.replace(/['"]+/g, '');

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = { name: "Test Script", email: sender.replace(/['"]+/g, '') };
    sendSmtpEmail.to = [{ email: sender.replace(/['"]+/g, ''), name: "Test User" }]; // Send to self
    sendSmtpEmail.subject = "Test Email from BinsErp Script";
    sendSmtpEmail.htmlContent = "<p>This is a test email to verify credentials.</p>";

    try {
        console.log("Attempting to send...");
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("✅ Success! Message ID:", data.messageId);
    } catch (error) {
        console.error("❌ Failed!");
        console.error("Error Status:", error.status); // 401, 400, etc.
        if (error.response && error.response.text) {
            console.error("Error Details:", error.response.text);
        } else {
            console.error("Error Message:", error.message);
        }
    }
};

sendTestEmail();
