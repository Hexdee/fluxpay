"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { verifyEmail } from "@/lib/auth-client";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const initialCode = searchParams.get("code") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await verifyEmail({ email, code });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("fluxpay_merchant_id", result.merchantId);
        window.localStorage.setItem("fluxpay_email", email);
        window.localStorage.setItem("fluxpay_session_token", result.sessionToken);
        window.localStorage.setItem("fluxpay_session_expires_at", result.sessionExpiresAt);
      }
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to verify email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      description="Enter the verification code associated with your account email."
      onSubmit={handleSubmit}
      footer={
        <span>
          Need a new code? <a href="/auth/forgot">Reset password flow can generate one</a>
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
        <label htmlFor="code">Verification code</label>
        <input
          id="code"
          name="code"
          className="input"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
        />
        <span className="field-error">Enter the 6-digit code.</span>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Verifying..." : "Verify email"}
      </button>
      <a className="btn btn-secondary" href="/auth/sign-up">
        Change email
      </a>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Verify your email" description="Loading verification form...">
          <div className="empty-state">Preparing verification form...</div>
        </AuthShell>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
