"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import type { WebhookEndpoint } from "@/lib/types";
import { copyToClipboard } from "@/lib/utils";

type WebhookEndpointActionModalProps = {
  open: boolean;
  onClose: () => void;
  endpoint: WebhookEndpoint | null;
  mode: "rotate" | "toggle";
  onCompleted: (endpoint: WebhookEndpoint) => void;
};

export default function WebhookEndpointActionModal({
  open,
  onClose,
  endpoint,
  mode,
  onCompleted,
}: WebhookEndpointActionModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSecret(null);
    setSubmitting(false);
    setError(null);
  }, [open, endpoint, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!endpoint) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "rotate") {
        const rotated = await api.rotateWebhookSecret();
        const updated = await api.updateWebhookEndpoint(endpoint.id, {
          secretLastRotatedAt: rotated.rotatedAt,
        });
        setSecret(rotated.revealedSecret);
        onCompleted(updated);
        toast.success("Webhook secret rotated.");
      } else {
        const updated = await api.updateWebhookEndpoint(endpoint.id, {
          status: endpoint.status === "paused" ? "healthy" : "paused",
        });
        onCompleted(updated);
        toast.success(
          endpoint.status === "paused"
            ? "Webhook endpoint resumed."
            : "Webhook endpoint paused.",
        );
        onClose();
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to update the endpoint.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopySecret(nextSecret: string) {
    try {
      const copied = await copyToClipboard(nextSecret);
      if (copied) {
        toast.success("Secret copied.");
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy secret.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="medium"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={closeRef}
    >
      <form className="modal-main" onSubmit={handleSubmit}>
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>{mode === "rotate" ? "Rotate webhook secret" : endpoint?.status === "paused" ? "Resume endpoint" : "Pause endpoint"}</h2>
            <p id={descriptionId} className="cell-muted">
              {mode === "rotate"
                ? "Generate a replacement signing secret for this destination."
                : endpoint?.status === "paused"
                  ? "Resume deliveries to this endpoint immediately."
                  : "Pause deliveries until the destination is healthy again."}
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {endpoint ? (
          <>
            <div className="note-row">
              <div className="row-copy">
                <strong>{endpoint.label}</strong>
                <span title={endpoint.url}>{endpoint.url}</span>
              </div>
              <span className="status info">{endpoint.status}</span>
            </div>
            {secret ? (
              <>
                <div className="action-panel">
                  <div className="row-copy">
                    <strong>New signing secret</strong>
                    <span title={secret}>{secret}</span>
                  </div>
                </div>
                <div className="footer-actions">
                  <span className="cell-muted">Update the destination before removing the previous secret.</span>
                  <div className="row-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => void handleCopySecret(secret)}>
                      Copy secret
                    </button>
                    <button className="btn btn-primary" type="button" onClick={onClose}>
                      Done
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="footer-actions">
                <span className="cell-muted">{mode === "rotate" ? "Rotate only after the endpoint owner is ready to update their configuration." : "You can switch the delivery state back at any time."}</span>
                <div className="row-actions">
                  <button className="btn btn-secondary" type="button" onClick={onClose}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : mode === "rotate" ? "Rotate secret" : endpoint.status === "paused" ? "Resume endpoint" : "Pause endpoint"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">Select an endpoint first.</div>
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </form>
    </Modal>
  );
}
