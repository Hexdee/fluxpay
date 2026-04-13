import Link from "next/link";
import Brand from "@/components/Brand";

export default function TermsPage() {
  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className="status info">Legal</span>
        </div>
        <div className="state-body">
          <h1>Terms of service</h1>
          <p className="cell-muted">
            FluxPay provides merchant tooling for USDT0 checkout, payment links, and webhook
            delivery. By using the product, you agree to responsible API usage, secure key
            management, and compliance with applicable laws.
          </p>
          <div className="state-rows">
            <div className="state-row">
              <span>Service usage</span>
              <strong>Merchant operations only</strong>
            </div>
            <div className="state-row">
              <span>Credential responsibility</span>
              <strong>Merchant-managed</strong>
            </div>
            <div className="state-row">
              <span>Prohibited usage</span>
              <strong>Fraud and sanctions violations</strong>
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
