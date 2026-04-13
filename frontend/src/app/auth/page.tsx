"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { login } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await login({ email, password });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("fluxpay_merchant_id", response.merchantId);
        window.localStorage.setItem("fluxpay_email", response.email);
        window.localStorage.setItem("fluxpay_remember", remember ? "1" : "0");
        window.localStorage.setItem("fluxpay_session_token", response.sessionToken);
        window.localStorage.setItem("fluxpay_session_expires_at", response.sessionExpiresAt);
      }
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage payments, create checkout links, and monitor settlement events."
      onSubmit={handleSubmit}
      footer={
        <span>
          New to FluxPay? <a href="/auth/sign-up">Create an account</a>
        </span>
      }
    >
      <div className="field">
        <label htmlFor="email">Email address</label>
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
          placeholder="Enter your password"
          autoComplete="current-password"
          minLength={8}
          required
        />
        <span className="field-error">Password must be at least 8 characters.</span>
      </div>
      <div className="form-row">
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Keep me signed in
        </label>
        <a href="/auth/forgot">Forgot password?</a>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </AuthShell>
  );
}
