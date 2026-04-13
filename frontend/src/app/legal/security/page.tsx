import Link from "next/link";
import Brand from "@/components/Brand";

export default function SecurityPage() {
  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className="status ok">Security</span>
        </div>
        <div className="state-body">
          <h1>Security overview</h1>
          <p className="cell-muted">
            FluxPay signs webhook payloads, enforces API key checks for merchant payment endpoints,
            and uses session tokens for dashboard access. Merchants should enable endpoint
            verification and restrict key scope by environment.
          </p>
          <div className="state-rows">
            <div className="state-row">
              <span>Webhook integrity</span>
              <strong>HMAC + timestamp verification</strong>
            </div>
            <div className="state-row">
              <span>Dashboard access</span>
              <strong>Session token required</strong>
            </div>
            <div className="state-row">
              <span>Recommendation</span>
              <strong>Rotate keys and secrets periodically</strong>
            </div>
          </div>
          <div className="state-actions">
            <Link className="btn btn-primary" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
