import { config } from './config.js';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type BaseEmailParams = {
  subject: string;
  preheader?: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  footerNote?: string;
};

export function renderEmail(params: BaseEmailParams) {
  const brand = 'FluxPay';
  const preheader = params.preheader ?? '';
  const greeting = params.greeting ?? 'Hi,';

  const text = [
    `${brand} - ${params.subject}`,
    '',
    greeting,
    '',
    ...params.paragraphs,
    params.cta ? '' : null,
    params.cta ? `${params.cta.label}: ${params.cta.href}` : null,
    '',
    params.footerNote ?? `Sent by ${brand}.`,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');

  const htmlParagraphs = params.paragraphs
    .map((p) => `<p style="margin:0 0 12px; color:#334155; line-height:1.55;">${escapeHtml(p)}</p>`)
    .join('');

  const ctaHtml = params.cta
    ? `<div style="margin-top:18px;">
        <a href="${escapeHtml(params.cta.href)}" style="display:inline-block; padding:12px 16px; border-radius:12px; background:#0f172a; color:#ffffff; text-decoration:none; font-weight:700;">
          ${escapeHtml(params.cta.label)}
        </a>
      </div>`
    : '';

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(params.subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f8fafc;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
            <tr>
              <td style="padding:0 8px 14px;">
                <div style="font-weight:900; letter-spacing:-0.02em; color:#0f172a; font-size:18px;">
                  ${escapeHtml(brand)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:22px;">
                <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a; letter-spacing:-0.02em;">
                  ${escapeHtml(params.title)}
                </h1>
                <p style="margin:0 0 14px; color:#475569;">${escapeHtml(greeting)}</p>
                ${htmlParagraphs}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 8px 0; color:#64748b; font-size:12px; line-height:1.45;">
                ${escapeHtml(params.footerNote ?? `Sent by ${brand}.`)}
                <div style="margin-top:6px;">${escapeHtml(config.webOrigin)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: params.subject, text, html };
}

export function verificationCodeEmail(params: {
  name: string;
  code: string;
}) {
  return renderEmail({
    subject: 'Verify your FluxPay account',
    preheader: `Your verification code is ${params.code}.`,
    title: 'Verify your email',
    greeting: `Hi ${params.name},`,
    paragraphs: [
      'Use the verification code below to confirm your email address.',
      `Verification code: ${params.code}`,
      'If you did not create this account, you can ignore this email.',
    ],
    footerNote: 'Codes expire when a new code is issued.',
  });
}

export function passwordResetCodeEmail(params: {
  name: string;
  code: string;
}) {
  return renderEmail({
    subject: 'Reset your FluxPay password',
    preheader: `Your reset code is ${params.code}.`,
    title: 'Reset your password',
    greeting: `Hi ${params.name},`,
    paragraphs: [
      'Use the reset code below to set a new password for your account.',
      `Reset code: ${params.code}`,
      'If you did not request a reset, you can ignore this email.',
    ],
    footerNote: 'Reset codes expire after 15 minutes.',
  });
}

export function paymentCreatedCustomerEmail(params: {
  merchantName: string;
  amount: string;
  currency: string;
  orderId: string | null;
  paymentId: string;
  checkoutUrl: string;
}) {
  const reference = params.orderId ?? params.paymentId;
  return renderEmail({
    subject: `Payment request from ${params.merchantName}`,
    preheader: `Pay ${params.amount} ${params.currency} for ${reference}.`,
    title: 'Complete your payment',
    greeting: 'Hi,',
    paragraphs: [
      `${params.merchantName} created a payment request for you.`,
      `Amount: ${params.amount} ${params.currency}`,
      `Reference: ${reference}`,
      'Open the hosted checkout to complete payment.',
    ],
    cta: { label: 'Pay now', href: params.checkoutUrl },
    footerNote: 'Do not share this link publicly.',
  });
}

export function paymentReceiptCustomerEmail(params: {
  merchantName: string;
  status: 'succeeded' | 'failed' | 'expired';
  amount: string;
  currency: string;
  orderId: string | null;
  paymentId: string;
  txHash: string | null;
}) {
  const reference = params.orderId ?? params.paymentId;
  const statusLabel =
    params.status === 'succeeded'
      ? 'Payment successful'
      : params.status === 'expired'
        ? 'Payment expired'
        : 'Payment failed';

  return renderEmail({
    subject: `${statusLabel} - ${params.merchantName}`,
    preheader: `${statusLabel} for ${reference}.`,
    title: statusLabel,
    greeting: 'Hi,',
    paragraphs: [
      `Merchant: ${params.merchantName}`,
      `Amount: ${params.amount} ${params.currency}`,
      `Reference: ${reference}`,
      `Payment ID: ${params.paymentId}`,
      params.txHash ? `Transaction hash: ${params.txHash}` : 'Transaction hash: unavailable',
    ],
    footerNote: 'Keep this email for your records.',
  });
}

