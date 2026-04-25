import Brand from '@/components/Brand';
import BackendWarmup from '@/components/BackendWarmup';
import Link from 'next/link';
import { ChartUpIcon, CheckCircleIcon, CodeIcon } from '@/components/Icons';

export default function HomePage() {
  return (
    <>
      <BackendWarmup />
      <header className='site-header'>
        <div className='container header-inner'>
          <Brand />
          <nav className='nav' aria-label='Primary navigation'>
            <a href='#features'>Features</a>
            <a href='#developers'>Developers</a>
            <a href='#pricing'>Pricing</a>
            <a href='#faq'>FAQ</a>
          </nav>
          <div className='header-actions'>
            <Link className='btn btn-secondary' href='/docs'>
              View docs
            </Link>
            <a className='btn btn-primary' href='/auth/sign-up'>
              Get Started
            </a>
          </div>
          <details className='mobile-nav'>
            <summary aria-label='Open menu'>
              <span className='menu-line'></span>
              <span className='menu-line'></span>
            </summary>
            <div className='mobile-panel'>
              <a href='#features'>Features</a>
              <a href='#developers'>Developers</a>
              <a href='#pricing'>Pricing</a>
              <a href='#faq'>FAQ</a>
              <a className='btn btn-primary' href='/auth/sign-up'>
                Get Started
              </a>
            </div>
          </details>
        </div>
      </header>

      <main id='top'>
        <section className='hero'>
          <div className='container hero-grid'>
            <div className='hero-copy'>
              <div className='badge'>
                <span className='dot'></span>
                Checkout infrastructure for Conflux
              </div>
              <h1>
                Accept USDT0 on Conflux with payment links, widgets, and APIs.
              </h1>
              <p>
                FluxPay gives merchants and builders a polished checkout layer
                for Conflux eSpace - with hosted checkout, embeddable
                components, payment verification, and webhook-driven order
                automation.
              </p>
              <div className='hero-actions'>
                <a className='btn btn-primary' href='/dashboard'>
                  Get Started
                </a>
                <a className='btn btn-secondary' href='#developers'>
                  See developer flow
                </a>
              </div>
              <div className='hero-meta'>
                <span>Hosted checkout</span>
                <span>USDT0 integration</span>
                <span>Webhook confirmations</span>
                <span>Merchant dashboard</span>
              </div>
            </div>

            <div className='hero-card'>
              <div className='hero-glow'></div>
              <div className='hero-floating float-top'>
                <small>Instant merchant event</small>
                <strong>payment.succeeded</strong>
                <span className='code-chip'>POST /webhooks/merchant</span>
              </div>

              <div className='window'>
                <div className='window-top'>
                  <div className='window-dots'>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <small>Hosted checkout example</small>
                </div>
                <div className='checkout'>
                  <div className='merchant-strip'>
                    <div className='merchant-left'>
                      <div className='merchant-avatar'>E</div>
                      <div>
                        <div className='merchant-title'>Example Store</div>
                        <div className='merchant-subtitle'>
                          Example checkout - Order #EX-1024
                        </div>
                      </div>
                    </div>
                    <div className='status-pill'>Ready to pay</div>
                  </div>

                  <div className='amount-card'>
                    <small>Total due</small>
                    <div className='amount-main'>
                      <h2>25.00</h2>
                      <div className='token-badge'>
                        <span className='token-dot'></span> USDT0
                      </div>
                    </div>
                  </div>

                  <div className='summary-grid'>
                    <div className='summary-item'>
                      <small>Network</small>
                      <strong>Conflux eSpace</strong>
                    </div>
                    <div className='summary-item'>
                      <small>Settlement</small>
                      <strong>Onchain verified</strong>
                    </div>
                    <div className='summary-item'>
                      <small>Payment type</small>
                      <strong>Hosted checkout</strong>
                    </div>
                    <div className='summary-item'>
                      <small>Expiry</small>
                      <strong>29m 12s</strong>
                    </div>
                  </div>

                  <div className='pay-box'>
                    <div className='pay-row'>
                      <span>Merchant</span>
                      <strong>Example Store</strong>
                    </div>
                    <div className='pay-row'>
                      <span>Webhook</span>
                      <strong>Configured</strong>
                    </div>
                    <div className='pay-row'>
                      <span>Customer receives</span>
                      <strong>Instant confirmation</strong>
                    </div>
                    <button className='primary-pay' type='button'>
                      Connect wallet &amp; pay
                    </button>
                    <div className='tiny-note'>
                      Secure checkout, status tracking, and post-payment
                      automation.
                    </div>
                  </div>
                </div>
              </div>

              <div className='hero-floating float-bottom'>
                <small>Simple developer call</small>
                <strong>Create a checkout link</strong>
                <span className='code-chip'>client.payments.create()</span>
              </div>
            </div>
          </div>
        </section>

        <section className='logos'>
          <div className='container'>
            <div className='logo-row'>
              <div className='logo-card'>Merchants</div>
              <div className='logo-card'>SaaS Apps</div>
              <div className='logo-card'>Invoices</div>
              <div className='logo-card'>Bots</div>
              <div className='logo-card'>Digital Stores</div>
            </div>
          </div>
        </section>

        <section className='section' id='features'>
          <div className='container'>
            <div className='section-head'>
              <div>
                <h2>Built for merchants and builders</h2>
              </div>
              <p>
                FluxPay combines a polished merchant-facing product with
                reusable infrastructure that developers can drop into apps,
                dashboards, and automated payment flows.
              </p>
            </div>
            <div className='feature-grid'>
              <article className='feature-card'>
                <div className='icon-box'>
                  <ChartUpIcon />
                </div>
                <h3>Hosted checkout</h3>
                <p>
                  Generate branded payment links in seconds and let customers
                  pay through a clean, conversion-focused checkout experience.
                </p>
                <ul className='feature-list'>
                  <li>Payment links</li>
                  <li>Success and cancel URLs</li>
                  <li>Branded merchant pages</li>
                </ul>
              </article>
              <article className='feature-card'>
                <div className='icon-box'>
                  <CodeIcon />
                </div>
                <h3>Developer SDKs</h3>
                <p>
                  Create payments, embed checkout, verify webhooks, and manage
                  payment state with a simple API-first toolkit.
                </p>
                <ul className='feature-list'>
                  <li>JavaScript SDK</li>
                  <li>React components</li>
                  <li>Webhook verification</li>
                </ul>
              </article>
              <article className='feature-card'>
                <div className='icon-box'>
                  <CheckCircleIcon />
                </div>
                <h3>Onchain confirmation</h3>
                <p>
                  Track payment status from created to confirmed and notify
                  merchant systems as soon as settlement is verified.
                </p>
                <ul className='feature-list'>
                  <li>Payment lifecycle status</li>
                  <li>Transaction hash records</li>
                  <li>Webhook delivery logs</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className='section' id='developers'>
          <div className='container split'>
            <article className='code-card'>
              <h3>Create checkout in a few lines</h3>
              <p>
                Give developers a short path from API key to a live payment
                flow.
              </p>
              <pre>
                <code>{`import { CheckoutClient } from "fluxpay-checkout-sdk";

const client = new CheckoutClient({
  apiKey: process.env.FLUXPAY_API_KEY!,
});

const payment = await client.payments.create({
  amount: "25.00",
  currency: "USDT0",
  customerEmail: "billing@customer.com",
  merchantOrderId: "order_2048",
  expiresInMinutes: 30,
});

console.log(payment.checkoutUrl);`}</code>
              </pre>
            </article>
            <article className='code-card'>
              <h3>Merchant story</h3>
              <p>
                Merchants can use FluxPay without learning blockchain plumbing.
              </p>
              <ul className='feature-list'>
                <li>Create a payment in the dashboard or via API.</li>
                <li>Share a checkout link or embed a widget.</li>
                <li>
                  Receive status updates and webhooks after payment
                  confirmation.
                </li>
                <li>
                  Unlock products, mark invoices paid, or activate subscriptions
                  automatically.
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className='section'>
          <div className='container'>
            <div className='section-head'>
              <div>
                <h2>How it works</h2>
              </div>
              <p>
                A clear 3-step flow that merchants and developers can understand
                immediately.
              </p>
            </div>
            <div className='steps'>
              <article className='step-card'>
                <div className='step-number'>1</div>
                <h3>Create a payment</h3>
                <p>
                  Merchant creates a USDT0 payment request from the dashboard or
                  API.
                </p>
              </article>
              <article className='step-card'>
                <div className='step-number'>2</div>
                <h3>Customer pays</h3>
                <p>
                  The customer opens the checkout page, connects a wallet, and
                  completes payment.
                </p>
              </article>
              <article className='step-card'>
                <div className='step-number'>3</div>
                <h3>Merchant gets notified</h3>
                <p>
                  FluxPay verifies settlement, updates status, and sends
                  webhooks for fulfillment.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className='section' id='pricing'>
          <div className='container'>
            <div className='section-head'>
              <div>
                <h2>Pricing</h2>
              </div>
              <p>
                Transparent plans with monthly billing and clear feature tiers.
              </p>
            </div>
            <div className='pricing-grid'>
              <article className='pricing-card'>
                <div className='plan-tag'>Starter</div>
                <h3>Launch quickly</h3>
                <div className='price'>
                  <strong>$0</strong>
                  <span>/ month</span>
                </div>
                <div className='cell-muted'>Best for early pilots</div>
                <ul className='feature-list'>
                  <li>Hosted checkout</li>
                  <li>Basic dashboard</li>
                  <li>Test mode</li>
                </ul>
              </article>
              <article className='pricing-card highlight'>
                <div className='plan-tag'>Growth</div>
                <h3>For active merchants</h3>
                <div className='price'>
                  <strong>$29</strong>
                  <span>/ month</span>
                </div>
                <div className='cell-muted'>Billed monthly</div>
                <ul className='feature-list'>
                  <li>Custom branding</li>
                  <li>Webhooks and event logs</li>
                  <li>Advanced analytics</li>
                </ul>
              </article>
              <article className='pricing-card'>
                <div className='plan-tag'>Enterprise</div>
                <h3>Scale with your stack</h3>
                <div className='price'>
                  <strong>Custom</strong>
                </div>
                <div className='cell-muted'>
                  Contact sales for volume pricing
                </div>
                <ul className='feature-list'>
                  <li>Priority support</li>
                  <li>Dedicated environments</li>
                  <li>Custom integrations</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className='section' id='faq'>
          <div className='container'>
            <div className='section-head'>
              <div>
                <h2>FAQ</h2>
              </div>
              <p>Answers to common integration and operations questions.</p>
            </div>
            <div className='faq-grid'>
              <article className='faq-card'>
                <h3>What does FluxPay help with?</h3>
                <p>
                  FluxPay helps apps and merchants accept USDT0 on Conflux
                  through hosted checkout, payment links, embeddable components,
                  and developer APIs.
                </p>
              </article>
              <article className='faq-card'>
                <h3>Who is it for?</h3>
                <p>
                  It is designed for merchants, SaaS products, digital stores,
                  service businesses, and developers who want a clean stablecoin
                  checkout workflow.
                </p>
              </article>
              <article className='faq-card'>
                <h3>How fast can I integrate?</h3>
                <p>
                  Teams can create a checkout link in minutes, then expand to
                  webhooks and dashboard workflows as they scale.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className='section' id='cta'>
          <div className='container'>
            <div className='cta-card'>
              <h2>Build the payment layer your Conflux app actually needs.</h2>
              <p>
                Launch faster with hosted checkout, merchant workflows, and
                developer-friendly APIs designed for modern stablecoin payments.
              </p>
              <div className='hero-actions'>
                <a className='btn btn-primary' href='/dashboard'>
                  Get Started
                </a>
                <a className='btn btn-ghost' href='#developers'>
                  Explore developer flow
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className='footer'>
        <div className='container footer-grid'>
          <div className='footer-column'>
            <h4>FluxPay</h4>
            <p>Stablecoin checkout for Conflux.</p>
          </div>
          <div className='footer-column'>
            <h4>Product</h4>
            <ul>
              <li>Hosted checkout</li>
              <li>Payment links</li>
              <li>Merchant dashboard</li>
            </ul>
          </div>
          <div className='footer-column'>
            <h4>Developers</h4>
            <ul>
              <li>API keys</li>
              <li>Webhooks</li>
              <li>SDKs</li>
            </ul>
          </div>
          <div className='footer-column'>
            <h4>Company</h4>
            <ul>
              <li>About</li>
              <li>Careers</li>
              <li>Contact</li>
            </ul>
          </div>
          <div className='footer-column'>
            <h4>Legal</h4>
            <ul>
              <li>
                <Link href='/legal/terms'>Terms</Link>
              </li>
              <li>
                <Link href='/legal/privacy'>Privacy</Link>
              </li>
              <li>
                <Link href='/legal/security'>Security</Link>
              </li>
              <li>
                <Link href='/status'>Status</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}
