"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { signup } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await signup({ name, email, password });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("fluxpay_merchant_id", response.merchantId);
        window.localStorage.setItem("fluxpay_session_token", response.sessionToken);
        window.localStorage.setItem("fluxpay_session_expires_at", response.sessionExpiresAt);
      }
      const codeQuery = response.devVerificationCode
        ? `&code=${encodeURIComponent(response.devVerificationCode)}`
        : "";
      router.push(`/auth/verify?email=${encodeURIComponent(email)}${codeQuery}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Set up your team, branding, and payout wallet, then start accepting USDT0 payments."
      onSubmit={handleSubmit}
      footer={
        <span>
          Already have an account? <a href="/auth">Sign in</a>
        </span>
      }
    >
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          name="name"
          className="input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Full name"
          autoComplete="name"
          required
        />
        <span className="field-error">Enter your full name.</span>
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
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
        <span className="field-error">Enter a valid email address.</span>
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-error">Password must be at least 8 characters.</span>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating account..." : "Create account"}
      </button>
    </AuthShell>
  );
}
