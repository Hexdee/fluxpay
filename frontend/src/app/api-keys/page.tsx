'use client';

import { useMemo, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { DownloadIcon, SearchIcon } from '@/components/Icons';
import TruncateCopy from '@/components/TruncateCopy';
import CreateApiKeyModal from '@/components/modals/CreateApiKeyModal';
import RotateApiKeyModal from '@/components/modals/RotateApiKeyModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/export';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { statusTone } from '@/lib/utils';

export default function ApiKeysPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  const apiKeys = useApiResource(api.apiKeys);
  const currentUser = useApiResource(api.currentUser);

  const filteredKeys = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (apiKeys.data ?? []).filter((key) =>
      query
        ? [key.label, key.environment, key.owner, key.prefix].some((value) =>
            value.toLowerCase().includes(query),
          )
        : true,
    );
  }, [apiKeys.data, search]);

  const selectedKey = useMemo(() => {
    if (!filteredKeys.length) return null;
    if (!selectedKeyId) return filteredKeys[0];
    return (
      filteredKeys.find((key) => key.id === selectedKeyId) ?? filteredKeys[0]
    );
  }, [filteredKeys, selectedKeyId]);

  function exportKeys() {
    downloadCsv(
      filteredKeys.map((key) => ({
        label: key.label,
        environment: key.environment,
        owner: key.owner,
        status: key.status,
        prefix: key.prefix,
        lastRotatedAt: key.lastRotatedAt,
      })),
      'api-keys.csv',
      [
        { key: 'label', label: 'Label' },
        { key: 'environment', label: 'Environment' },
        { key: 'owner', label: 'Owner' },
        { key: 'status', label: 'Status' },
        { key: 'prefix', label: 'Prefix' },
        { key: 'lastRotatedAt', label: 'Last Rotated' },
      ],
    );
  }

  return (
    <DashboardShell active='api'>
      <section className='page-header' id='api'>
        <div>
          <div className='eyebrow'>Developer access</div>
          <h1>Manage API keys and environment access.</h1>
          <p>
            Create environment-specific credentials, review ownership, and
            rotate secrets on schedule.
          </p>
        </div>
        <div className='header-meta'>
          <div className='meta-chip'>
            {apiKeys.data?.length ?? 0} active records
          </div>
          <div className='meta-chip'>{filteredKeys.length} in current view</div>
          <div className='meta-chip'>
            Selected {selectedKey?.label ?? 'none'}
          </div>
        </div>
      </section>

      <section className='layout-grid'>
        <article className='panel'>
          <div className='panel-head'>
            <div>
              <h2>Active keys</h2>
              <p className='cell-muted'>
                Review ownership, environment, and last rotation for each
                credential.
              </p>
            </div>
            <button
              className='btn btn-secondary'
              type='button'
              onClick={exportKeys}
            >
              <DownloadIcon />
              Export keys
            </button>
          </div>
          <div className='panel-body'>
            <div className='table-shell'>
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Environment</th>
                    <th>Secret</th>
                    <th>Created</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeys.map((key) => (
                    <tr
                      key={key.id}
                      className={
                        selectedKey?.id === key.id ? 'selected-row' : ''
                      }
                      onClick={() => setSelectedKeyId(key.id)}
                    >
                      <td>
                        <strong title={key.label}>{key.label}</strong>
                        <div className='cell-muted' title={key.prefix}>
                          {key.prefix}
                        </div>
                      </td>
                      <td>{key.environment}</td>
                      <td>
                        {key.revealedSecret ? (
                          <TruncateCopy
                            value={key.revealedSecret}
                            label='Copy API key'
                            head={10}
                            tail={10}
                          />
                        ) : (
                          <span className='cell-muted'>Unavailable</span>
                        )}
                      </td>
                      <td className='cell-muted'>
                        {formatDate(key.createdAt)}
                      </td>
                      <td className='cell-muted'>{key.owner}</td>
                      <td>
                        <span className={`status ${statusTone(key.status)}`}>
                          {key.status}
                        </span>
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
              <h2>Key health</h2>
              <p className='cell-muted'>
                Rotation reminders and scope checks for the selected key.
              </p>
            </div>
          </div>
          <div className='panel-body'>
            {selectedKey ? (
              <>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Selected key</strong>
                    <span>
                      {selectedKey.label} · {selectedKey.environment}
                    </span>
                  </div>
                  <span className={`status ${statusTone(selectedKey.status)}`}>
                    {selectedKey.status}
                  </span>
                </div>

                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Last rotation</strong>
                    <span>{formatRelativeTime(selectedKey.lastRotatedAt)}</span>
                  </div>
                  <span className='status info'>
                    {formatDate(selectedKey.lastRotatedAt)}
                  </span>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Access scopes</strong>
                    <span title={selectedKey.scopes.join(', ')}>
                      {selectedKey.scopes.join(', ')}
                    </span>
                  </div>
                  <span className='status ok'>
                    {selectedKey.scopes.length} scopes
                  </span>
                </div>
                <button
                  className='btn btn-primary'
                  type='button'
                  onClick={() => setCreateOpen(true)}
                >
                  Create new key
                </button>
                <button
                  className='btn btn-secondary'
                  type='button'
                  onClick={() => setRotateOpen(true)}
                >
                  Rotate selected
                </button>
              </>
            ) : (
              <div className='empty-state'>No keys found.</div>
            )}
          </div>
        </aside>
      </section>

      <CreateApiKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void apiKeys.refresh();
        }}
        ownerName={currentUser.data?.name ?? 'Account owner'}
      />
      <RotateApiKeyModal
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        apiKey={selectedKey}
        onCompleted={() => {
          void apiKeys.refresh();
        }}
      />
    </DashboardShell>
  );
}
