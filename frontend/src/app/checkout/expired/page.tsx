'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Brand from '@/components/Brand';
import { getCheckoutPayment } from '@/lib/checkout';

function CheckoutExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId') ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState('Merchant');
  const [amount, setAmount] = useState('--');
  const [currency, setCurrency] = useState('USDT0');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError('Missing payment reference.');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const checkoutPayment = await getCheckoutPayment(paymentId);
        if (cancelled) return;

        setMerchantName(checkoutPayment.merchantName);
        setAmount(checkoutPayment.amount);
        setCurrency(checkoutPayment.currency);
        setOrderId(checkoutPayment.merchantOrderId);
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load checkout session.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (loading) {
    return (
      <main className='checkout-wrap'>
        <section className='state-card'>
          <div className='state-body'>
            <h1>Loading checkout session...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (error || !paymentId) {
    return (
      <main className='checkout-wrap'>
        <section className='state-card'>
          <div className='state-top'>
            <Brand />
            <span className='status warn'>Unavailable</span>
          </div>
          <div className='state-body'>
            <h1>Unable to load checkout details.</h1>
            <p className='cell-muted'>{error ?? 'Payment not found.'}</p>
            <div className='state-actions'>
              <Link className='btn btn-primary' href='/'>
                Return home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className='checkout-wrap'>
      <section className='state-card'>
        <div className='state-top'>
          <Brand />
          <span className='status warn'>Payment expired</span>
        </div>
        <div className='state-body'>
          <h1>Your checkout session has expired.</h1>
          <p className='cell-muted'>
            The payment window has closed. Contact the merchant to request a new
            link.
          </p>
          <div className='amount-box'>
            <small>Amount due</small>
            <strong>
              {amount} {currency}
            </strong>
          </div>
          <div className='state-rows'>
            <div className='state-row'>
              <span>Order</span>
              <strong>{orderId ?? paymentId}</strong>
            </div>
            <div className='state-row'>
              <span>Merchant</span>
              <strong>{merchantName}</strong>
            </div>
          </div>
          <div className='state-actions'>
            <button
              className='btn btn-secondary'
              type='button'
              onClick={() => router.push('/')}
            >
              Return to merchant
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutExpiredPage() {
  return (
    <Suspense
      fallback={
        <main className='checkout-wrap'>
          <section className='state-card'>
            <div className='state-body'>
              <h1>Loading checkout session...</h1>
            </div>
          </section>
        </main>
      }
    >
      <CheckoutExpiredContent />
    </Suspense>
  );
}
