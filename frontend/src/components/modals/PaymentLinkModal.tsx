'use client';

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { clampAmount } from '@/lib/format';
import type { PaymentLink } from '@/lib/types';
import { createEntityId } from '@/lib/utils';

type PaymentLinkModalProps = {
  open: boolean;
  onClose: () => void;
  link?: PaymentLink | null;
  onSaved: (link: PaymentLink) => void;
  workspaceSiteUrl?: string;
  walletConfigured?: boolean;
};

export default function PaymentLinkModal({
  open,
  onClose,
  link,
  onSaved,
  workspaceSiteUrl,
  walletConfigured = true,
}: PaymentLinkModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<PaymentLink['status']>('active');
  const [type, setType] = useState<PaymentLink['type']>('fixed');
  const [successUrl, setSuccessUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const baseSiteUrl = useMemo(() => {
    const source =
      workspaceSiteUrl?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000');
    return source.replace(/\/$/, '');
  }, [workspaceSiteUrl]);

  useEffect(() => {
    if (!open) return;
    setTitle(link?.title ?? '');
    setSlug(link?.slug ?? '');
    setAmount(link ? link.amount.toFixed(2) : '');
    const nextStatus = link?.status ?? (walletConfigured ? 'active' : 'draft');
    setStatus(nextStatus);
    setType(link?.type ?? 'fixed');
    setSuccessUrl(link?.successUrl ?? '');
    setError(null);
    setSubmitting(false);
  }, [open, link, walletConfigured]);

  const amountNumber = Number(amount || 0);
  const normalizedSlug = useMemo(
    () =>
      slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    [slug],
  );
  const canSubmit =
    title.trim().length > 2 &&
    normalizedSlug &&
    (type === 'open' || amountNumber > 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError(
        type === 'open'
          ? 'Enter a title and URL slug before saving the payment link.'
          : 'Enter a title, URL slug, and amount before saving the payment link.',
      );
      return;
    }

    if (!walletConfigured && status === 'active' && link?.status !== 'active') {
      setError('Add a payout wallet address in Settings before activating payment links.');
      toast.error('Add a payout wallet address before activating payment links.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();

    const payload: PaymentLink = {
      id: link?.id ?? createEntityId('link'),
      slug: normalizedSlug,
      title: title.trim(),
      status,
      amount: type === 'open' ? 0 : amountNumber,
      currency: link?.currency ?? 'USDT0',
      visits: link?.visits ?? 0,
      completedPayments: link?.completedPayments ?? 0,
      conversionRate: link?.conversionRate ?? 0,
      avgTimeToPay: link?.avgTimeToPay ?? '0m 00s',
      updatedAt: now,
      url: `${baseSiteUrl}/pay/${normalizedSlug}`,
      // Leave empty unless the merchant explicitly provides one.
      successUrl: successUrl.trim(),
      brandingLabel: link?.brandingLabel ?? 'Business theme · Emerald accent',
      type,
    };

    try {
      const saved = link
        ? await api.updatePaymentLink(link.id, payload)
        : await api.createPaymentLink(payload);
      onSaved(saved);
      toast.success(link ? 'Payment link updated.' : 'Payment link created.');
      onClose();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save the payment link.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size='large'
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={inputRef}
    >
      <form className='modal-main' onSubmit={handleSubmit}>
        <div className='card-head modal-head-inline'>
          <div>
            <h2 id={titleId}>
              {link ? 'Update payment link' : 'Create payment link'}
            </h2>
            <p id={descriptionId} className='cell-muted'>
              Configure a reusable hosted checkout URL for campaigns, invoices,
              or subscriptions.
            </p>
          </div>
          <button className='btn btn-secondary' type='button' onClick={onClose}>
            Close
          </button>
        </div>

        <div className='field'>
          <label htmlFor='link-title'>Link title</label>
          <input
            id='link-title'
            ref={inputRef}
            className='input'
            type='text'
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder='Quarterly invoice'
            required
          />
        </div>

        <div className='modal-grid'>
          <div className='field'>
            <label htmlFor='link-slug'>URL slug</label>
            <input
              id='link-slug'
              className='input'
              type='text'
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder='quarterly-invoice'
              required
            />
          </div>
          <div className='field'>
            <label htmlFor='link-amount'>Amount</label>
            <input
              id='link-amount'
              className='input'
              inputMode='decimal'
              type='text'
              value={amount}
              onChange={(event) => setAmount(clampAmount(event.target.value))}
              placeholder={
                type === 'open' ? 'Customer enters amount at checkout' : '25.00'
              }
              required={type !== 'open'}
              disabled={type === 'open'}
            />
          </div>
        </div>

        <div className='modal-grid'>
          <div className='field'>
            <label htmlFor='link-status'>Status</label>
            <select
              id='link-status'
              className='input'
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as PaymentLink['status'])
              }
            >
              <option value='draft'>Draft</option>
              <option value='active' disabled={!walletConfigured && link?.status !== 'active'}>Active</option>
              <option value='paused'>Paused</option>
            </select>
            {!walletConfigured ? (
              <span className='cell-muted'>
                Add a payout wallet in <a href='/settings?tab=profile'>Settings</a> to activate links.
              </span>
            ) : null}
          </div>
          <div className='field'>
            <label htmlFor='link-type'>Pricing mode</label>
            <select
              id='link-type'
              className='input'
              value={type}
              onChange={(event) =>
                setType(event.target.value as PaymentLink['type'])
              }
            >
              <option value='fixed'>Fixed price</option>
              <option value='open'>Open amount</option>
            </select>
          </div>
        </div>

        <div className='field'>
          <label htmlFor='link-success'>Success redirect URL</label>
          <input
            id='link-success'
            className='input'
            type='url'
            value={successUrl}
            onChange={(event) => setSuccessUrl(event.target.value)}
            placeholder={`${baseSiteUrl}/checkout/success`}
          />
        </div>

        {error ? <div className='form-error'>{error}</div> : null}

        <div className='footer-actions'>
          <span className='cell-muted'>
            Use an active link for live campaigns or keep it in draft while
            reviewing copy.
          </span>
          <div className='row-actions'>
            <button
              className='btn btn-secondary'
              type='button'
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className='btn btn-primary'
              type='submit'
              disabled={!canSubmit || submitting}
            >
              {submitting ? 'Saving...' : link ? 'Save changes' : 'Create link'}
            </button>
          </div>
        </div>
      </form>
      <aside className='modal-side'>
        <div className='summary-box'>
          <small>Checkout URL</small>
          <strong>
            {normalizedSlug
              ? `${baseSiteUrl.replace(/^https?:\/\//, '')}/pay/${normalizedSlug}`
              : 'Choose a slug'}
          </strong>
          <p className='cell-muted'>
            Visitors will see your hosted checkout as soon as the link is
            active.
          </p>
        </div>
      </aside>
    </Modal>
  );
}
