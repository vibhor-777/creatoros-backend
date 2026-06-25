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
        <p>A new student has registered by uploading their School ID card. Please review this request:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;width:140px;">Student Name</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-weight:bold;">${user.fullName}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Username</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">@${user.username}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Email</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${user.email}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Institution</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${user.institution?.name || user.institution || 'Not provided'}</td></tr>
          <tr><td style="padding:10px;color:#A0AAB2;">Registered At</td><td style="padding:10px;">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
        <p>You can review the uploaded ID Card image in the admin control center:</p>
        <a href="https://admin.studio-z.in" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Open Admin Dashboard →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">
        StudioZ | admin@studio-z.in | This is an automated notification.
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
        <p>A new purchase payment has been received and is currently held in escrow.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;width:140px;">Buyer</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-weight:bold;">${buyer}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Product</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${product}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Amount</td><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#00E676;font-size:20px;font-weight:800;">₹${amount}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Transaction ID</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-size:11px;">${transactionId}</td></tr>
          <tr><td style="padding:10px;color:#A0AAB2;">Time</td><td style="padding:10px;">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
        <p>Funds will automatically release to the seller after the 24-hour escrow protection period. To manually manage or bypass escrow:</p>
        <a href="https://admin.studio-z.in" style="display:inline-block;background:linear-gradient(135deg,#00E676,#00C853);color:#000;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Open Admin Dashboard →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">
        StudioZ | admin@studio-z.in | This is an automated notification.
      </div>
    </div>
  `;

  await sendMail({ to: ADMIN_EMAIL, subject, html, text: `New payment of ₹${amount} by ${buyer} for "${product}" (Txn: ${transactionId})` });
}

// ─── 3. Send verification result to USER ─────────────────────────────────────
async function notifyUserVerificationResult(user, approved, reason) {
  if (!user.email) return;

  const subject = approved
    ? `[StudioZ] 🎉 Your seller verification request has been approved!`
    : `[StudioZ] Seller verification request rejected`;

  const html = approved
    ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#00E676,#00C853);padding:20px 32px;">
          <h2 style="margin:0;color:#000;">🎉 Verification Approved!</h2>
        </div>
        <div style="padding:32px;">
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>Your StudioZ seller verification has been successfully approved! You can now start listing and selling your digital notes, code, design assets, and freelance services.</p>
          <a href="https://studio-z.in/#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:16px;">Start Selling Now →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | India's Student Economy, Unified</div>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#FB3640;padding:20px 32px;">
          <h2 style="margin:0;color:#fff;">Verification Request Rejected</h2>
        </div>
        <div style="padding:32px;">
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>We regret to inform you that your seller verification request has been rejected.</p>
          ${reason ? `<div style="background:#0e1b17;border-left:3px solid #FB3640;padding:12px 16px;border-radius:4px;margin:16px 0;"><strong>Reason for Rejection:</strong> ${reason}</div>` : ''}
          <p>Please re-apply from your dashboard with clear, valid student identity documents:</p>
          <a href="https://studio-z.in/#/login" style="display:inline-block;background:#FB3640;color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Re-apply Now →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | Please contact admin@studio-z.in for questions.</div>
      </div>
    `;

  await sendMail({ to: user.email, subject, html, text: approved ? `Your verification request was approved!` : `Your verification request was rejected. Reason: ${reason}` });
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
        <p>Hello <strong>${user.fullName}</strong>,</p>
        <p>Welcome to StudioZ! We are thrilled to have you join our student economy. You can now securely list, buy, and sell digital notes, templates, assets, and freelance gigs.</p>
        <ul style="color:#A0AAB2;line-height:1.8;">
          <li>✅ Anti-piracy dynamic watermarking</li>
          <li>🔒 24-hour secure escrow protection</li>
          <li>💰 Earn up to 100% of your listed price (Elite & Nexus tiers)</li>
        </ul>
        <a href="https://studio-z.in/#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:16px;">Get Started →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | admin@studio-z.in</div>
    </div>
  `;
  await sendMail({ to: user.email, subject, html, text: `Welcome to StudioZ, ${user.fullName}!` });
}

// ─── 5. Send Verification OTP ──────────────────────────────────────────────────
async function sendVerificationOtp(email, fullName, otp) {
  const subject = `[StudioZ] Email Verification OTP: ${otp}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#FB3640,#B388FF);padding:24px 32px;">
        <h2 style="margin:0;color:#fff;">Verify Your Email 🔒</h2>
        <p style="margin:4px 0 0;opacity:0.8;">StudioZ Security Code</p>
      </div>
      <div style="padding:32px;">
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>Thank you for signing up with StudioZ! Please enter the 6-digit OTP code below to verify your college email address and instantly activate your account:</p>
        <div style="background:#0e1b17;border:1px dashed #B388FF;padding:16px;border-radius:8px;text-align:center;margin:24px 0;">
          <span style="font-size:32px;letter-spacing:6px;font-weight:bold;color:#B388FF;font-family:monospace;">${otp}</span>
        </div>
        <p>This code is valid for 15 minutes. If you did not request this, please ignore this email.</p>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | admin@studio-z.in</div>
    </div>
  `;
  await sendMail({ to: email, subject, html, text: `Your StudioZ verification code is: ${otp}` });
}

// ─── 6. New Product Submission to Admin ──────────────────────────────────────
async function notifyAdminNewProduct(user, product) {
  const subject = `[StudioZ] New Product Submission — "${product.title}" by ${user.fullName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#B388FF,#7C4DFF);padding:20px 32px;">
        <h2 style="margin:0;color:#fff;">📦 New Product Submitted</h2>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">StudioZ Admin Alert</p>
      </div>
      <div style="padding:32px;">
        <p>A new product has been submitted for review:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;width:140px;">Title</td><td style="padding:10px;border-bottom:1px solid #1a2e28;font-weight:bold;">${product.title}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Category</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${product.category || '—'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Type</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${product.productType || 'digital'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Price</td><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#00E676;font-weight:700;">₹${product.pricing?.amount || 0}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #1a2e28;color:#A0AAB2;">Creator</td><td style="padding:10px;border-bottom:1px solid #1a2e28;">${user.fullName} (@${user.username})</td></tr>
          <tr><td style="padding:10px;color:#A0AAB2;">Creator Email</td><td style="padding:10px;">${user.email}</td></tr>
        </table>
        <a href="https://admin.studio-z.in" style="display:inline-block;background:linear-gradient(135deg,#B388FF,#7C4DFF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Review in Admin Panel →</a>
      </div>
      <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | admin@studio-z.in | This is an automated notification.</div>
    </div>
  `;
  await sendMail({ to: ADMIN_EMAIL, subject, html, text: `New product submission: "${product.title}" by ${user.fullName} (₹${product.pricing?.amount || 0})` });
}


async function notifyProductModerationResult(user, product, approved, reason) {
  if (!user.email) return;

  const subject = approved
    ? `[StudioZ] 🎉 Your product listing "${product.title}" has been approved!`
    : `[StudioZ] Product listing "${product.title}" was not approved`;

  const html = approved
    ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#00E676,#00C853);padding:20px 32px;">
          <h2 style="margin:0;color:#000;">🎉 Listing Approved!</h2>
          <p style="margin:4px 0 0;opacity:0.7;font-size:13px;color:#000;">StudioZ Product Review</p>
        </div>
        <div style="padding:32px;">
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>Great news! Your product listing has been reviewed and approved by our team. It is now live on the StudioZ marketplace.</p>
          <div style="background:#0e1b17;border:1px solid #00E676;padding:16px;border-radius:8px;margin:16px 0;">
            <strong style="color:#00E676;">📦 ${product.title}</strong>
            <div style="font-size:12px;color:#A0AAB2;margin-top:4px;">₹${product.pricing?.amount || 0} · ${product.category || 'General'}</div>
          </div>
          <p>Students can now discover and purchase your listing from The Vault.</p>
          <a href="https://studio-z.in/#/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FB3640,#B388FF);color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:16px;">View Dashboard →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | India's Student Economy, Unified</div>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1411;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#FB3640;padding:20px 32px;">
          <h2 style="margin:0;color:#fff;">Listing Not Approved</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">StudioZ Product Review</p>
        </div>
        <div style="padding:32px;">
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>Thank you for submitting your listing on StudioZ. Unfortunately, your listing <strong>"${product.title}"</strong> was not approved by our moderation team.</p>
          ${reason ? `<div style="background:#0e1b17;border-left:3px solid #FB3640;padding:12px 16px;border-radius:4px;margin:16px 0;"><strong>Reason:</strong> ${reason}</div>` : ''}
          <p>You are welcome to update your listing and re-submit. Please ensure your product complies with our community guidelines:</p>
          <ul style="color:#A0AAB2;line-height:1.8;">
            <li>Provide clear, accurate product descriptions</li>
            <li>Do not submit plagiarised or copyrighted content</li>
            <li>Ensure your product has educational or creative value</li>
          </ul>
          <a href="https://studio-z.in/#/dashboard" style="display:inline-block;background:#FB3640;color:#fff;padding:12px 24px;border-radius:30px;text-decoration:none;font-weight:bold;margin-top:8px;">Go to Dashboard →</a>
        </div>
        <div style="padding:16px 32px;background:#050e0a;font-size:11px;color:#A0AAB2;">StudioZ | Please contact admin@studio-z.in for questions.</div>
      </div>
    `;

  await sendMail({
    to: user.email,
    subject,
    html,
    text: approved
      ? `Your listing "${product.title}" has been approved and is now live!`
      : `Your listing "${product.title}" was not approved. Reason: ${reason || 'See guidelines'}`
  });
}

module.exports = {
  notifyAdminNewVerification,
  notifyAdminNewPayment,
  notifyAdminNewProduct,
  notifyUserVerificationResult,
  sendWelcomeEmail,
  sendVerificationOtp,
  notifyProductModerationResult,
};


