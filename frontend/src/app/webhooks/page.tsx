'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { SearchIcon } from '@/components/Icons';
import { useToast } from '@/components/ToastProvider';
import WebhookEndpointActionModal from '@/components/modals/WebhookEndpointActionModal';
import WebhookEndpointModal from '@/components/modals/WebhookEndpointModal';
import WebhookEventModal from '@/components/modals/WebhookEventModal';
import TruncateCopy from '@/components/TruncateCopy';
import { useApiResource } from '@/hooks/useApiResource';
import { api } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import type { WebhookEndpoint, WebhookEvent } from '@/lib/types';
import { statusTone } from '@/lib/utils';

function WebhooksPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const composeMode = searchParams.get('compose');
  const [search, setSearch] = useState('');
  const [eventOpen, setEventOpen] = useState(false);
  const [endpointModalOpen, setEndpointModalOpen] = useState(
    () => composeMode === 'test',
  );
  const [endpointModalMode, setEndpointModalMode] = useState<'create' | 'test'>(
    () => (composeMode === 'test' ? 'test' : 'create'),
  );
  const [endpointActionOpen, setEndpointActionOpen] = useState(false);
  const [endpointActionMode, setEndpointActionMode] = useState<
    'rotate' | 'toggle'
  >('rotate');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    null,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const endpoints = useApiResource(api.webhookEndpoints);
  const events = useApiResource(api.webhookEvents);
  const payments = useApiResource(api.payments);
  const signingSecret = useApiResource(api.webhookSecret);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (events.data ?? []).filter((event) =>
      query
        ? [event.type, event.endpointId, event.requestId].some((value) =>
            value.toLowerCase().includes(query),
          )
        : true,
    );
  }, [events.data, search]);

  const filteredEndpoints = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (endpoints.data ?? []).filter((endpoint) =>
      query
        ? [endpoint.label, endpoint.url, endpoint.status].some((value) =>
            value.toLowerCase().includes(query),
          )
        : true,
    );
  }, [endpoints.data, search]);

  const scopedEvents = useMemo(() => {
    if (!selectedEndpointId) return filteredEvents;
    return filteredEvents.filter(
      (event) => event.endpointId === selectedEndpointId,
    );
  }, [filteredEvents, selectedEndpointId]);

  const selectedEndpoint = useMemo(() => {
    if (!filteredEndpoints.length) return null;
    if (!selectedEndpointId) return filteredEndpoints[0];
    return (
      filteredEndpoints.find(
        (endpoint) => endpoint.id === selectedEndpointId,
      ) ?? filteredEndpoints[0]
    );
  }, [filteredEndpoints, selectedEndpointId]);
  const selectedEvent = useMemo(
    () =>
      scopedEvents.find((event) => event.id === selectedEventId) ??
      scopedEvents[0] ??
      null,
    [scopedEvents, selectedEventId],
  );
  const eventEndpoint = useMemo(
    () =>
      (endpoints.data ?? []).find(
        (endpoint) => endpoint.id === selectedEvent?.endpointId,
      ) ?? null,
    [endpoints.data, selectedEvent?.endpointId],
  );
  const selectedPayment = useMemo(
    () =>
      (payments.data ?? []).find(
        (payment) => payment.id === selectedEvent?.paymentId,
      ) ?? null,
    [payments.data, selectedEvent?.paymentId],
  );

  async function resendEvent(event: WebhookEvent) {
    try {
      await api.resendWebhookEvent(event.id);
      toast.success('Webhook replay queued.');
      void events.refresh();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to resend webhook.',
      );
    }
  }

  return (
    <DashboardShell active='webhooks'>
      <section className='topbar'>
        <div className='search'>
          <SearchIcon />
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search events, endpoints, or request IDs'
            aria-label='Search webhook events'
          />
        </div>
        <div className='top-actions'>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() => {
              setEndpointModalMode('test');
              setEndpointModalOpen(true);
            }}
            disabled={!selectedEndpoint}
          >
            Test endpoint
          </button>
          <button
            className='btn btn-primary'
            type='button'
            onClick={() => {
              setEndpointModalMode('create');
              setEndpointModalOpen(true);
            }}
          >
            Add endpoint
          </button>
        </div>
      </section>

      <section className='page-header' id='webhooks'>
        <div>
          <div className='eyebrow'>Webhook events</div>
          <h1>Monitor webhook delivery and endpoint health.</h1>
          <p>
            Inspect event attempts, replay failed deliveries, and manage
            endpoint secrets from one place.
          </p>
        </div>
        <div className='header-meta'>
          <div className='meta-chip'>
            {endpoints.data?.length ?? 0} endpoints
          </div>
          <div className='meta-chip'>{scopedEvents.length} recent events</div>
          <div className='meta-chip'>
            Selected: {selectedEndpoint?.label ?? 'none'}
          </div>
        </div>
      </section>

      <section className='layout-grid'>
        <article className='panel'>
          <div className='panel-head'>
            <div>
              <h2>Endpoints</h2>
              <p className='cell-muted'>
                Select an endpoint to view deliveries.
              </p>
            </div>
          </div>
          <div className='panel-body'>
            <div className='table-shell'>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Secret key</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEndpoints.map((endpoint) => (
                    <tr
                      key={endpoint.id}
                      className={
                        selectedEndpoint?.id === endpoint.id
                          ? 'selected-row'
                          : ''
                      }
                      onClick={() => {
                        setSelectedEndpointId(endpoint.id);
                        setSelectedEventId(null);
                      }}
                    >
                      <td>
                        <strong title={endpoint.label}>{endpoint.label}</strong>
                      </td>
                      <td>
                        <span className='cell-muted' title={endpoint.url}>
                          <TruncateCopy
                            value={endpoint.url}
                            label='Copy endpoint URL'
                            head={11}
                            tail={5}
                            monospace={false}
                          />
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status ${statusTone(endpoint.status)}`}
                        >
                          {endpoint.status}
                        </span>
                      </td>
                      <td>
                        <TruncateCopy
                          value={
                            endpoint.secret ?? signingSecret.data?.secret ?? ''
                          }
                          label='Copy signing secret'
                          head={10}
                          tail={10}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='panel-divider' />

            <div className='panel-subhead'>
              <div>
                <h3>Recent deliveries</h3>
                <p className='cell-muted'>
                  Open any event to inspect payloads, headers, and retry
                  history.
                </p>
              </div>
              <button
                className='btn btn-secondary'
                type='button'
                onClick={() => setEventOpen(true)}
                disabled={!selectedEvent}
              >
                View logs
              </button>
            </div>

            <div className='table-shell'>
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Endpoint</th>
                    <th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedEvents.map((event) => (
                    <tr
                      key={event.id}
                      className={
                        selectedEvent?.id === event.id ? 'selected-row' : ''
                      }
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setSelectedEndpointId(event.endpointId);
                      }}
                    >
                      <td>
                        <strong>{event.type}</strong>
                        <div className='cell-muted'>
                          <TruncateCopy
                            value={event.requestId}
                            label='Copy request ID'
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`status ${statusTone(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td
                        className='cell-muted'
                        title={
                          (endpoints.data ?? []).find(
                            (endpoint) => endpoint.id === event.endpointId,
                          )?.label ?? event.endpointId
                        }
                      >
                        {(endpoints.data ?? []).find(
                          (endpoint) => endpoint.id === event.endpointId,
                        )?.label ?? event.endpointId}
                      </td>
                      <td className='cell-muted'>
                        {formatRelativeTime(
                          event.deliveredAt ?? event.createdAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <aside className='panel'>
          <div className='panel-head'>
            <div>
              <h2>Endpoint health</h2>
              <p className='cell-muted'>
                Review retry state and rotate the signing secret for the
                selected endpoint.
              </p>
            </div>
          </div>
          <div className='panel-body'>
            {selectedEndpoint ? (
              <>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Last event</strong>
                    <span>{formatDateTime(selectedEndpoint.lastEventAt)}</span>
                  </div>
                  <span className='status info'>
                    {selectedEndpoint.lastResponseCode}
                  </span>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Retry queue</strong>
                    <span>{selectedEndpoint.retryCount} pending retries</span>
                  </div>
                  <span
                    className={`status ${selectedEndpoint.retryCount ? 'warn' : 'ok'}`}
                  >
                    {selectedEndpoint.successRate}%
                  </span>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Secret rotation</strong>
                    <span>
                      {formatRelativeTime(selectedEndpoint.secretLastRotatedAt)}
                    </span>
                  </div>
                  <span className='status info'>managed</span>
                </div>
                <button
                  className='btn btn-primary'
                  type='button'
                  onClick={() => {
                    setEndpointActionMode('rotate');
                    setEndpointActionOpen(true);
                  }}
                >
                  Rotate secret
                </button>
                <button
                  className='btn btn-secondary'
                  type='button'
                  onClick={() => {
                    setEndpointActionMode('toggle');
                    setEndpointActionOpen(true);
                  }}
                >
                  {selectedEndpoint.status === 'paused'
                    ? 'Resume endpoint'
                    : 'Pause endpoint'}
                </button>
              </>
            ) : (
              <div className='empty-state'>No endpoints found.</div>
            )}
          </div>
        </aside>
      </section>

      <WebhookEventModal
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        event={selectedEvent}
        endpoint={eventEndpoint}
        payment={selectedPayment}
        canResend={(endpoints.data?.length ?? 0) > 0}
        onResend={(event) => void resendEvent(event)}
      />
      <WebhookEndpointModal
        open={endpointModalOpen}
        onClose={() => setEndpointModalOpen(false)}
        mode={endpointModalMode}
        endpoint={selectedEndpoint}
        onSaved={() => {
          void endpoints.refresh();
        }}
        onTested={() => {
          void events.refresh();
        }}
      />
      <WebhookEndpointActionModal
        open={endpointActionOpen}
        onClose={() => setEndpointActionOpen(false)}
        endpoint={selectedEndpoint as WebhookEndpoint | null}
        mode={endpointActionMode}
        onCompleted={() => {
          void endpoints.refresh();
        }}
      />
    </DashboardShell>
  );
}

export default function WebhooksPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell active='webhooks'>
          <div className='empty-state'>Loading webhook activity…</div>
        </DashboardShell>
      }
    >
      <WebhooksPageContent />
    </Suspense>
  );
}
