
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { useMerchant } from "@/components/MerchantProvider";
import MetricIcon from "@/components/MetricIcon";
import { DownloadIcon, SearchIcon } from "@/components/Icons";
import PaymentLinkModal from "@/components/modals/PaymentLinkModal";
import PauseLinkModal from "@/components/modals/PauseLinkModal";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { formatCompactNumber, formatCurrency, formatPercent, formatRelativeTime } from "@/lib/format";
import type { PaymentLink } from "@/lib/types";
import { statusTone } from "@/lib/utils";

export default function PaymentLinksPage() {
  return (
    <DashboardShell active="links">
      <PaymentLinksPageContent />
    </DashboardShell>
  );
}

function PaymentLinksPageContent() {
  const router = useRouter();
  const merchant = useMerchant();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentLink["status"]>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [statusMode, setStatusMode] = useState<"pause" | "resume">("pause");

  const links = useApiResource(api.paymentLinks);
  const payments = useApiResource(api.payments);
  const workspace = useApiResource(api.workspace);

  const filteredLinks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (links.data ?? []).filter((link) => {
      const matchesSearch = query
        ? [link.title, link.slug, link.url].some((value) => value.toLowerCase().includes(query))
        : true;
      const matchesStatus = statusFilter === "all" ? true : link.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [links.data, search, statusFilter]);

  const summary = useMemo(() => {
    const items = links.data ?? [];
    const active = items.filter((item) => item.status === "active");
    const conversionAverage = active.length
      ? active.reduce((total, item) => total + item.conversionRate, 0) / active.length
      : 0;
    const linkedPaymentRevenue = (payments.data ?? []).reduce((total, payment) => {
      if (!payment.linkId) return total;
      if (payment.status !== "succeeded" && payment.status !== "refunded") return total;
      return total + payment.amount;
    }, 0);

    return {
      activeLinks: active.length,
      conversionAverage,
      revenueEstimate: linkedPaymentRevenue,
    };
  }, [links.data, payments.data]);

  function exportLinks() {
    downloadCsv(
      filteredLinks.map((link) => ({
        id: link.id,
        title: link.title,
        status: link.status,
        amount: formatCurrency(link.amount, link.currency),
        visits: link.visits,
        conversionRate: formatPercent(link.conversionRate),
        updatedAt: link.updatedAt,
      })),
      "payment-links.csv",
      [
        { key: "id", label: "Link ID" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "amount", label: "Amount" },
        { key: "visits", label: "Views" },
        { key: "conversionRate", label: "Conversion" },
        { key: "updatedAt", label: "Updated At" },
      ],
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
            placeholder="Search payment links, destinations, or aliases"
            aria-label="Search payment links"
          />
        </div>
        <div className="top-actions">
          <button className="btn btn-secondary" type="button" onClick={exportLinks}>
            <DownloadIcon />
            Export CSV
          </button>
          <button className="btn btn-primary" type="button" onClick={() => { setSelectedLink(null); setEditorOpen(true); }}>
            Create link
          </button>
        </div>
      </section>

      <section className="grid summary-grid">
        <article className="card summary-card">
          <div className="summary-top">
            <div className="summary-label">Active links</div>
            <div className="summary-icon"><MetricIcon icon="link" /></div>
          </div>
          <div className="summary-value">{summary.activeLinks}</div>
          <div className="summary-foot"><span>Currently accepting payments</span><span className="trend-up">Live</span></div>
        </article>
        <article className="card summary-card">
          <div className="summary-top">
            <div className="summary-label">Conversion</div>
            <div className="summary-icon"><MetricIcon icon="chart-up" /></div>
          </div>
          <div className="summary-value">{formatPercent(summary.conversionAverage)}</div>
          <div className="summary-foot"><span>Average across active links</span><span className="trend-flat">Stable</span></div>
        </article>
        <article className="card summary-card">
          <div className="summary-top">
            <div className="summary-label">Revenue</div>
            <div className="summary-icon"><MetricIcon icon="currency" /></div>
          </div>
          <div className="summary-value">{formatCompactNumber(summary.revenueEstimate)}</div>
          <div className="summary-foot"><span>Estimated from completed payments</span><span className="trend-up">Tracked</span></div>
        </article>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Link filters</h2>
            <p>Filter links by state before sharing, editing, or reactivating them.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="toolbar-left">
            {(["all", "active", "draft", "paused"] as const).map((status) => (
              <button
                key={status}
                className={`pill${statusFilter === status ? " pill-active" : ""}`}
                type="button"
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All links" : status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Link</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Views</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLinks.map((link) => (
              <tr key={link.id}>
                <td>
                  <button
                    className="table-link-button"
                    type="button"
                    onClick={() => router.push(`/payment-links/detail?id=${link.id}`)}
                    title={link.title}
                  >
                    {link.title}
                  </button>
                  <div className="cell-muted" title={`/${link.slug}`}>
                    /{link.slug}
                  </div>
                </td>
                <td><span className={`status ${statusTone(link.status)}`}>{link.status}</span></td>
                <td>{link.type === "open" ? "—" : formatCurrency(link.amount, link.currency)}</td>
                <td>{link.visits}</td>
                <td className="cell-muted">{formatRelativeTime(link.updatedAt)}</td>
                <td>
                  {link.status === "paused" ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ height: 36 }}
                      onClick={() => {
                        setSelectedLink(link);
                        setStatusMode("resume");
                        setStatusOpen(true);
                      }}
                      disabled={!merchant.walletConfigured}
                      title={!merchant.walletConfigured ? "Add a payout wallet in Settings to activate payment links." : undefined}
                    >
                      Resume
                    </button>
                  ) : link.status === "draft" ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ height: 36 }}
                      onClick={() => {
                        setSelectedLink(link);
                        setEditorOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ height: 36 }}
                      onClick={() => router.push(`/payment-links/detail?id=${link.id}`)}
                    >
                      Open
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PaymentLinkModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        link={selectedLink}
        onSaved={() => {
          void links.refresh();
        }}
        workspaceSiteUrl={workspace.data?.siteUrl}
        walletConfigured={merchant.walletConfigured}
      />
      <PauseLinkModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        link={selectedLink}
        mode={statusMode}
        onCompleted={() => {
          void links.refresh();
        }}
        walletConfigured={merchant.walletConfigured}
      />
    </>
  );
}
