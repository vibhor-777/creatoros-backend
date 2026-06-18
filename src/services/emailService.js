/**
 * StudioZ Email Notification Service
 * Sends alerts to admin@studio-z.in for:
 * - New student ID card verification requests
 * - New purchases / payment completions
 * - Verification approved/rejected notifications to users
 *
 * Uses nodemailer with Hostinger SMTP (mail.studio-z.in)
 * Fallback: logs to console if SMTP not configured
 */

const nodemailer = require('nodemailer');

// ─── Transporter Setup ────────────────────────────────────────────────────────
function getTransporter() {
  const host = process.env.SMTP_HOST || 'mail.studio-z.in';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER || 'admin@studio-z.in';
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    console.warn('[EMAIL] SMTP_PASS not set — email notifications disabled. Set it in Hostinger env vars.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Generic Send Helper ──────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    // Console log fallback when SMTP not set
    console.log(`[EMAIL LOG] To: ${to} | Subject: ${subject}`);
    return false;
  }

  try {
    const from = process.env.MAIL_FROM || 'StudioZ Admin <admin@studio-z.in>';
    await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[EMAIL] Sent successfully to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}: ${err.message}`);
    return false;
  }
}

// ─── Admin Email ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@studio-z.in';

// ─── 1. New Student ID Verification Request ───────────────────────────────────
async function notifyAdminNewVerification(user) {
  const subject = `[StudioZ] New Student ID Verification Request — ${user.fullName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#FB3640,#B388FF);padding:20px 32px;">
        <h2 style="margin:0;color:#fff;">📋 New Verification Request</h2>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">StudioZ Admin Alert</p>
      </div>
      <div style="padding:32px;">
        <p>Ek naya student ne School ID ke saath account create kiya hai. Review karo:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;width:140px;">Student Name</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-weight:bold;">${user.fullName}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Username</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">@${user.username}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Email</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${user.email}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Institution</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${user.institution || 'Not provided'}</td></tr>
          <tr><td style="padding:10px;color:#A0AAB2;">Registered At</td><td style="padding:10px;">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
        <p>ID Card ki image admin dashboard mein dekho:</p>
        <a href="https://studio-z.in#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Open Admin Dashboard →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">
        StudioZ | admin@studio-z.in | Ye ek automatic notification hai.
      </div>
    </div>
  `;

  await sendMail({ to: ADMIN_EMAIL, subject, html, text: `New verification request from ${user.fullName} (${user.email})` });
}

// ─── 2. New Purchase / Payment Notification ───────────────────────────────────
async function notifyAdminNewPayment({ buyer, product, amount, transactionId }) {
  const subject = `[StudioZ] New Payment — ₹${amount} | ${product}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#00E676,#00C853);padding:20px 32px;">
        <h2 style="margin:0;color:#000;">💰 New Payment Received</h2>
        <p style="margin:4px 0 0;opacity:0.7;font-size:13px;color:#000;">StudioZ Escrow Alert</p>
      </div>
      <div style="padding:32px;">
        <p>Ek naya purchase escrow mein hold hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;width:140px;">Buyer</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-weight:bold;">${buyer}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Product</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${product}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Amount</td><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#00E676;font-size:20px;font-weight:800;">₹${amount}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Transaction ID</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-size:11px;">${transactionId}</td></tr>
          <tr><td style="padding:10px;color:#A0AAB2;">Time</td><td style="padding:10px;">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
        <p>24-hour escrow period ke baad automatically release hoga. Admin bypass ke liye:</p>
        <a href="https://studio-z.in#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#00E676,#00C853);color:#000;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Open Admin Dashboard →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">
        StudioZ | admin@studio-z.in | Ye ek automatic notification hai.
      </div>
    </div>
  `;

  await sendMail({ to: ADMIN_EMAIL, subject, html, text: `New payment of ₹${amount} by ${buyer} for "${product}" (Txn: ${transactionId})` });
}

// ─── 3. Send verification result to USER ─────────────────────────────────────
async function notifyUserVerificationResult(user, approved, reason) {
  if (!user.email) return;

  const subject = approved
    ? `[StudioZ] 🎉 Aapka verification approve ho gaya!`
    : `[StudioZ] Verification request rejected`;

  const html = approved
    ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#00E676,#00C853);padding:20px 32px;">
          <h2 style="margin:0;color:#000;">🎉 Verification Approved!</h2>
        </div>
        <div style="padding:32px;">
          <p>Namaste <strong>${user.fullName}</strong>,</p>
          <p>Aapka StudioZ seller verification approve ho gaya hai! Ab aap products list aur sell kar sakte hain.</p>
          <a href="https://studio-z.in#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:16px;">Start Selling →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | India's Student Economy, Unified</div>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#FB3640;padding:20px 32px;">
          <h2 style="margin:0;color:#fff;">Verification Rejected</h2>
        </div>
        <div style="padding:32px;">
          <p>Namaste <strong>${user.fullName}</strong>,</p>
          <p>Aapki verification request reject ho gayi hai.</p>
          ${reason ? `<div style="background:#0e1b17;border-left:3px solid #FB3640;padding:12px 16px;border-radius:4px;margin:16px 0;"><strong>Reason:</strong> ${reason}</div>` : ''}
          <p>Sahi documents ke saath dobara apply kar sakte hain:</p>
          <a href="https://studio-z.in#/login" style="display:inline-block;background:#FB3640;color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Re-apply →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | admin@studio-z.in se contact karein</div>
      </div>
    `;

  await sendMail({ to: user.email, subject, html, text: approved ? `Your verification was approved!` : `Your verification was rejected. Reason: ${reason}` });
}

// ─── 4. New User Registration Welcome Email ───────────────────────────────────
async function sendWelcomeEmail(user) {
  if (!user.email) return;
  const subject = `Welcome to StudioZ, ${user.fullName}! 🎓`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#FB3640,#B388FF);padding:24px 32px;">
        <h2 style="margin:0;color:#fff;">Welcome to StudioZ! 🚀</h2>
        <p style="margin:4px 0 0;opacity:0.8;">India's Student Economy, Unified</p>
      </div>
      <div style="padding:32px;">
        <p>Namaste <strong>${user.fullName}</strong>,</p>
        <p>StudioZ mein aapka swagat hai! Yahan aap notes, code, aur design assets securely sell kar sakte hain.</p>
        <ul style="color:#A0AAB2;line-height:1.8;">
          <li>✅ Anti-piracy watermarking</li>
          <li>🔒 24-hour escrow protection</li>
          <li>💰 Keep up to 100% earnings (Nexus tier)</li>
        </ul>
        <a href="https://studio-z.in#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:16px;">Get Started →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | admin@studio-z.in</div>
    </div>
  `;
  await sendMail({ to: user.email, subject, html, text: `Welcome to StudioZ, ${user.fullName}!` });
}

module.exports = {
  notifyAdminNewVerification,
  notifyAdminNewPayment,
  notifyUserVerificationResult,
  sendWelcomeEmail,
};
