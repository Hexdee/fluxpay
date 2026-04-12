"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import type { ApiKey } from "@/lib/types";
import { copyToClipboard, createEntityId } from "@/lib/utils";

type RotateApiKeyModalProps = {
  open: boolean;
  onClose: () => void;
  apiKey: ApiKey | null;
  onCompleted: (apiKey: ApiKey) => void;
};

const scopeOptions = [
  "payments:read",
  "payments:write",
  "links:write",
  "webhooks:read",
  "webhooks:write",
];

export default function RotateApiKeyModal({ open, onClose, apiKey, onCompleted }: RotateApiKeyModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [nextLabel, setNextLabel] = useState("");
  const [graceHours, setGraceHours] = useState("24");
  const [scopes, setScopes] = useState<string[]>([]);
  const [autoRevoke, setAutoRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNextLabel(apiKey ? `${apiKey.label} v2` : "");
    setGraceHours("24");
    setScopes(apiKey?.scopes ?? ["payments:read", "payments:write"]);
    setAutoRevoke(false);
    setError(null);
    setSubmitting(false);
    setSecret(null);
  }, [open, apiKey]);

  function toggleScope(scope: string) {
    setScopes((current) => {
      if (current.includes(scope)) {
        return current.filter((item) => item !== scope);
      }
      return [...current, scope];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey) return;
    if (!nextLabel.trim() || !scopes.length) {
      setError("Enter a key name and select at least one scope.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const nextKey: ApiKey = {
      ...apiKey,
      id: createEntityId("key"),
      label: nextLabel.trim(),
      createdAt: now,
      lastRotatedAt: now,
      prefix: `${apiKey.environment.toLowerCase()}_pk_${Math.random().toString(36).slice(2, 5)}`,
      status: "active",
      scopes,
      revealedSecret: null,
    };

    const sunsetAt = new Date(Date.now() + Number(graceHours || 24) * 60 * 60 * 1000).toISOString();

    try {
      await api.updateApiKey(apiKey.id, {
        status: autoRevoke ? "rotating" : apiKey.status,
        sunsetAt: autoRevoke ? sunsetAt : undefined,
        lastRotatedAt: now,
      });
      const created = await api.createApiKey(nextKey);
      setSecret(created.revealedSecret);
      onCompleted(created);
      toast.success("API key rotated.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to rotate the API key.";
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
            <h2 id={titleId}>{secret ? "New secret ready" : "Rotate API key"}</h2>
            <p id={descriptionId} className="cell-muted">
              {secret
                ? "Copy the replacement secret now, or find it later in the API keys table."
                : "Create a replacement secret and keep the old key active for a short grace period."}
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {apiKey ? (
          secret ? (
            <>
              <div className="action-panel">
                <div className="row-copy">
                  <strong>Replacement secret</strong>
                  <span title={secret}>{secret}</span>
                </div>
              </div>
              <div className="footer-actions">
                <span className="cell-muted">The previous key remains active during the grace period.</span>
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
            <>
              <div className="note-row">
                <div className="row-copy">
                  <strong>Selected key</strong>
                  <span>{apiKey.label} · {apiKey.environment}</span>
                </div>
                <span className="status info">{apiKey.status}</span>
              </div>

              <div className="modal-section">
                <h3>Replacement key</h3>
                <div className="modal-grid">
                  <div className="field">
                    <label htmlFor="rotate-label">New key name</label>
                    <input
                      id="rotate-label"
                      className="input"
                      value={nextLabel}
                      onChange={(event) => setNextLabel(event.target.value)}
                      placeholder="Checkout API - Production v2"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="grace-hours">Grace period</label>
                    <select
                      id="grace-hours"
                      className="input"
                      value={graceHours}
                      onChange={(event) => setGraceHours(event.target.value)}
                      disabled={!autoRevoke}
                    >
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="72">72 hours</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-section">
                <h3>Scopes</h3>
                <div className="checkbox-grid">
                  {scopeOptions.map((scope) => (
                    <label key={scope} className="checkbox-card">
                      <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                      <span>{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="toggle-row">
                <div className="row-copy">
                  <strong>Automatically revoke old key later</strong>
                  <span>Schedule the current key for revocation after deployment is complete.</span>
                </div>
                <button
                  className={`toggle-switch${autoRevoke ? " active" : ""}`}
                  type="button"
                  onClick={() => setAutoRevoke((value) => !value)}
                  aria-pressed={autoRevoke}
                />
              </div>

              {error ? <div className="form-error">{error}</div> : null}

              <div className="footer-actions">
                <span className="cell-muted">Notify your team before disabling the old secret.</span>
                <div className="row-actions">
                  <button className="btn btn-secondary" type="button" onClick={onClose}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Rotating..." : "Rotate key"}
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <div className="empty-state">Select a key before rotating it.</div>
        )}
      </form>
      <aside className="modal-side">
        {apiKey ? (
          <>
            <div className="summary-gradient">
              <small>Rotation plan</small>
              <strong>{nextLabel || "v2 key"}</strong>
              <p>{autoRevoke ? "Scheduled with grace period" : "Manual revocation"}</p>
            </div>
            <div className="note-row">
              <div className="row-copy">
                <strong>Current key</strong>
                <span title={apiKey.prefix}>{apiKey.prefix}</span>
              </div>
              <span className="status warn">Live</span>
            </div>
            <div className="note-row">
              <div className="row-copy">
                <strong>Risk</strong>
                <span>Do not revoke the current key until deployments switch to the replacement.</span>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </Modal>
  );
}
