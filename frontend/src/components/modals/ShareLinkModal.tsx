"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { ClipboardIcon, ExternalLinkIcon, QrCodeIcon } from "@/components/Icons";
import type { PaymentLink } from "@/lib/types";
import { copyToClipboard } from "@/lib/utils";

type ShareLinkModalProps = {
  open: boolean;
  onClose: () => void;
  link: PaymentLink | null;
};

export default function ShareLinkModal({ open, onClose, link }: ShareLinkModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  useEffect(() => {
    if (!open) return;

    if (!link) return;
    QRCode.toDataURL(link.url, {
      margin: 1,
      width: 220,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then(setQrUrl).catch(() => setQrUrl(null));
  }, [open, link]);

  async function handleCopy() {
    if (!link) return;
    try {
      const success = await copyToClipboard(link.url);
      setCopied(success);
      if (success) {
        toast.success("Link copied.");
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy link.");
    }
  }

  async function copyShortLink() {
    if (!link) return;
    let short = `${link.url.replace(/\/+$/, "")}/l/${link.slug}`;
    try {
      const origin = new URL(link.url).origin;
      short = `${origin}/l/${link.slug}`;
    } catch {
      // Keep fallback derived from link.url when URL parsing fails.
    }
    try {
      const copied = await copyToClipboard(short);
      if (copied) {
        toast.success("Short link copied.");
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy short link.");
    }
  }

  async function copyEmbedText() {
    if (!link) return;
    const embed = `<a href="${link.url}" rel="noreferrer">Pay now</a>`;
    try {
      const copied = await copyToClipboard(embed);
      if (copied) {
        toast.success("Embed text copied.");
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy embed text.");
    }
  }

  function handleDownloadQr() {
    if (!qrUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrUrl;
    anchor.download = `${link?.slug ?? "checkout-link"}-qr.png`;
    anchor.click();
    toast.success("QR code download started.");
  }

  const defaultMessage = link
    ? `Hi - here is your payment link for ${link.title}: ${link.url}`
    : "";
  const messageValue = messageDraft || defaultMessage;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={closeRef}
    >
      <div className="modal-main">
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>Share payment link</h2>
            <p id={descriptionId} className="cell-muted">
              Copy the checkout URL, use quick-share actions, or generate a QR code for customers.
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {link ? (
          <>
            <div className="qr-grid">
              <div className="qr-box qr-box-image">
                {qrUrl ? (
                  <Image src={qrUrl} alt={`QR code for ${link.title}`} width={220} height={220} unoptimized />
                ) : (
                  <QrCodeIcon />
                )}
              </div>
              <div className="detail-list">
                <div className="detail-item">
                  <span>Checkout URL</span>
                  <strong title={link.url}>{link.url}</strong>
                </div>
                <div className="detail-item">
                  <span>Status</span>
                  <strong>{link.status}</strong>
                </div>
                <div className="detail-item">
                  <span>Amount</span>
                  <strong>{link.amount.toFixed(2)} {link.currency}</strong>
                </div>
              </div>
            </div>
            <div className="modal-section">
              <h3>Quick share</h3>
              <div className="quick-share-grid">
                <button className="btn btn-secondary" type="button" onClick={handleCopy}>
                  Copy link
                </button>
                <button className="btn btn-secondary" type="button" onClick={copyShortLink}>
                  Copy short link
                </button>
                <button className="btn btn-secondary" type="button" onClick={copyEmbedText}>
                  Copy embed text
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="share-message">Share message</label>
              <textarea
                id="share-message"
                className="modal-textarea"
                value={messageValue}
                onChange={(event) => setMessageDraft(event.target.value)}
              />
            </div>
            <div className="footer-actions">
              <span className="cell-muted">Visits and completed payments are tracked automatically.</span>
              <div className="row-actions">
                <button className="btn btn-secondary" type="button" onClick={handleCopy}>
                  <ClipboardIcon />
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleDownloadQr} disabled={!qrUrl}>
                  <QrCodeIcon />
                  Download QR
                </button>
                <a className="btn btn-primary" href={link.url} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  Open link
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Select a link before sharing it.</div>
        )}
      </div>
      <aside className="modal-side">
        {link ? (
          <>
            <div className="summary-gradient">
              <small>Link preview</small>
              <strong>{link.amount.toFixed(2)} {link.currency}</strong>
              <p>{link.title}</p>
            </div>
            <div className="modal-section">
              <h3>QR code</h3>
              <div className="qr-grid">
                <div className="qr-box qr-box-image">
                  {qrUrl ? (
                    <Image src={qrUrl} alt={`QR code for ${link.title}`} width={220} height={220} unoptimized />
                  ) : (
                    <QrCodeIcon />
                  )}
                </div>
                <div>
                  <p className="cell-muted">Useful for in-person payments, screenshots, and second-device flow.</p>
                  <button className="btn btn-secondary" type="button" onClick={handleDownloadQr} disabled={!qrUrl}>
                    Download QR
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </Modal>
  );
}
