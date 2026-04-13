import Link from "next/link";
import Brand from "@/components/Brand";

export default function PrivacyPage() {
  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className="status info">Legal</span>
        </div>
        <div className="state-body">
          <h1>Privacy policy</h1>
          <p className="cell-muted">
            FluxPay processes merchant account details, payment metadata, and delivery telemetry to
            operate checkout and webhook services. Sensitive secrets are stored hashed where
            possible and should be rotated regularly by merchants.
          </p>
          <div className="state-rows">
            <div className="state-row">
              <span>Collected data</span>
              <strong>Account and payment metadata</strong>
            </div>
            <div className="state-row">
              <span>Retention</span>
              <strong>Operational history and logs</strong>
            </div>
            <div className="state-row">
              <span>Merchant controls</span>
              <strong>API key rotation and endpoint updates</strong>
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
