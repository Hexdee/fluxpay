'use client';

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { clampAmount, formatCurrency } from '@/lib/format';
import type { Payment } from '@/lib/types';
import { createEntityId } from '@/lib/utils';

type PaymentFormValues = {
  title?: string;
  amount?: number;
  currency?: string;
  orderId?: string;
  successUrl?: string;
  customerEmail?: string;
};

type CreatePaymentModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (payment: Payment) => void;
  initialValues?: PaymentFormValues;
  workspaceName?: string;
  workspaceSiteUrl?: string;
  walletConfigured?: boolean;
};

export default function CreatePaymentModal({
  open,
  onClose,
  onCreated,
  initialValues,
  workspaceName = 'Your business',
  workspaceSiteUrl,
  walletConfigured = true,
}: CreatePaymentModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [amount, setAmount] = useState(initialValues?.amount?.toFixed(2) ?? '');
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'USDT0');
  const [orderId, setOrderId] = useState(initialValues?.orderId ?? '');
  const [successUrl, setSuccessUrl] = useState(initialValues?.successUrl ?? '');
  const [customerEmail, setCustomerEmail] = useState(
    initialValues?.customerEmail ?? '',
  );
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
    setTitle(initialValues?.title ?? '');
    setAmount(initialValues?.amount?.toFixed(2) ?? '');
    setCurrency(initialValues?.currency ?? 'USDT0');
    setOrderId(initialValues?.orderId ?? '');
    setSuccessUrl(initialValues?.successUrl ?? '');
    setCustomerEmail(initialValues?.customerEmail ?? '');
    setError(null);
    setSubmitting(false);
  }, [open, initialValues]);

  const amountNumber = Number(amount || 0);
  const previewAmount =
    amountNumber > 0
      ? formatCurrency(amountNumber, currency)
      : `0.00 ${currency}`;
  const normalizedEmail = customerEmail.trim();
  const emailIsValid = /\S+@\S+\.\S+/.test(normalizedEmail);
  const canSubmit =
    title.trim().length > 0 &&
    amountNumber > 0 &&
    orderId.trim().length > 0 &&
    emailIsValid &&
    walletConfigured;
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError(
        walletConfigured
          ? 'Enter a title, amount, order reference, and valid customer email to create the payment.'
          : 'Add a payout wallet address in Settings before creating payments.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const paymentId = createEntityId('pay');
    const payment: Payment = {
      id: paymentId,
      title: title.trim(),
      amount: amountNumber,
      currency,
      status: 'pending',
      orderId: orderId.trim(),
      customerEmail: normalizedEmail,
      customerWallet: 'Pending',
      checkoutUrl: `${baseSiteUrl}/checkout?paymentId=${paymentId}`,
      // Leave empty unless the merchant explicitly provides one.
      successUrl: successUrl.trim(),
      createdAt: now,
      updatedAt: now,
      settlementStatus: 'Awaiting payment',
      settlementUpdatedAt: now,
      webhookSummary: 'payment.pending queued',
      refundableAmount: 0,
      timeline: [
        {
          id: createEntityId('timeline'),
          title: 'Payment created',
          detail:
            'A hosted checkout session is ready to share with the customer.',
          at: now,
          tone: 'ok',
        },
      ],
    };

    try {
      const created = await api.createPayment(payment);
      onCreated(created);
      toast.success('Payment created.');
      onClose();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to create payment.';
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
            <h2 id={titleId}>Create payment</h2>
            <p id={descriptionId} className='cell-muted'>
              Create a checkout request and send the hosted payment URL to the
              customer.
            </p>
          </div>
          <button className='btn btn-secondary' type='button' onClick={onClose}>
            Close
          </button>
        </div>

        {!walletConfigured ? (
          <div className='note-row' style={{ marginBottom: 8 }}>
            <div className='row-copy'>
              <strong>Payout wallet required</strong>
              <span>
                Add a payout wallet in <a href='/settings?tab=profile'>Settings</a> before creating payments.
              </span>
            </div>
            <span className='status warn'>Blocked</span>
          </div>
        ) : null}

        <div className='field'>
          <label htmlFor='payment-title'>Payment name</label>
          <input
            id='payment-title'
            ref={inputRef}
            className='input'
            type='text'
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder='Pro plan renewal'
            required
          />
        </div>

        <div className='modal-grid'>
          <div className='field'>
            <label htmlFor='payment-amount'>Amount</label>
            <input
              id='payment-amount'
              className='input'
              inputMode='decimal'
              type='text'
              value={amount}
              onChange={(event) => setAmount(clampAmount(event.target.value))}
              placeholder='25.00'
              required
            />
          </div>
          <div className='field'>
            <label htmlFor='payment-currency'>Token</label>
            <select
              id='payment-currency'
              className='input'
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value='USDT0'>USDT0</option>
            </select>
          </div>
        </div>

        <div className='modal-grid'>
          <div className='field'>
            <label htmlFor='payment-order'>Order reference</label>
            <input
              id='payment-order'
              className='input'
              type='text'
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder='order_3021'
              required
            />
          </div>
          <div className='field'>
            <label htmlFor='payment-email'>Customer email</label>
            <input
              id='payment-email'
              className='input'
              type='email'
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder='billing@customer.com'
              required
            />
          </div>
        </div>

        <div className='field'>
          <label htmlFor='payment-success'>Success URL</label>
          <input
            id='payment-success'
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
            The checkout link is created immediately and can be shared right
            away.
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
              {submitting ? 'Creating...' : 'Create payment'}
            </button>
          </div>
        </div>
      </form>
      <aside className='modal-side'>
        <div className='summary-box'>
          <small>Preview</small>
          <strong>{previewAmount}</strong>
          <p className='cell-muted'>{workspaceName} hosted checkout</p>
        </div>
        <div className='note-row'>
          <div className='row-copy'>
            <strong>Reference</strong>
            <span
              title={orderId || 'Add an order reference for reconciliation.'}
            >
              {orderId || 'Add an order reference for reconciliation.'}
            </span>
          </div>
        </div>
        <div className='note-row'>
          <div className='row-copy'>
            <strong>Customer follow-up</strong>
            <span
              title={
                customerEmail ||
                'Receipt email is optional and can be added later.'
              }
            >
              {customerEmail ||
                'Receipt email is optional and can be added later.'}
            </span>
          </div>
        </div>
      </aside>
    </Modal>
  );
}
