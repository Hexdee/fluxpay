'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { clampAmount, formatCurrency } from '@/lib/format';
import type { Payment, Refund } from '@/lib/types';
import { createEntityId } from '@/lib/utils';

type RefundModalProps = {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onCompleted: (payment: Payment) => void;
};

export default function RefundModal({
  open,
  onClose,
  payment,
  onCompleted,
}: RefundModalProps) {
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [amount, setAmount] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [reasonCode, setReasonCode] = useState('customer_request');
  const [note, setNote] = useState('');
  const [sendWebhook, setSendWebhook] = useState(true);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !payment) return;
    setAmount(payment.refundableAmount.toFixed(2));
    setRefundType('full');
    setReasonCode('customer_request');
    setNote('Refund approved after customer cancellation request.');
    setSendWebhook(true);
    setConfirmation(false);
    setError(null);
    setSubmitting(false);
  }, [open, payment]);

  const amountNumber = Number(amount || 0);
  const canSubmit =
    !!payment &&
    amountNumber > 0 &&
    amountNumber <= payment.refundableAmount &&
    confirmation;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payment) return;

    if (!canSubmit) {
      setError(
        'Confirm the refund amount and acknowledge that refunds cannot be undone.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();

    const refund: Refund = {
      id: createEntityId('refund'),
      paymentId: payment.id,
      amount: amountNumber,
      reason: `${reasonCode}${note.trim() ? `: ${note.trim()}` : ''}`,
      createdAt: now,
    };

    const remainingAmount = Math.max(
      payment.refundableAmount - amountNumber,
      0,
    );
    const updatedPayment: Partial<Payment> = {
      status: remainingAmount === 0 ? 'refunded' : payment.status,
      refundableAmount: remainingAmount,
      updatedAt: now,
      settlementStatus:
        remainingAmount === 0 ? 'Refunded' : payment.settlementStatus,
      timeline: [
        {
          id: createEntityId('timeline'),
          title:
            remainingAmount === 0
              ? 'Payment refunded'
              : 'Partial refund issued',
          detail: `${formatCurrency(amountNumber, payment.currency)} refunded. ${note.trim() || 'Customer request.'}`,
          at: now,
          tone: 'warn',
        },
        ...payment.timeline,
      ],
    };

    try {
      await api.createRefund(refund);
      const saved = await api.updatePayment(payment.id, updatedPayment);
      if (sendWebhook) {
        const endpoints = await api.webhookEndpoints();
        const selectedEndpoint = endpoints[0];
        if (selectedEndpoint) {
          await api.createWebhookEvent({
            id: createEntityId('evt'),
            type: 'payment.refunded',
            paymentId: payment.id,
            endpointId: selectedEndpoint.id,
            status: 'delivered',
            createdAt: now,
            deliveredAt: now,
            requestId: createEntityId('req'),
            signature: 'valid',
            payload: {
              id: createEntityId('evt'),
              type: 'payment.refunded',
              created: now,
              data: {
                payment_id: payment.id,
                amount: amountNumber.toFixed(2),
                token: payment.currency,
              },
            },
            headers: [
              { name: 'content-type', value: 'application/json' },
              { name: 'x-request-id', value: createEntityId('req') },
            ],
            attempts: [
              {
                id: createEntityId('attempt'),
                at: now,
                statusCode: 200,
                note: 'Refund webhook delivered.',
              },
            ],
            responseBody: '{"received":true}',
          });
        }
      }
      onCompleted(saved);
      toast.success('Refund issued.');
      onClose();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to issue the refund.';
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
            <h2 id={titleId}>Issue refund</h2>
            <p id={descriptionId} className='cell-muted'>
              Confirm the amount and reason before sending the refund request.
            </p>
          </div>
          <button className='btn btn-secondary' type='button' onClick={onClose}>
            Close
          </button>
        </div>

        {payment ? (
          <>
            <div className='note-row'>
              <div className='row-copy'>
                <strong>Payment</strong>
                <span>
                  {payment.id} ·{' '}
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
              <span className='status ok'>{payment.status}</span>
            </div>

            <div className='modal-section'>
              <h3>Refund amount</h3>
              <div className='modal-grid'>
                <div className='field'>
                  <label htmlFor='refund-amount'>Amount</label>
                  <div className='input-wrap'>
                    <span className='input-prefix'>$</span>
                    <input
                      id='refund-amount'
                      ref={inputRef}
                      className='input with-prefix'
                      inputMode='decimal'
                      type='text'
                      value={amount}
                      onChange={(event) =>
                        setAmount(clampAmount(event.target.value))
                      }
                      placeholder={payment.refundableAmount.toFixed(2)}
                      required
                      disabled={refundType === 'full'}
                    />
                  </div>
                </div>
                <div className='field'>
                  <label htmlFor='refund-type'>Type</label>
                  <select
                    id='refund-type'
                    className='input'
                    value={refundType}
                    onChange={(event) => {
                      const value = event.target.value as 'full' | 'partial';
                      setRefundType(value);
                      if (value === 'full' && payment) {
                        setAmount(payment.refundableAmount.toFixed(2));
                      }
                    }}
                  >
                    <option value='full'>Full refund</option>
                    <option value='partial'>Partial refund</option>
                  </select>
                </div>
              </div>
              <div className='modal-field-help'>
                Original payment amount:{' '}
                {formatCurrency(payment.amount, payment.currency)}
              </div>
            </div>

            <div className='modal-section'>
              <h3>Reason</h3>
              <div className='field'>
                <label htmlFor='refund-reason'>Category</label>
                <select
                  id='refund-reason'
                  className='input'
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                >
                  <option value='customer_request'>Customer request</option>
                  <option value='duplicate_payment'>Duplicate payment</option>
                  <option value='service_issue'>Service issue</option>
                  <option value='other'>Other</option>
                </select>
              </div>
              <textarea
                className='modal-textarea'
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <label className='checkbox-row'>
              <input
                type='checkbox'
                checked={confirmation}
                onChange={(event) => setConfirmation(event.target.checked)}
              />
              <span>
                I understand refunds cannot be reversed after submission.
              </span>
            </label>

            {error ? <div className='form-error'>{error}</div> : null}

            <div className='footer-actions'>
              <span className='cell-muted'>
                Available to refund:{' '}
                {formatCurrency(payment.refundableAmount, payment.currency)}
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
                  className='btn btn-danger'
                  type='submit'
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? 'Issuing...' : 'Issue refund'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className='empty-state'>
            Select a payment before issuing a refund.
          </div>
        )}
      </form>
      <aside className='modal-side'>
        {payment ? (
          <>
            <div className='summary-gradient'>
              <small>Refund summary</small>
              <strong>
                {formatCurrency(amountNumber || 0, payment.currency)}
              </strong>
              <p>
                {refundType === 'full' ? 'Full refund' : 'Partial refund'} for{' '}
                {payment.id}
              </p>
            </div>
            <div className='note-row'>
              <div className='row-copy'>
                <strong>Customer</strong>
                <span>{payment.customerEmail}</span>
              </div>
            </div>
            <div className='note-row'>
              <div className='row-copy'>
                <strong>Webhook</strong>
                <span>`payment.refunded` event dispatch</span>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </Modal>
  );
}
