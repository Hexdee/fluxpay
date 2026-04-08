import nodemailer from "nodemailer";
import { config } from "./config.js";
import {
  passwordResetCodeEmail,
  paymentCreatedCustomerEmail,
  paymentReceiptCustomerEmail,
  verificationCodeEmail,
} from "./email-templates.js";

function effectiveSmtpSecure() {
  // Many providers use STARTTLS on 587. If the env is misconfigured as
  // secure=true + port=587, nodemailer can hang on connect. Be forgiving.
  if (config.smtpPort === 587) return false;
  return config.smtpSecure;
}

const transporter = config.smtpEnabled
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: effectiveSmtpSecure(),
      // Fail fast in request paths; email is best-effort for this MVP.
      connectionTimeout: Math.min(config.smtpSendTimeoutMs, 5000),
      greetingTimeout: Math.min(config.smtpSendTimeoutMs, 5000),
      socketTimeout: Math.max(config.smtpSendTimeoutMs, 7000),
      requireTLS: config.smtpPort === 587,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
    })
  : null;

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (!transporter) {
    return false;
  }

  try {
    const sendPromise = transporter.sendMail({
      from: config.smtpFrom,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    const timed = await Promise.race([
      sendPromise,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("SMTP send timeout")), config.smtpSendTimeoutMs),
      ),
    ]).catch((error) => {
      // Prevent unhandled rejections if sendPromise resolves/rejects later.
      void sendPromise.catch(() => null);
      throw error;
    });

    void timed;
    return true;
  } catch (error) {
    console.error("Email delivery failed", error);
    return false;
  }
}

export function isEmailDeliveryEnabled() {
  return config.smtpEnabled;
}

export function sendVerificationCodeEmail(params: {
  to: string;
  name: string;
  code: string;
}) {
  const email = verificationCodeEmail({ name: params.name, code: params.code });
  return sendEmail({ to: params.to, ...email });
}

export function sendPasswordResetCodeEmail(params: {
  to: string;
  name: string;
  code: string;
}) {
  const email = passwordResetCodeEmail({ name: params.name, code: params.code });
  return sendEmail({ to: params.to, ...email });
}

export function sendCustomerPaymentCreatedEmail(params: {
  to: string;
  merchantName: string;
  amount: string;
  currency: string;
  orderId: string | null;
  paymentId: string;
  checkoutUrl: string;
}) {
  const email = paymentCreatedCustomerEmail({
    merchantName: params.merchantName,
    amount: params.amount,
    currency: params.currency,
    orderId: params.orderId,
    paymentId: params.paymentId,
    checkoutUrl: params.checkoutUrl,
  });
  return sendEmail({ to: params.to, ...email });
}

export function sendCustomerPaymentReceiptEmail(params: {
  to: string;
  merchantName: string;
  status: "succeeded" | "failed" | "expired";
  amount: string;
  currency: string;
  orderId: string | null;
  paymentId: string;
  txHash: string | null;
}) {
  const email = paymentReceiptCustomerEmail({
    merchantName: params.merchantName,
    status: params.status,
    amount: params.amount,
    currency: params.currency,
    orderId: params.orderId,
    paymentId: params.paymentId,
    txHash: params.txHash,
  });
  return sendEmail({ to: params.to, ...email });
}
