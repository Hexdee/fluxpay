"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { resetPassword } from "@/lib/auth-client";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetEmail = searchParams.get("email") ?? "";
  const presetCode = searchParams.get("code") ?? "";

  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState(presetCode);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirm) {
      setError("Passwords must match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await resetPassword({ email, code, password });
      router.push("/auth");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      description="Enter the reset code and choose a new password for your FluxPay account."
      onSubmit={handleSubmit}
      footer={
        <span>
          Need help? <a href="/auth/forgot">Request another code</a>
        </span>
      }
    >
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="code">Reset code</label>
        <input
          id="code"
          name="code"
          className="input"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a new password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-error">Password must be at least 8 characters.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          className="input"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Confirm your password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-error">Passwords must match.</span>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Updating..." : "Update password"}
      </button>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Reset password"
          description="Loading reset session..."
        >
          <div className="empty-state">Preparing reset form...</div>
        </AuthShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
