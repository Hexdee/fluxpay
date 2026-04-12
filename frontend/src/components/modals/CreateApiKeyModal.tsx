
"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import type { ApiKey } from "@/lib/types";
import { copyToClipboard, createEntityId } from "@/lib/utils";

const scopeOptions = [
  "payments:read",
  "payments:write",
  "links:write",
  "webhooks:read",
  "webhooks:write",
];

type CreateApiKeyModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (apiKey: ApiKey) => void;
  ownerName: string;
};

export default function CreateApiKeyModal({ open, onClose, onCreated, ownerName }: CreateApiKeyModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState<ApiKey["environment"]>("Live");
  const [scopes, setScopes] = useState<string[]>(["payments:read", "payments:write"]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setEnvironment("Live");
    setScopes(["payments:read", "payments:write"]);
    setError(null);
    setSubmitting(false);
    setRevealedSecret(null);
  }, [open]);

  const canSubmit = label.trim().length > 2 && scopes.length > 0;
  const prefix = useMemo(
    () => `${environment.toLowerCase()}_pk_${Math.random().toString(36).slice(2, 5)}`,
    [environment],
  );

  function toggleScope(scope: string) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Provide a label and select at least one scope.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const payload: ApiKey = {
      id: createEntityId("key"),
      label: label.trim(),
      environment,
      createdAt: now,
      owner: ownerName,
      status: "active",
      lastRotatedAt: now,
      scopes,
      prefix,
      revealedSecret: null,
    };

    try {
      const created = await api.createApiKey(payload);
      setRevealedSecret(created.revealedSecret);
      onCreated(created);
      toast.success("API key created.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to create the API key.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopySecret(secret: string) {
    try {
      const copied = await copyToClipboard(secret);
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
      size="large"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={inputRef}
    >
      <form className="modal-main" onSubmit={handleSubmit}>
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>{revealedSecret ? "API key created" : "Create API key"}</h2>
            <p id={descriptionId} className="cell-muted">
              {revealedSecret
                ? "Copy the secret now, or find it later in the API keys table."
                : "Provision a key for a specific environment and scope set."}
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {revealedSecret ? (
          <>
            <div className="action-panel">
              <div className="row-copy">
                <strong>Secret</strong>
                <span title={revealedSecret}>{revealedSecret}</span>
              </div>
            </div>
            <div className="footer-actions">
              <span className="cell-muted">Store this secret in your vault before leaving the modal.</span>
              <div className="row-actions">
                <button className="btn btn-secondary" type="button" onClick={() => void handleCopySecret(revealedSecret)}>
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
            <div className="field">
              <label htmlFor="key-label">Key label</label>
              <input
                id="key-label"
                ref={inputRef}
                className="input"
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Production server"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="key-environment">Environment</label>
              <select
                id="key-environment"
                className="input"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as ApiKey["environment"])}
              >
                <option value="Live">Live</option>
                <option value="Test">Test</option>
                <option value="Staging">Staging</option>
              </select>
            </div>

            <div className="field">
              <label>Scopes</label>
              <div className="checkbox-grid">
                {scopeOptions.map((scope) => (
                  <label key={scope} className="checkbox-card">
                    <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                    <span>{scope}</span>
                  </label>
                ))}
              </div>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <div className="footer-actions">
              <span className="cell-muted">This key will be logged in the audit trail and can be rotated later.</span>
              <div className="row-actions">
                <button className="btn btn-secondary" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? "Creating..." : "Create key"}
                </button>
              </div>
            </div>
          </>
        )}
      </form>
      <aside className="modal-side">
        <div className="summary-box">
          <small>Prefix</small>
          <strong>{prefix}</strong>
          <p className="cell-muted">Limit scopes to the minimum the integration needs.</p>
        </div>
        <div className="note-row">
          <div className="row-copy">
            <strong>Recommended rotation</strong>
            <span>Rotate live credentials every 90 days.</span>
          </div>
        </div>
      </aside>
    </Modal>
  );
}
