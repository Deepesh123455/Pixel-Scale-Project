import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// 1. Configure the Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465, // Auto-detect secure setting
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


//Base Email Layout (Reused for all emails)

const getBaseEmailLayout = (content: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { background-color: #f4f4f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; width: 100% !important; }
    .container { max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { padding: 40px 0 20px; text-align: center; }
    .footer { padding: 30px 40px; background-color: #F9FAFB; text-align: center; font-size: 13px; color: #9CA3AF; }
    .content { padding: 0 40px 20px; text-align: center; }
  </style>
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 800;">Pixel<span style="color: #4F46E5;">Scale</span></h1>
          </div>
          
          <div class="content">
            ${content}
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} PixelScale Inc. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};


// Generic Send Email Function (Handles try-catch & transport)

const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  try {
    const info = await transporter.sendMail({
      from: `"PixelScale Security" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: getBaseEmailLayout(htmlContent), // Layout automatically applied
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return false;
  }
};


// 1. Send OTP Email

export const sendOTPEmail = async (email: string, otp: string) => {
  const content = `
    <h2 style="color: #374151; font-size: 20px; font-weight: 600;">Secure Your Account</h2>
    <p style="color: #6B7280; font-size: 16px; margin-top: 10px;">
      Use the verification code below to login or sign up.
    </p>
    <div style="background-color: #EEF2FF; border: 1px dashed #4F46E5; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
      <span style="font-family: monospace; font-size: 36px; font-weight: 700; color: #4F46E5; letter-spacing: 8px;">${otp}</span>
    </div>
    <p style="color: #EF4444; font-size: 14px; font-weight: 500;">⏳ Expires in 5 minutes.</p>
  `;
  
  return await sendEmail(email, "Your Verification Code - PixelScale", content);
};


// 2. Send Reset Password Email

export const sendResetPasswordEmail = async (email: string, token: string) => {
  // Ensure FRONTEND_URL is set (fallback to localhost if missing)
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  const content = `
    <h2 style="color: #374151; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
    <p style="color: #6B7280; font-size: 16px; margin-top: 10px;">
      Click the button below to reset your password. If you didn't ask for this, ignore this email.
    </p>
    <div style="margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #4F46E5; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a>
    </div>
    <p style="color: #EF4444; font-size: 14px;">⏳ Link expires in 10 minutes.</p>
    <p style="font-size: 12px; color: #9CA3AF; margin-top: 20px;">
      Link not working? <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
    </p>
  `;

  return await sendEmail(email, "🔒 Reset Your Password - PixelScale", content);
};


// 3. Send Password Updated Alert

export const sendPasswordUpdatedEmail = async (email: string) => {
  const content = `
    <h2 style="color: #374151; font-size: 20px; font-weight: 600;">Security Alert 🔒</h2>
    <p style="color: #6B7280; font-size: 16px; margin-top: 10px;">
      Your password was successfully changed just now.
    </p>
    <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; text-align: left;">
      <p style="margin: 0; color: #991B1B; font-size: 14px;">
        <strong>If you didn't do this:</strong> Contact support immediately.
      </p>
    </div>
    <p style="color: #059669; font-size: 14px;">If you did this, you can safely ignore this email.</p>
  `;

  return await sendEmail(email, "Security Alert: Password Changed", content);
};