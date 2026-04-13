import Link from "next/link";
import Brand from "@/components/Brand";

export default function StatusPage() {
  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className="status ok">Operational</span>
        </div>
        <div className="state-body">
          <h1>System status</h1>
          <p className="cell-muted">
            API, checkout, dashboard data services, and webhook dispatch workers are currently
            operating normally.
          </p>
          <div className="state-rows">
            <div className="state-row">
              <span>API</span>
              <strong>Operational</strong>
            </div>
            <div className="state-row">
              <span>Checkout</span>
              <strong>Operational</strong>
            </div>
            <div className="state-row">
              <span>Webhooks</span>
              <strong>Operational</strong>
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
