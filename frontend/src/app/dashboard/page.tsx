
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { useMerchant } from "@/components/MerchantProvider";
import MetricIcon from "@/components/MetricIcon";
import {
  BellIcon,
  ChevronRightIcon,
  CodeIcon,
  DownloadIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/Icons";
import NotificationsModal from "@/components/modals/NotificationsModal";
import CreateApiKeyModal from "@/components/modals/CreateApiKeyModal";
import CreatePaymentModal from "@/components/modals/CreatePaymentModal";
import ShareLinkModal from "@/components/modals/ShareLinkModal";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { downloadJson } from "@/lib/export";
import { formatRelativeTime } from "@/lib/format";
import { statusTone } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <DashboardShell active="overview">
      <DashboardPageContent />
    </DashboardShell>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const merchant = useMerchant();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const metrics = useApiResource(api.dashboardMetrics);
  const payments = useApiResource(api.payments);
  const notifications = useApiResource(api.notifications);
  const links = useApiResource(api.paymentLinks);
  const currentUser = useApiResource(api.currentUser);
  const workspace = useApiResource(api.workspace);

  const activeLink = links.data?.find((link) => link.status === "active") ?? null;
  const recentPayments = useMemo(() => {
    const items = payments.data ?? [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((payment) =>
          [payment.id, payment.title, payment.orderId, payment.customerEmail].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : items;

    return filtered.slice(0, 6);
  }, [payments.data, search]);

  function handleExportReport() {
    downloadJson(
      {
        generatedAt: new Date().toISOString(),
        metrics: metrics.data,
        recentPayments,
      },
      "dashboard-report.json",
    );
  }

  return (
    <>
      <section className="topbar">
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recent payments"
            aria-label="Search recent payments"
          />
        </div>
        <div className="top-actions">
          <button className="btn btn-secondary icon-btn" type="button" onClick={() => setNotificationsOpen(true)}>
            <BellIcon />
          </button>
          <button className="btn btn-secondary" type="button" onClick={handleExportReport}>
            <DownloadIcon />
            Export report
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!merchant.walletConfigured}
            title={!merchant.walletConfigured ? "Add a payout wallet in Settings to create payments." : undefined}
          >
            <PlusIcon />
            Create payment
          </button>
        </div>
      </section>

      <section className="grid stat-grid">
        {metrics.data?.stats.map((stat) => (
          <article className="card stat-card" key={stat.id}>
            <div className="stat-top">
              <div>
                <div className="stat-label">{stat.label}</div>
              </div>
              <div className="stat-icon">
                <MetricIcon icon={stat.icon} />
              </div>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-foot">
              <span>{stat.caption}</span>
              <span className={`trend-${stat.trendTone}`}>{stat.trendLabel}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="main-grid">
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Payment volume trend</h2>
              <p>Track volume, order value, and refund exposure over the last 12 reporting periods.</p>
            </div>
            <div className="card-actions">
              <div className="pill">Last 12 months</div>
              <div className="pill">Volume</div>
            </div>
          </div>
          <div className="chart-shell">
            <div className="chart-summary">
              {metrics.data?.summary.map((summary) => (
                <div className="summary-box" key={summary.id}>
                  <small>{summary.label}</small>
                  <strong>{summary.value}</strong>
                </div>
              ))}
            </div>
            <div className="chart" aria-label="Payment volume trend">
              <div className="chart-gridlines">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="bars">
                {metrics.data?.volumeSeries.map((point) => (
                  <div className="bar-group" key={point.label}>
                    <div className="bar-stack">
                      <div className="bar" style={{ height: `${point.value}%` }}></div>
                    </div>
                    <div className="bar-label">{point.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="side-stack">
          <article className="card">
            <div className="card-head">
              <div>
                <h2>Quick actions</h2>
                <p>Move between the most common merchant tasks without leaving the dashboard.</p>
              </div>
            </div>
            <div className="quick-actions">
              <button
                className="action-btn"
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!merchant.walletConfigured}
                title={!merchant.walletConfigured ? "Add a payout wallet in Settings to create payments." : undefined}
              >
                <span className="action-left">
                  <span className="action-icon"><PlusIcon /></span>
                  <span className="action-copy">
                    <strong>Create payment</strong>
                    <span>Generate a new checkout request.</span>
                  </span>
                </span>
                <ChevronRightIcon />
              </button>
              <button className="action-btn" type="button" onClick={() => setShareOpen(true)} disabled={!activeLink}>
                <span className="action-left">
                  <span className="action-icon"><LinkIcon /></span>
                  <span className="action-copy">
                    <strong>Share payment link</strong>
                    <span>Open the active hosted checkout URL and QR code.</span>
                  </span>
                </span>
                <ChevronRightIcon />
              </button>
              <button className="action-btn" type="button" onClick={() => router.push("/webhooks?compose=test") }>
                <span className="action-left">
                  <span className="action-icon"><RefreshIcon /></span>
                  <span className="action-copy">
                    <strong>Test webhooks</strong>
                    <span>Jump to the webhook tester with your current endpoint selected.</span>
                  </span>
                </span>
                <ChevronRightIcon />
              </button>
              <button className="action-btn" type="button" onClick={() => setApiKeyOpen(true)}>
                <span className="action-left">
                  <span className="action-icon"><CodeIcon /></span>
                  <span className="action-copy">
                    <strong>Create API key</strong>
                    <span>Provision a new credential for a service or environment.</span>
                  </span>
                </span>
                <ChevronRightIcon />
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="card" id="payments">
        <div className="card-head">
          <div>
            <h2>Recent payments</h2>
            <p>Review the latest payment activity, customer references, and settlement status.</p>
          </div>
          <div className="card-actions">
            <div className="pill">{recentPayments.length} shown</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Status</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <Link
                      className="merchant-link"
                      href={`/payments/detail?id=${payment.id}`}
                      title={payment.id}
                    >
                      {payment.id}
                    </Link>
                    <div className="cell-muted" title={payment.title}>
                      {payment.title}
                    </div>
                  </td>
                  <td>
                    <span className={`status ${statusTone(payment.status)}`}>{payment.status}</span>
                  </td>
                  <td>
                    <span className="code" title={payment.orderId}>
                      {payment.orderId}
                    </span>
                  </td>
                  <td className="cell-muted" title={payment.customerEmail}>
                    {payment.customerEmail}
                  </td>
                  <td className="cell-muted">{formatRelativeTime(payment.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NotificationsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications.data ?? []}
      />
      <CreatePaymentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(payment) => {
          void payments.refresh();
          router.push(`/payments/detail?id=${payment.id}`);
        }}
        workspaceName={workspace.data?.name}
        workspaceSiteUrl={workspace.data?.siteUrl}
        walletConfigured={merchant.walletConfigured}
      />
      <CreateApiKeyModal
        open={apiKeyOpen}
        onClose={() => setApiKeyOpen(false)}
        onCreated={() => {
          setApiKeyOpen(false);
        }}
        ownerName={currentUser.data?.name ?? "Account owner"}
      />
      <ShareLinkModal open={shareOpen} onClose={() => setShareOpen(false)} link={activeLink} />
    </>
  );
}
