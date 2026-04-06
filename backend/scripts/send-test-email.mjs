import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const to = process.argv[2] || process.env.TEST_EMAIL_TO;
if (!to) {
  console.error("Usage: node scripts/send-test-email.mjs <to-email>");
  process.exit(1);
}

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const secure = process.env.SMTP_SECURE === "true" || port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM;

if (!host || !user || !pass || !from) {
  console.error("Missing SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM in backend/.env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
});

await transporter.verify();
const info = await transporter.sendMail({
  from,
  to,
  subject: "FluxPay SMTP test",
  text: "If you received this, SMTP is working for FluxPay backend.",
  html: "<p>If you received this, SMTP is working for <strong>FluxPay</strong> backend.</p>",
});

console.log(JSON.stringify({ accepted: info.accepted, rejected: info.rejected, messageId: info.messageId }, null, 2));

