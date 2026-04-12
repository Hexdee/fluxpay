"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { ClipboardIcon } from "@/components/Icons";
import { api } from "@/lib/api";
import type { WebhookEndpoint, WebhookEvent } from "@/lib/types";
import { copyToClipboard, createEntityId } from "@/lib/utils";

const eventOptions = ["payment.created", "payment.succeeded", "payment.refunded", "checkout.expired"];

type WebhookEndpointModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (endpoint: WebhookEndpoint) => void;
  onTested: (event: WebhookEvent, endpoint: WebhookEndpoint) => void;
  endpoint?: WebhookEndpoint | null;
  mode: "create" | "test";
};

export default function WebhookEndpointModal({ open, onClose, onSaved, onTested, endpoint, mode }: WebhookEndpointModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["payment.created", "payment.succeeded"]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(endpoint?.label ?? "");
    setUrl(endpoint?.url ?? "");
    setEvents(endpoint?.events ?? ["payment.created", "payment.succeeded"]);
    setError(null);
    setSubmitting(false);
    setRevealedSecret(null);
  }, [open, endpoint]);

  function toggleEvent(eventName: string) {
    setEvents((current) =>
      current.includes(eventName) ? current.filter((item) => item !== eventName) : [...current, eventName],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "create") {
      if (revealedSecret) {
        onClose();
        return;
      }

      if (label.trim().length < 2 || !url.trim() || !events.length) {
        setError("Enter an endpoint label, URL, and at least one subscribed event.");
        return;
      }

      setSubmitting(true);
      const now = new Date().toISOString();
      const payload: WebhookEndpoint = {
        id: createEntityId("endpoint"),
        label: label.trim(),
        url: url.trim(),
        status: "healthy",
        events,
        retryCount: 0,
        successRate: 100,
        lastResponseCode: 200,
        lastEventAt: now,
        secretLastRotatedAt: now,
      };

      try {
        const created = (await api.createWebhookEndpoint(payload)) as WebhookEndpoint & { revealedSecret?: string };
        onSaved(created);
        setRevealedSecret(created.revealedSecret ?? null);
        toast.success("Webhook endpoint created.");
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Unable to save the endpoint.";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!endpoint) return;

    setSubmitting(true);
    const now = new Date().toISOString();
    const payload: WebhookEvent = {
      id: createEntityId("evt"),
      type: endpoint.events[0] ?? "payment.created",
      endpointId: endpoint.id,
      status: "delivered",
      createdAt: now,
      deliveredAt: now,
      requestId: createEntityId("req"),
      signature: "valid",
      payload: {
        id: createEntityId("evt"),
        type: endpoint.events[0] ?? "payment.created",
        created: now,
        data: {
          source: "manual-test",
        },
      },
      headers: [
        { name: "content-type", value: "application/json" },
        { name: "x-request-id", value: createEntityId("req") },
      ],
      attempts: [
        {
          id: createEntityId("attempt"),
          at: now,
          statusCode: 200,
          note: "Manual test delivery completed successfully.",
        },
      ],
      responseBody: '{"received":true}',
    };

    try {
      const eventRecord = await api.createWebhookEvent(payload);
      const updatedEndpoint = await api.updateWebhookEndpoint(endpoint.id, {
        lastEventAt: now,
        lastResponseCode: 200,
        retryCount: 0,
        status: "healthy",
      });
      onSaved(updatedEndpoint);
      onTested(eventRecord, updatedEndpoint);
      toast.success("Test webhook event sent.");
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to send the test event.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="medium"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={inputRef}
    >
      <form className="modal-main" onSubmit={handleSubmit}>
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>{mode === "create" ? "Add webhook endpoint" : "Send test event"}</h2>
            <p id={descriptionId} className="cell-muted">
              {mode === "create"
                ? revealedSecret
                  ? "Copy the signing secret now, or find it later in the Webhooks table."
                  : "Register a delivery destination and choose which event types it receives."
                : "Send a signed sample payload to confirm the endpoint is reachable."}
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {mode === "create" ? (
          <>
            {revealedSecret ? (
              <>
                <div className="action-panel">
                  <div className="row-copy">
                    <strong>Webhook signing secret</strong>
                    <span title={revealedSecret}>{revealedSecret}</span>
                  </div>
                </div>
                <div className="footer-actions">
                  <span className="cell-muted">Add `FLUXPAY_WEBHOOK_SECRET` to your backend environment.</span>
                  <div className="row-actions">
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => {
                        void copyToClipboard(revealedSecret).then((ok) => {
                          if (ok) {
                            toast.success("Secret copied.");
                          } else {
                            toast.error("Clipboard is unavailable.");
                          }
                        });
                      }}
                    >
                      <ClipboardIcon />
                      Copy secret
                    </button>
                    <button className="btn btn-primary" type="submit">
                      Done
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="endpoint-label">Endpoint label</label>
                  <input
                    id="endpoint-label"
                    ref={inputRef}
                    className="input"
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Primary endpoint"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="endpoint-url">Endpoint URL</label>
                  <input
                    id="endpoint-url"
                    className="input"
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/api/webhooks/primary"
                    required
                  />
                </div>
                <div className="field">
                  <label>Subscribed events</label>
                  <div className="checkbox-grid">
                    {eventOptions.map((eventName) => (
                      <label key={eventName} className="checkbox-card">
                        <input type="checkbox" checked={events.includes(eventName)} onChange={() => toggleEvent(eventName)} />
                        <span>{eventName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : endpoint ? (
          <div className="note-row">
            <div className="row-copy">
              <strong>{endpoint.label}</strong>
              <span>{endpoint.url}</span>
            </div>
            <span className="status info">{endpoint.events[0] ?? "payment.created"}</span>
          </div>
        ) : (
          <div className="empty-state">Choose an endpoint before running a test delivery.</div>
        )}

        {error ? <div className="form-error">{error}</div> : null}

        {mode === "create" && revealedSecret ? null : (
          <div className="footer-actions">
            <span className="cell-muted">{mode === "create" ? "You can rotate the secret after the endpoint is saved." : "A successful test creates a new event log entry."}</span>
            <div className="row-actions">
              <button className="btn btn-secondary" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={submitting || (mode === "test" && !endpoint)}>
                {submitting ? "Saving..." : mode === "create" ? "Save endpoint" : "Send test"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
