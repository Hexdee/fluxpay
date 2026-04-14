
"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { useToast } from "@/components/ToastProvider";
import { DownloadIcon, RefreshIcon, SearchIcon } from "@/components/Icons";
import RefundModal from "@/components/modals/RefundModal";
import WebhookEventModal from "@/components/modals/WebhookEventModal";
import TruncateCopy from "@/components/TruncateCopy";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { downloadJson } from "@/lib/export";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/format";
import { statusTone } from "@/lib/utils";

function PaymentDetailPageContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("id");
  const [search, setSearch] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const payments = useApiResource(api.payments);
  const events = useApiResource(api.webhookEvents);

  const payment = useMemo(
    () => (payments.data ?? []).find((entry) => entry.id === paymentId) ?? payments.data?.[0] ?? null,
    [payments.data, paymentId],
  );

  const relatedEvent = useMemo(
    () => (events.data ?? []).find((entry) => entry.paymentId === payment?.id) ?? null,
    [events.data, payment?.id],
  );

  const endpoint = useApiResource(api.webhookEndpoints);
  const activeEndpoint = useMemo(
    () => endpoint.data?.find((item) => item.id === relatedEvent?.endpointId) ?? null,
    [endpoint.data, relatedEvent?.endpointId],
  );
  const hasWebhookEndpoint = (endpoint.data?.length ?? 0) > 0;
  const canViewWebhookLogs = Boolean(relatedEvent);
  const canResendWebhook = Boolean(relatedEvent) && hasWebhookEndpoint;

  function exportDetail() {
    if (!payment) return;
    downloadJson({ payment, relatedEvent }, `${payment.id}.json`);
  }

  function jumpToPayment() {
    if (!search.trim()) return;
    const match = (payments.data ?? []).find((entry) =>
      [entry.id, entry.orderId, entry.customerEmail].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    );
    if (match) {
      router.push(`/payments/detail?id=${match.id}`);
    }
  }

  async function resendWebhook() {
    if (!relatedEvent || !hasWebhookEndpoint) return;
    try {
      await api.resendWebhookEvent(relatedEvent.id);
      void events.refresh();
      toast.success("Webhook replay queued.");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to resend webhook.";
      toast.error(message);
    }
  }

  return (
    <DashboardShell active="payments">
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
                jumpToPayment();
              }
            }}
            placeholder="Jump to another payment"
            aria-label="Jump to another payment"
          />
        </div>
        <div className="top-actions">
          <button className="btn btn-secondary" type="button" onClick={exportDetail}>
            <DownloadIcon />
            Export detail
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setRefundOpen(true)} disabled={!payment || payment.refundableAmount === 0}>
            Issue refund
          </button>
        </div>
      </section>

      {payment ? (
        <>
          <section className="page-header">
            <div>
              <div className="eyebrow">Payment detail</div>
              <h1 className="wrap-heading">
                <TruncateCopy value={payment.id} label="Copy payment ID" />
                <span className="heading-sep">·</span>
                <span className="heading-title">{payment.title}</span>
              </h1>
              <p>Review settlement progress, customer details, and webhook activity for this payment.</p>
            </div>
            <div className="header-meta">
              <div className="meta-chip">{formatCurrency(payment.amount, payment.currency)}</div>
              <div className="meta-chip">{payment.status}</div>
              <div className="meta-chip">Updated {formatRelativeTime(payment.updatedAt)}</div>
            </div>
          </section>

          <section className="layout-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h2>Payment timeline</h2>
                  <p className="cell-muted">Every settlement and webhook event is recorded below.</p>
                </div>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setEventOpen(true)}
                  disabled={!canViewWebhookLogs}
                  title={canViewWebhookLogs ? "View webhook logs" : "No webhook event logs yet"}
                >
                  View webhook logs
                </button>
              </div>
              <div className="panel-body">
                <div className="timeline">
                  {payment.timeline.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <div className="timeline-rail">
                        <span className={`timeline-dot${item.tone === "info" ? " cyan" : item.tone === "warn" ? " warn" : ""}`}></span>
                      </div>
                      <div>
                        <div className="row-copy">
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                        </div>
                        <div className="cell-muted">{formatDateTime(item.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="action-panel">
                  <div className="row-copy">
                    <strong>Customer details</strong>
                    <span>Contact and wallet information attached to the payment.</span>
                  </div>
                  <div className="detail-list">
                    <div className="detail-item"><span>Email</span><strong title={payment.customerEmail}>{payment.customerEmail}</strong></div>
                    <div className="detail-item">
                      <span>Wallet</span>
                      <strong>
                        <TruncateCopy value={payment.customerWallet} label="Copy wallet address" head={10} tail={8} />
                      </strong>
                    </div>
                    <div className="detail-item">
                      <span>Order ID</span>
                      <strong>
                        <TruncateCopy value={payment.orderId} label="Copy order ID" />
                      </strong>
                    </div>
                    <div className="detail-item">
                      <span>Success URL</span>
                      <strong>
                        <TruncateCopy value={payment.successUrl} label="Copy success URL" head={18} tail={12} monospace={false} />
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <aside className="panel">
              <div className="panel-head">
                <div>
                  <h2>Summary</h2>
                  <p className="cell-muted">Quick status checks and next actions.</p>
                </div>
              </div>
              <div className="panel-body">
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Payment status</strong>
                    <span>{formatCurrency(payment.amount, payment.currency)}</span>
                  </div>
                  <span className={`status ${statusTone(payment.status)}`}>{payment.status}</span>
                </div>
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Settlement</strong>
                    <span>{payment.settlementStatus}</span>
                  </div>
                  <span className={`status ${statusTone(payment.settlementStatus.toLowerCase())}`}>{formatRelativeTime(payment.settlementUpdatedAt)}</span>
                </div>
                <div className="note-row">
                  <div className="row-copy">
                    <strong>Webhook delivery</strong>
                    <span>{payment.webhookSummary}</span>
                  </div>
                  <span className={`status ${statusTone(relatedEvent?.status ?? "queued")}`}>{relatedEvent?.status ?? "pending"}</span>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setRefundOpen(true)} disabled={payment.refundableAmount === 0}>
                  Issue refund
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void resendWebhook()}
                  disabled={!canResendWebhook}
                  title={
                    !relatedEvent
                      ? "No webhook event to resend"
                      : !hasWebhookEndpoint
                        ? "Configure a webhook endpoint to resend events"
                        : "Resend webhook event"
                  }
                >
                  <RefreshIcon />
                  Resend webhook
                </button>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <div className="empty-state">No payment found.</div>
      )}

      <RefundModal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        payment={payment}
        onCompleted={() => {
          void payments.refresh();
        }}
      />
      <WebhookEventModal
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        event={relatedEvent}
        endpoint={activeEndpoint}
        payment={payment}
        canResend={canResendWebhook}
        onResend={() => void resendWebhook()}
      />
    </DashboardShell>
  );
}

export default function PaymentDetailPage() {
  return (
    <Suspense fallback={<DashboardShell active="payments"><div className="empty-state">Loading payment…</div></DashboardShell>}>
      <PaymentDetailPageContent />
    </Suspense>
  );
}
