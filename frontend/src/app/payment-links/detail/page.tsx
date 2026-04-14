
"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { useMerchant } from "@/components/MerchantProvider";
import { DownloadIcon, SearchIcon } from "@/components/Icons";
import PaymentLinkModal from "@/components/modals/PaymentLinkModal";
import PauseLinkModal from "@/components/modals/PauseLinkModal";
import ShareLinkModal from "@/components/modals/ShareLinkModal";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { formatCurrency, formatPercent, formatRelativeTime } from "@/lib/format";
import { statusTone } from "@/lib/utils";

function PaymentLinkDetailPageContent() {
  const router = useRouter();
  const merchant = useMerchant();
  const searchParams = useSearchParams();
  const linkId = searchParams.get("id");
  const [search, setSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const links = useApiResource(api.paymentLinks);
  const payments = useApiResource(api.payments);
  const link = useMemo(
    () => (links.data ?? []).find((entry) => entry.id === linkId) ?? links.data?.[0] ?? null,
    [links.data, linkId],
  );

  const linkedPayments = useMemo(
    () => (payments.data ?? []).filter((payment) => payment.linkId === link?.id),
    [payments.data, link?.id],
  );

  function jumpToLink() {
    if (!search.trim()) return;
    const match = (links.data ?? []).find((entry) =>
      [entry.title, entry.slug, entry.url].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())),
    );
    if (match) {
      router.push(`/payment-links/detail?id=${match.id}`);
    }
  }

  function exportAnalytics() {
    if (!link) return;
    downloadCsv(
      [
        {
          slug: link.slug,
          visits: link.visits,
          completedPayments: link.completedPayments,
          conversionRate: formatPercent(link.conversionRate),
          amount: formatCurrency(link.amount, link.currency),
        },
      ],
      `${link.slug}-analytics.csv`,
      [
        { key: "slug", label: "Slug" },
        { key: "visits", label: "Views" },
        { key: "completedPayments", label: "Completed Payments" },
        { key: "conversionRate", label: "Conversion" },
        { key: "amount", label: "Amount" },
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
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToLink();
              }
            }}
            placeholder="Jump to another payment link"
            aria-label="Jump to another payment link"
          />
        </div>
        <div className="top-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setShareOpen(true)} disabled={!link}>
            Share link
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setEditorOpen(true)} disabled={!link}>
            Edit link
          </button>
        </div>
      </section>

      {link ? (
        <>
          <section className="page-header">
            <div>
              <div className="eyebrow">Payment link detail</div>
              <h1>{link.slug} · {link.title}</h1>
              <p>Track performance, share the checkout URL, and control whether the link is live.</p>
            </div>
            <div className="header-meta">
              <div className="meta-chip">{link.status}</div>
              <div className="meta-chip">{formatCurrency(link.amount, link.currency)}</div>
              <div className="meta-chip">Updated {formatRelativeTime(link.updatedAt)}</div>
            </div>
          </section>

          <section className="layout-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h2>Link performance</h2>
                  <p className="cell-muted">Traffic, conversion, and completed payments for this checkout link.</p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={exportAnalytics}>
                  <DownloadIcon />
                  Export analytics
                </button>
              </div>
              <div className="panel-body">
                <div className="detail-list two-column-list">
                  <div className="detail-item"><span>Page views</span><strong>{link.visits}</strong></div>
                  <div className="detail-item"><span>Completed payments</span><strong>{link.completedPayments}</strong></div>
                  <div className="detail-item"><span>Conversion</span><strong>{formatPercent(link.conversionRate)}</strong></div>
                  <div className="detail-item"><span>Average time to pay</span><strong>{link.avgTimeToPay}</strong></div>
                </div>

                <div className="action-panel">
                  <div className="row-copy">
                    <strong>Share link</strong>
                    <span>Copy the checkout URL, open it in a new tab, or download the QR code.</span>
                  </div>
                  <div className="detail-list">
                    <div className="detail-item"><span>Checkout URL</span><strong title={link.url}>{link.url}</strong></div>
                    <div className="detail-item"><span>Latest payment</span><strong title={linkedPayments[0]?.id ?? "No payments yet"}>{linkedPayments[0]?.id ?? "No payments yet"}</strong></div>
                  </div>
                  <div className="share-actions">
                    <button className="btn btn-primary" type="button" onClick={() => setShareOpen(true)}>
                      Share link
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => router.push(`/pay/${link.slug}`)}>
                      Open checkout
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <aside className="panel">
              <div className="panel-head">
                <div>
                  <h2>Link settings</h2>
                  <p className="cell-muted">Payment amount, redirect behavior, and current publishing state.</p>
                </div>
              </div>
              <div className="panel-body">
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Amount</strong>
                    <span>{formatCurrency(link.amount, link.currency)} · {link.type}</span>
                  </div>
                  <span className="status ok">Locked</span>
                </div>
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Success redirect</strong>
                    <span title={link.successUrl}>{link.successUrl}</span>
                  </div>
                  <span className="status info">Enabled</span>
                </div>
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Branding</strong>
                    <span>{link.brandingLabel}</span>
                  </div>
                  <span className={`status ${statusTone(link.status)}`}>{link.status}</span>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setEditorOpen(true)}>
                  Update link
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setStatusOpen(true)}
                  disabled={link.status === "paused" && !merchant.walletConfigured}
                  title={link.status === "paused" && !merchant.walletConfigured ? "Add a payout wallet in Settings to activate payment links." : undefined}
                >
                  {link.status === "paused" ? "Resume link" : "Pause link"}
                </button>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <div className="empty-state">No payment link found.</div>
      )}

      <ShareLinkModal open={shareOpen} onClose={() => setShareOpen(false)} link={link} />
      <PaymentLinkModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        link={link}
        onSaved={() => {
          void links.refresh();
        }}
        walletConfigured={merchant.walletConfigured}
      />
      <PauseLinkModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        link={link}
        mode={link?.status === "paused" ? "resume" : "pause"}
        onCompleted={() => {
          void links.refresh();
        }}
        walletConfigured={merchant.walletConfigured}
      />
    </>
  );
}

export default function PaymentLinkDetailPage() {
  return (
    <DashboardShell active="links">
      <Suspense fallback={<div className="empty-state">Loading payment link…</div>}>
        <PaymentLinkDetailPageContent />
      </Suspense>
    </DashboardShell>
  );
}
