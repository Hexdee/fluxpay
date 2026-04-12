
"use client";

import { FormEvent, useId, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import type { PaymentLink } from "@/lib/types";

type PauseLinkModalProps = {
  open: boolean;
  onClose: () => void;
  link: PaymentLink | null;
  mode: "pause" | "resume";
  onCompleted: (link: PaymentLink) => void;
  walletConfigured?: boolean;
};

export default function PauseLinkModal({ open, onClose, link, mode, onCompleted, walletConfigured = true }: PauseLinkModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link) return;
    if (mode === "resume" && !walletConfigured) {
      const message = "Add a payout wallet address in Settings before activating payment links.";
      setError(message);
      toast.error(message);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await api.updatePaymentLink(link.id, {
        status: mode === "pause" ? "paused" : "active",
        updatedAt: new Date().toISOString(),
      });
      onCompleted(updated);
      toast.success(mode === "pause" ? "Payment link paused." : "Payment link resumed.");
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to update the payment link.";
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
      size="compact"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={closeRef}
    >
      <form className="modal-main" onSubmit={handleSubmit}>
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>{mode === "pause" ? "Pause payment link" : "Resume payment link"}</h2>
            <p id={descriptionId} className="cell-muted">
              {mode === "pause"
                ? "Pausing stops new visitors from paying until you turn the link back on."
                : "Resuming makes the link available to customers again immediately."}
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {link ? (
          <>
            <div className="note-row">
              <div className="row-copy">
                <strong>{link.title}</strong>
                <span>{link.url}</span>
              </div>
              <span className={`status ${mode === "pause" ? "warn" : "ok"}`}>{mode === "pause" ? "Will pause" : "Will resume"}</span>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="footer-actions">
              <span className="cell-muted">You can change this state again at any time.</span>
              <div className="row-actions">
                <button className="btn btn-secondary" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={submitting || (mode === "resume" && !walletConfigured)}>
                  {submitting ? "Saving..." : mode === "pause" ? "Pause link" : "Resume link"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Select a link before updating its status.</div>
        )}
      </form>
    </Modal>
  );
}
