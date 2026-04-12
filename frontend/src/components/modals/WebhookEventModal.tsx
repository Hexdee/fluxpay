"use client";

import { useId, useRef } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { ClipboardIcon, RefreshIcon } from "@/components/Icons";
import TruncateCopy from "@/components/TruncateCopy";
import { copyToClipboard, statusTone } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Payment, WebhookEndpoint, WebhookEvent } from "@/lib/types";

type WebhookEventModalProps = {
  open: boolean;
  onClose: () => void;
  event: WebhookEvent | null;
  endpoint: WebhookEndpoint | null;
  payment: Payment | null;
  canResend?: boolean;
  onResend: (event: WebhookEvent) => void;
};

export default function WebhookEventModal({
  open,
  onClose,
  event,
  endpoint,
  payment,
  canResend = true,
  onResend,
}: WebhookEventModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  function attemptTone(statusCode: number) {
    if (statusCode >= 500) return "red";
    if (statusCode >= 400) return "warn";
    return "cyan";
  }

  async function handleCopyPayload(payload: Record<string, unknown>) {
    try {
      const copied = await copyToClipboard(JSON.stringify(payload, null, 2));
      if (copied) {
        toast.success("Webhook payload copied.");
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy payload.");
    }
  }

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
            <h2 id={titleId}>Webhook event detail</h2>
            <p id={descriptionId} className="cell-muted">
              Inspect payloads, delivery attempts, and endpoint responses before replaying an event.
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {event ? (
          <>
            <div className="note-row">
              <div className="row-copy">
                <strong>{event.type}</strong>
                <span>
                  Request ID <TruncateCopy value={event.requestId} label="Copy request ID" />
                </span>
              </div>
              <span className={`status ${statusTone(event.status)}`}>{event.status}</span>
            </div>

            <div className="detail-list two-column-list">
              <div className="detail-item"><span>Created</span><strong>{formatDateTime(event.createdAt)}</strong></div>
              <div className="detail-item"><span>Last delivery</span><strong>{formatRelativeTime(event.deliveredAt)}</strong></div>
              <div className="detail-item"><span>Endpoint</span><strong title={endpoint?.url ?? event.endpointId}>{endpoint?.url ?? event.endpointId}</strong></div>
              <div className="detail-item"><span>Signature</span><strong>{event.signature}</strong></div>
              <div className="detail-item">
                <span>Payment</span>
                <strong>
                  {payment?.id || event.paymentId ? (
                    <TruncateCopy value={(payment?.id ?? event.paymentId) as string} label="Copy payment ID" />
                  ) : (
                    "Unknown"
                  )}
                </strong>
              </div>
              <div className="detail-item"><span>Attempts</span><strong>{event.attempts.length}</strong></div>
            </div>

            <div className="action-panel">
              <div className="row-copy">
                <strong>Headers</strong>
                <span>Exact headers recorded for the latest delivery attempt.</span>
              </div>
              <div className="detail-list">
                {event.headers.map((header) => (
                  <div className="detail-item" key={header.name}>
                    <span>{header.name}</span>
                    <strong title={header.value}>{header.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="action-panel">
              <div className="row-copy">
                <strong>Payload</strong>
                <span>Signed payload delivered to the destination endpoint.</span>
              </div>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </div>

            <div className="action-panel">
              <div className="row-copy">
                <strong>Response</strong>
                <span>Latest destination response body and status details.</span>
              </div>
              <pre>{event.responseBody || "No response body captured."}</pre>
            </div>

            <div className="action-panel">
              <div className="row-copy">
                <strong>Delivery history</strong>
                <span>Each attempt includes the response code and the retry note.</span>
              </div>
              <div className="detail-list">
                {event.attempts.length ? (
                  event.attempts.map((attempt) => (
                    <div className="note-row" key={attempt.id}>
                      <div className="row-copy">
                        <strong>{attempt.statusCode}</strong>
                        <span>{attempt.note}</span>
                      </div>
                      <span className="cell-muted">{formatDateTime(attempt.at)}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No delivery attempts have been made yet.</div>
                )}
              </div>
            </div>

            <div className="footer-actions">
              <span className="cell-muted">Delivery logs are retained for 30 days.</span>
              <div className="row-actions">
                <button className="btn btn-secondary" type="button" onClick={() => void handleCopyPayload(event.payload)}>
                  <ClipboardIcon />
                  Copy payload
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => onResend(event)}
                  disabled={!canResend}
                  title={
                    canResend
                      ? "Resend this webhook event"
                      : "Configure a webhook endpoint to resend events"
                  }
                >
                  <RefreshIcon />
                  Resend event
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Select an event to inspect delivery details.</div>
        )}
      </div>
      <aside className="modal-side">
        {event ? (
          <>
            <div className="summary-gradient">
              <small>Delivery status</small>
              <strong>{event.status}</strong>
              <p>{endpoint ? `${endpoint.label} · ${endpoint.lastResponseCode}` : "Endpoint unavailable"}</p>
            </div>
            <div className="modal-section">
              <h3>Retry timeline</h3>
              <div className="attempt-timeline">
                {event.attempts.length ? (
                  event.attempts.map((attempt) => (
                    <div className="timeline-item" key={attempt.id}>
                      <div className="timeline-rail">
                        <span className={`timeline-dot ${attemptTone(attempt.statusCode)}`}></span>
                      </div>
                      <div className="attempt-card">
                        <div className="attempt-top">
                          <strong>{attempt.note}</strong>
                          <span className={`status ${attempt.statusCode >= 500 ? "error" : attempt.statusCode >= 400 ? "warn" : "info"}`}>
                            {attempt.statusCode}
                          </span>
                        </div>
                        <p className="cell-muted">{formatDateTime(attempt.at)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No attempts yet.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </Modal>
  );
}
