import SibApiV3Sdk from "sib-api-v3-sdk";

// Configure Brevo API
// Helper to get Brevo API instance
const getApiInstance = () => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not defined in environment variables");
  }
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications["api-key"];
  apiKey.apiKey = process.env.BREVO_API_KEY.replace(/['"]+/g, '');
  return new SibApiV3Sdk.TransactionalEmailsApi();
};

const validateEmailConfig = () => {
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not defined in environment variables");
  }
};

const getSenderEmail = () => {
  return process.env.EMAIL_FROM.replace(/['"]+/g, '');
};

// Send verification code email
export const sendVerificationCode = async (email, verificationCode, companyName, companyId) => {
  try {
    validateEmailConfig();
    const apiInstance = getApiInstance();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "BinsErp",
      email: getSenderEmail(),
    };
    sendSmtpEmail.to = [{ email, name: companyName }];
    sendSmtpEmail.subject = "Verify Your Email - BinsErp";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .code-box { background: #f8f9fa; border: 2px dashed #4f46e5; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .code { font-size: 36px; font-weight: bold; color: #4f46e5; letter-spacing: 8px; font-family: monospace; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ Email Verification</h1>
          </div>
          <div class="content">
            <h2>Hello ${companyName}!</h2>
            <p>Thank you for registering with BinsErp. To complete your registration, please use the verification code below:</p>
            
            <div class="code-box">
              <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Your Verification Code</div>
              <div class="code">${verificationCode}</div>
              <div style="color: #666; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Your Company ID</div>
              <div style="font-size: 24px; font-weight: bold; color: #333;">${companyId}</div>
            </div>

            <div class="note">
              <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
            </div>

            <p>If you didn't request this verification code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BinsErp. All rights reserved.</p>
            <p>Shop Floor Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Verification code sent via Brevo:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending verification code:", error);
    throw new Error("Failed to send verification code");
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, name, userType = "company") => {
  try {
    validateEmailConfig();
    const apiInstance = getApiInstance();
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}&type=${userType}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "BinsErp",
      email: getSenderEmail(),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = "Reset Your Password - BinsErp";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>We received a request to reset your password for your BinsErp account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4f46e5; background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetUrl}</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BinsErp. All rights reserved.</p>
            <p>Shop Floor Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Password reset email sent via Brevo:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

// Send welcome email after verification
export const sendWelcomeEmail = async (email, companyName) => {
  try {
    validateEmailConfig();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "BinsErp",
      email: getSenderEmail(),
    };
    sendSmtpEmail.to = [{ email, name: companyName }];
    sendSmtpEmail.subject = "Welcome to BinsErp!";
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to BinsErp!</h1>
          </div>
          <div class="content">
            <h2>Hello ${companyName}!</h2>
            <p>Congratulations! Your email has been verified and your account is now active.</p>
            
            <p>You can now access your BinsErp dashboard and start managing your shop floor operations.</p>

            <h3>What you can do:</h3>
            <div class="feature">👥 <strong>User Management:</strong> Create and manage users with different roles (HR, Store, PPC, Accounts, etc.)</div>
            <div class="feature">🏭 <strong>Production Planning:</strong> Manage orders, route cards, and work schedules</div>
            <div class="feature">📦 <strong>Store Management:</strong> Track inventory, materials, and GRN</div>
            <div class="feature">⚙️ <strong>Settings:</strong> Customize your company profile and upload your logo</div>

            <p style="margin-top: 30px;">Get started by logging in at: <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" style="color: #4f46e5; font-weight: bold;">${process.env.FRONTEND_URL || "http://localhost:3000"}/login</a></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BinsErp. All rights reserved.</p>
            <p>Shop Floor Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const apiInstance = getApiInstance();
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw error for welcome email
    return { success: false };
  }
};
