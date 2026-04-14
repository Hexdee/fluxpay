'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { useMerchant } from '@/components/MerchantProvider';
import MetricIcon from '@/components/MetricIcon';
import { DownloadIcon, RefreshIcon, SearchIcon } from '@/components/Icons';
import CreatePaymentModal from '@/components/modals/CreatePaymentModal';
import TruncateCopy from '@/components/TruncateCopy';
import { useApiResource } from '@/hooks/useApiResource';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import type { Payment } from '@/lib/types';
import { statusTone } from '@/lib/utils';

export default function PaymentsPage() {
  return (
    <DashboardShell active='payments'>
      <PaymentsPageContent />
    </DashboardShell>
  );
}

function PaymentsPageContent() {
  const router = useRouter();
  const merchant = useMerchant();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['status']>(
    'all',
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Payment> | undefined>(undefined);

  const payments = useApiResource(api.payments);
  const workspace = useApiResource(api.workspace);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payments.data ?? []).filter((payment) => {
      const matchesSearch = query
        ? [
            payment.id,
            payment.title,
            payment.orderId,
            payment.customerEmail,
          ].some((value) => value.toLowerCase().includes(query))
        : true;
      const matchesStatus =
        statusFilter === 'all' ? true : payment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments.data, search, statusFilter]);

  const summary = useMemo(() => {
    const items = payments.data ?? [];
    return {
      total: items.length,
      succeeded: items.filter((item) => item.status === 'succeeded').length,
      pending: items.filter((item) => item.status === 'pending').length,
      expired: items.filter((item) => item.status === 'expired').length,
      failed: items.filter((item) => item.status === 'failed').length,
    };
  }, [payments.data]);

  function exportRows() {
    downloadCsv(
      filteredPayments.map((payment) => ({
        id: payment.id,
        title: payment.title,
        status: payment.status,
        amount: formatCurrency(payment.amount, payment.currency),
        orderId: payment.orderId,
        customerEmail: payment.customerEmail,
        updatedAt: payment.updatedAt,
      })),
      'payments.csv',
      [
        { key: 'id', label: 'Payment ID' },
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status' },
        { key: 'amount', label: 'Amount' },
        { key: 'orderId', label: 'Order ID' },
        { key: 'customerEmail', label: 'Customer Email' },
        { key: 'updatedAt', label: 'Updated At' },
      ],
    );
  }

  return (
    <>
      <section className='topbar'>
        <div className='search'>
          <SearchIcon />
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search payment IDs, order references, or customer emails'
            aria-label='Search payments'
          />
        </div>
        <div className='top-actions'>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={exportRows}
          >
            <DownloadIcon />
            Export CSV
          </button>
          <button
            className='btn btn-primary'
            type='button'
            onClick={() => {
              setDraft(undefined);
              setCreateOpen(true);
            }}
            disabled={!merchant.walletConfigured}
            title={
              !merchant.walletConfigured
                ? 'Add a payout wallet in Settings to create payments.'
                : undefined
            }
          >
            Create payment
          </button>
        </div>
      </section>

      <section className='grid summary-grid'>
        <article className='card summary-card'>
          <div className='summary-top'>
            <div className='summary-label'>Total payments</div>
            <div className='summary-icon'>
              <MetricIcon icon='wallet' />
            </div>
          </div>
          <div className='summary-value'>{summary.total}</div>
          <div className='summary-foot'>
            <span>Across all statuses</span>
            <span className='trend-up'>Live</span>
          </div>
        </article>
        <article className='card summary-card'>
          <div className='summary-top'>
            <div className='summary-label'>Succeeded</div>
            <div className='summary-icon'>
              <MetricIcon icon='check-circle' />
            </div>
          </div>
          <div className='summary-value'>{summary.succeeded}</div>
          <div className='summary-foot'>
            <span>Fully settled</span>
            <span className='trend-up'>Healthy</span>
          </div>
        </article>
        <article className='card summary-card'>
          <div className='summary-top'>
            <div className='summary-label'>Pending</div>
            <div className='summary-icon'>
              <MetricIcon icon='clock' />
            </div>
          </div>
          <div className='summary-value'>{summary.pending}</div>
          <div className='summary-foot'>
            <span>Need confirmation</span>
            <span className='trend-flat'>Monitor</span>
          </div>
        </article>
        <article className='card summary-card'>
          <div className='summary-top'>
            <div className='summary-label'>Expired</div>
            <div className='summary-icon'>
              <MetricIcon icon='warning' />
            </div>
          </div>
          <div className='summary-value'>{summary.expired}</div>
          <div className='summary-foot'>
            <span>Can be retried</span>
            <span className='trend-warn'>Review</span>
          </div>
        </article>
        <article className='card summary-card'>
          <div className='summary-top'>
            <div className='summary-label'>Failed</div>
            <div className='summary-icon'>
              <MetricIcon icon='warning' />
            </div>
          </div>
          <div className='summary-value'>{summary.failed}</div>
          <div className='summary-foot'>
            <span>Needs attention</span>
            <span className='trend-warn'>Investigate</span>
          </div>
        </article>
      </section>

      <section className='card'>
        <div className='card-head'>
          <div>
            <h2>Payment filters</h2>
            <p>Use status filters to narrow the current payment queue.</p>
          </div>
        </div>
        <div className='panel-body'>
          <div className='toolbar-left'>
            {(
              [
                'all',
                'succeeded',
                'pending',
                'expired',
                'failed',
                'refunded',
              ] as const
            ).map((status) => (
              <button
                key={status}
                className={`pill${statusFilter === status ? ' pill-active' : ''}`}
                type='button'
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All statuses' : status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className='table-shell'>
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Reference</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <TruncateCopy value={payment.id} label='Copy payment ID' />
                  <div className='cell-muted' title={payment.title}>
                    {payment.title}
                  </div>
                </td>
                <td>
                  <span className={`status ${statusTone(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td>{formatCurrency(payment.amount, payment.currency)}</td>
                <td>
                  <TruncateCopy
                    value={payment.orderId}
                    label='Copy order reference'
                  />
                </td>
                <td className='cell-muted'>
                  {formatRelativeTime(payment.updatedAt)}
                </td>
                <td>
                  {payment.status === 'expired' ? (
                    <button
                      className='btn btn-secondary'
                      type='button'
                      style={{ height: 36 }}
                      onClick={() => {
                        setDraft({
                          title: payment.title,
                          amount: payment.amount,
                          currency: payment.currency,
                          orderId: `${payment.orderId}`,
                          customerEmail: payment.customerEmail,
                          successUrl: payment.successUrl,
                        });
                        setCreateOpen(true);
                      }}
                      disabled={!merchant.walletConfigured}
                      title={
                        !merchant.walletConfigured
                          ? 'Add a payout wallet in Settings to create payments.'
                          : undefined
                      }
                    >
                      <RefreshIcon />
                      Retry
                    </button>
                  ) : (
                    <button
                      className='btn btn-secondary'
                      type='button'
                      style={{ height: 36 }}
                      onClick={() =>
                        router.push(`/payments/detail?id=${payment.id}`)
                      }
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

      <CreatePaymentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(payment) => {
          void payments.refresh();
          router.push(`/payments/detail?id=${payment.id}`);
        }}
        initialValues={draft}
        workspaceName={workspace.data?.name}
        workspaceSiteUrl={workspace.data?.siteUrl}
        walletConfigured={merchant.walletConfigured}
      />
    </>
  );
}
