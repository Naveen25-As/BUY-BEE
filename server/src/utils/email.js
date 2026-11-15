import nodemailer from 'nodemailer';

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendResetEmail(to, resetUrl) {
  const transport = getTransport();
  if (!transport) {
    console.log('[BUY BEE] Password reset URL (dev):', resetUrl);
    return;
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@buybee.com',
    to,
    subject: 'BUY BEE — Reset your password',
    html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link expires in 1 hour.</p>`,
  });
}
