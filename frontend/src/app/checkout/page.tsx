'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Brand from '@/components/Brand';
import { QrCodeIcon, WalletIcon } from '@/components/Icons';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { decodeAbiParameters, erc20Abi, formatUnits, type Hex } from 'viem';
import * as QRCode from 'qrcode';
import { confluxTestnetAddChainParams } from '@/lib/chains';
import {
  confirmCheckoutPayment,
  confirmCheckoutPaymentWithTx,
  getCheckoutPayment,
  type CheckoutPayment,
} from '@/lib/checkout';
import TruncateCopy from '@/components/TruncateCopy';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

const paymentProcessorAbi = [
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'p',
        type: 'tuple',
        components: [
          { name: 'paymentId', type: 'bytes32' },
          { name: 'merchant', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'metadataHash', type: 'bytes32' },
        ],
      },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

function decodeErc20Revert(data: unknown) {
  const hex = typeof data === 'string' ? data : '';
  if (!hex.startsWith('0x') || hex.length < 10) return null;

  const selector = hex.slice(0, 10).toLowerCase();
  const args = `0x${hex.slice(10)}` as Hex;

  try {
    if (selector === '0xe450d38c') {
      // ERC20InsufficientBalance(address,uint256,uint256)
      const [sender, balance, needed] = decodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
        args,
      ) as readonly [`0x${string}`, bigint, bigint];
      return { type: 'balance' as const, sender, balance, needed };
    }

    if (selector === '0xfb8f41b2') {
      // ERC20InsufficientAllowance(address,uint256,uint256)
      const [spender, allowance, needed] = decodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
        args,
      ) as readonly [`0x${string}`, bigint, bigint];
      return { type: 'allowance' as const, spender, allowance, needed };
    }
  } catch {
    return null;
  }

  return null;
}

function formatCountdown(expiresAt: string, nowMs: number) {
  const diff = new Date(expiresAt).getTime() - nowMs;
  if (diff <= 0) return 'Expired';

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId') ?? '';
  const linkSlug = searchParams.get('link') ?? '';

  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<'idle' | 'switch' | 'approve' | 'pay'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<'wallet' | 'qr'>('wallet');
  const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);
  const [walletConnectQr, setWalletConnectQr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const activeChainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const { connect, connectors } = useConnect();
  const wcConnectingRef = useRef(false);

  const redirectAfterSuccess = useCallback(
    (successUrl: string | null | undefined) => {
      if (typeof window !== 'undefined' && successUrl) {
        try {
          const target = new URL(successUrl, window.location.origin);
          target.searchParams.set('paymentId', paymentId);
          window.location.assign(target.toString());
          return;
        } catch {
          // fallback to hosted success page if merchant URL is invalid
        }
      }

      router.replace(
        `/checkout/success?paymentId=${encodeURIComponent(paymentId)}`,
      );
    },
    [paymentId, router],
  );

  useEffect(() => {
    if (!paymentId && linkSlug) {
      router.replace(`/pay/${encodeURIComponent(linkSlug)}`);
      return;
    }

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
        const result = await getCheckoutPayment(paymentId);
        if (!cancelled) {
          setPayment(result);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load checkout session.',
          );
        }
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
  }, [linkSlug, paymentId, router]);

  useEffect(() => {
    if (!paymentId || !payment) return;
    if (payment.status === 'succeeded') {
      redirectAfterSuccess(payment.successUrl);
      return;
    }
    if (payment.status === 'expired') {
      router.replace(
        `/checkout/expired?paymentId=${encodeURIComponent(paymentId)}`,
      );
      return;
    }
    if (payment.status === 'failed') {
      router.replace(
        `/checkout/failed?paymentId=${encodeURIComponent(paymentId)}`,
      );
    }
  }, [payment, paymentId, redirectAfterSuccess, router]);

  useEffect(() => {
    if (!payment) return;
    if (payment.status !== 'pending') return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [payment]);

  useEffect(() => {
    if (!paymentId || !payment) return;
    if (payment.status !== 'pending') return;

    if (new Date(payment.expiresAt).getTime() <= nowMs) {
      router.replace(
        `/checkout/expired?paymentId=${encodeURIComponent(paymentId)}`,
      );
    }
  }, [nowMs, payment, paymentId, router]);

  const countdown = useMemo(
    () => (payment ? formatCountdown(payment.expiresAt, nowMs) : '--'),
    [payment, nowMs],
  );

  const onchainSession = Boolean(
    payment?.chain && payment.paymentIntent && payment.paymentSignature,
  );
  const requiredChainId = payment?.chain?.chainId ?? 71;
  const chainMismatch = isConnected && activeChainId !== requiredChainId;

  const requiredAmount = useMemo(() => {
    if (!payment?.paymentIntent?.amount) return null;
    try {
      return BigInt(payment.paymentIntent.amount);
    } catch {
      return null;
    }
  }, [payment?.paymentIntent?.amount]);

  const tokenAddress = payment?.chain?.usdt0Address as
    | `0x${string}`
    | undefined;
  const processorAddress = payment?.chain?.paymentProcessorAddress as
    | `0x${string}`
    | undefined;

  const { data: tokenDecimalsRaw } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(onchainSession && tokenAddress),
      staleTime: 60_000,
    },
  });

  const tokenDecimals = useMemo(() => {
    if (typeof tokenDecimalsRaw === 'number') return tokenDecimalsRaw;
    if (typeof tokenDecimalsRaw === 'bigint') return Number(tokenDecimalsRaw);
    return 6;
  }, [tokenDecimalsRaw]);

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address && tokenAddress ? [address] : undefined,
    query: {
      enabled: Boolean(onchainSession && address && tokenAddress),
      refetchInterval: paying !== 'idle' ? false : 10_000,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && processorAddress ? [address, processorAddress] : undefined,
    query: {
      enabled: Boolean(
        onchainSession && address && tokenAddress && processorAddress,
      ),
      refetchInterval: paying !== 'idle' ? false : 10_000,
    },
  });

  const needsApproval = useMemo(() => {
    if (!onchainSession) return false;
    if (!requiredAmount) return false;
    if (typeof allowance !== 'bigint') return true;
    return allowance < requiredAmount;
  }, [allowance, onchainSession, requiredAmount]);

  const hasEnoughBalance = useMemo(() => {
    if (!onchainSession) return true;
    if (!requiredAmount) return true;
    if (typeof tokenBalance !== 'bigint') return true;
    return tokenBalance >= requiredAmount;
  }, [onchainSession, requiredAmount, tokenBalance]);

  const balanceLabel = useMemo(() => {
    if (!onchainSession) return null;
    if (!isConnected) return null;
    if (typeof tokenBalance !== 'bigint') return 'Balance: — USDT0';
    const raw = formatUnits(tokenBalance, tokenDecimals);
    const num = Number(raw);
    const pretty = Number.isFinite(num)
      ? num.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : raw;
    return `Balance: ${pretty} USDT0`;
  }, [isConnected, onchainSession, tokenBalance, tokenDecimals]);

  const actionLabel = useMemo(() => {
    if (payment?.status !== 'pending') return 'Pay now';
    if (!onchainSession) return 'Pay now';
    if (!isConnected) return 'Connect wallet';
    if (!hasEnoughBalance) return 'Insufficient balance';
    if (chainMismatch) return 'Switch to Conflux Testnet';
    if (needsApproval) return 'Approve';
    return 'Pay';
  }, [
    chainMismatch,
    hasEnoughBalance,
    isConnected,
    needsApproval,
    onchainSession,
    payment?.status,
  ]);

  async function ensureConfluxChain() {
    if (!switchChainAsync)
      throw new Error('Wallet does not support network switching.');
    try {
      await switchChainAsync({ chainId: requiredChainId });
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code;
      if (
        code === 4902 ||
        String(err?.message ?? '')
          .toLowerCase()
          .includes('unrecognized chain')
      ) {
        if (
          typeof window === 'undefined' ||
          !(window as any).ethereum?.request
        ) {
          throw err;
        }
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [confluxTestnetAddChainParams],
        });
        await switchChainAsync({ chainId: requiredChainId });
        return;
      }
      throw err;
    }
  }

  async function handleWalletAction() {
    if (!paymentId) return;
    if (paying !== 'idle') return;
    setError(null);

    try {
      if (!onchainSession) {
        const confirmed = await confirmCheckoutPayment(paymentId);
        redirectAfterSuccess(confirmed.successUrl);
        return;
      }

      if (!openConnectModal && !isConnected) {
        throw new Error('Wallet connection is not available on this device.');
      }

      if (!isConnected) {
        openConnectModal?.();
        return;
      }

      if (chainMismatch) {
        setPaying('switch');
        await ensureConfluxChain();
        return;
      }

      if (!address) {
        throw new Error('Wallet not connected.');
      }

      if (!tokenAddress || !processorAddress || !requiredAmount) {
        throw new Error('Checkout session is missing onchain configuration.');
      }

      if (!publicClient) {
        throw new Error('Unable to access the blockchain client.');
      }

      if (!hasEnoughBalance) {
        throw new Error('Insufficient USDT0 balance to complete this payment.');
      }

      if (needsApproval) {
        setPaying('approve');
        let approvalHash: Hex;
        try {
          approvalHash = (await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [processorAddress, requiredAmount],
          })) as Hex;
        } catch (err) {
          // Some USDT-style tokens require setting allowance to 0 before changing it.
          const current = typeof allowance === 'bigint' ? allowance : BigInt(0);
          if (current > BigInt(0)) {
            const resetHash = (await writeContractAsync({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [processorAddress, BigInt(0)],
            })) as Hex;
            await publicClient.waitForTransactionReceipt({ hash: resetHash });
            approvalHash = (await writeContractAsync({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [processorAddress, requiredAmount],
            })) as Hex;
          } else {
            throw err;
          }
        }
        await publicClient.waitForTransactionReceipt({
          hash: approvalHash as Hex,
        });
        await refetchAllowance();
        return;
      }

      setPaying('pay');
      const intent = payment!.paymentIntent!;
      const sig = payment!.paymentSignature!;

      const txHash = await writeContractAsync({
        address: processorAddress,
        abi: paymentProcessorAbi,
        functionName: 'pay',
        args: [intent as any, sig as Hex],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });

      const confirmed = await confirmCheckoutPaymentWithTx(paymentId, {
        txHash: String(txHash),
        walletAddress: address,
      });

      redirectAfterSuccess(confirmed.successUrl);
    } catch (requestError) {
      const rawData =
        (requestError as any)?.cause?.data ??
        (requestError as any)?.data ??
        (requestError as any)?.cause?.cause?.data;
      const decoded = decodeErc20Revert(rawData);

      let nextError =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to complete payment.';

      if (decoded?.type === 'balance') {
        nextError = 'Insufficient USDT0 balance to complete this payment.';
      }

      if (decoded?.type === 'allowance') {
        nextError = 'Approval is required before completing this payment.';
      }

      if (nextError.toLowerCase().includes('expired')) {
        router.push(
          `/checkout/expired?paymentId=${encodeURIComponent(paymentId)}`,
        );
        return;
      }

      setError(nextError);
    } finally {
      setPaying('idle');
    }
  }

  async function handleGenerateWalletConnectQr() {
    if (wcConnectingRef.current) return;
    if (!walletConnectProjectId) {
      setError(
        'WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.',
      );
      return;
    }
    const wc = connectors.find((connector) => connector.id === 'walletConnect');
    if (!wc) {
      setError(
        'WalletConnect is not configured. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.',
      );
      return;
    }
    try {
      wcConnectingRef.current = true;
      setError(null);
      setWalletConnectUri(null);
      setWalletConnectQr(null);

      const provider = (await wc.getProvider()) as any;
      provider?.removeAllListeners?.('display_uri');
      provider?.on?.('display_uri', (uri: string) => {
        setWalletConnectUri(uri);
      });

      connect({ connector: wc, chainId: requiredChainId });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start WalletConnect session.',
      );
    } finally {
      wcConnectingRef.current = false;
    }
  }

  function handleDisconnect() {
    try {
      disconnect();
    } finally {
      setWalletConnectUri(null);
      setWalletConnectQr(null);
      setPaying('idle');
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function makeQr() {
      if (!walletConnectUri) return;
      try {
        const dataUrl = await QRCode.toDataURL(walletConnectUri, {
          width: 240,
          margin: 2,
        });
        if (!cancelled) setWalletConnectQr(dataUrl);
      } catch {
        // ignore
      }
    }
    void makeQr();
    return () => {
      cancelled = true;
    };
  }, [walletConnectUri]);

  if (loading) {
    return (
      <main className='checkout-wrap'>
        <section className='state-card'>
          <div className='state-body'>
            <h1>Loading checkout...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className='checkout-wrap'>
        <section className='state-card'>
          <div className='state-top'>
            <Brand />
            <span className='status warn'>Unavailable</span>
          </div>
          <div className='state-body'>
            <h1>Checkout session unavailable.</h1>
            <p className='cell-muted'>
              {error ?? 'Payment session not found.'}
            </p>
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
      <section className='checkout-shell'>
        <div className='checkout-card'>
          <div className='checkout-main'>
            <div className='checkout-top'>
              <Brand />
              <span className='secure-pill'>Secure checkout</span>
            </div>
            <h1>Complete your payment</h1>
            <p className='cell-muted'>
              This hosted checkout is secured for USDT0 payments on Conflux
              eSpace.
            </p>

            <div className='amount-box'>
              <small>Amount due</small>
              <strong>
                {payment.amount} {payment.currency}
              </strong>
            </div>

            <div className='meta-row'>
              <div className='meta-box'>
                <small>Merchant</small>
                <strong>{payment.merchantName}</strong>
              </div>
              <div className='meta-box'>
                <small>Order</small>
                <strong>
                  <TruncateCopy
                    value={payment.merchantOrderId ?? payment.paymentId}
                  />{' '}
                </strong>
              </div>
              <div className='meta-box'>
                <small>Expires</small>
                <strong>{countdown}</strong>
              </div>
            </div>

            <div className='switch-grid'>
              <button
                className={`switch-card${method === 'wallet' ? ' active' : ''}`}
                type='button'
                onClick={() => setMethod('wallet')}
              >
                <div className='switch-left'>
                  <div className='switch-icon'>
                    <WalletIcon />
                  </div>
                  <div>
                    <strong>Wallet payment</strong>
                    <div className='cell-muted'>
                      Direct wallet flow on Conflux eSpace.
                    </div>
                  </div>
                </div>
                <div className='radio'></div>
              </button>
              <button
                className={`switch-card${method === 'qr' ? ' active' : ''}`}
                type='button'
                onClick={() => setMethod('qr')}
              >
                <div className='switch-left'>
                  <div className='switch-icon'>
                    <QrCodeIcon />
                  </div>
                  <div>
                    <strong>QR payment</strong>
                    <div className='cell-muted'>
                      Scan from another device or wallet app.
                    </div>
                  </div>
                </div>
                <div className='radio'></div>
              </button>
            </div>
          </div>
        </div>

        <div className='checkout-card'>
          <div className='checkout-side'>
            {isConnected && address ? (
              <div className='note-row' style={{ marginBottom: 10 }}>
                <div className='row-copy'>
                  <strong>Wallet</strong>
                  <span className='code' title={address}>
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                  {balanceLabel ? (
                    <span className='cell-muted' style={{ marginTop: 4 }}>
                      {balanceLabel}
                    </span>
                  ) : null}
                </div>
                <button
                  className='link-inline'
                  type='button'
                  onClick={handleDisconnect}
                >
                  Disconnect
                </button>
              </div>
            ) : null}
            <div className='note-row'>
              <div className='row-copy'>
                <strong>Status</strong>
                <span>
                  {payment.status === 'pending'
                    ? 'Ready to pay'
                    : payment.status}
                </span>
              </div>
              <span
                className={`status ${payment.status === 'pending' ? 'ok' : 'warn'}`}
              >
                {payment.status}
              </span>
            </div>
            {error ? <div className='form-error'>{error}</div> : null}

            {method === 'qr' ? (
              <>
                <div className='checkout-note' style={{ marginTop: 0 }}>
                  Connect a wallet on your phone using WalletConnect, then
                  approve and pay from that device.
                </div>
                {walletConnectQr ? (
                  <div
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      padding: 12,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={walletConnectQr}
                      alt='WalletConnect QR code'
                      style={{
                        width: 240,
                        height: 240,
                        borderRadius: 16,
                        border: '1px solid rgba(226, 232, 240, 0.9)',
                      }}
                    />
                  </div>
                ) : (
                  <button
                    className='btn btn-secondary'
                    type='button'
                    onClick={() => void handleGenerateWalletConnectQr()}
                  >
                    Generate WalletConnect QR
                  </button>
                )}
                <button
                  className='btn btn-primary'
                  type='button'
                  onClick={() => void handleWalletAction()}
                  disabled={
                    payment.status !== 'pending' ||
                    (!hasEnoughBalance && isConnected)
                  }
                >
                  {actionLabel}
                </button>
              </>
            ) : (
              <button
                className='btn btn-primary'
                type='button'
                onClick={() => void handleWalletAction()}
                disabled={
                  payment.status !== 'pending' ||
                  paying !== 'idle' ||
                  (!hasEnoughBalance && isConnected)
                }
              >
                {paying === 'switch'
                  ? 'Switching...'
                  : paying === 'approve'
                    ? 'Approving...'
                    : paying === 'pay'
                      ? 'Paying...'
                      : actionLabel}
              </button>
            )}
            <button
              className='btn btn-secondary'
              type='button'
              onClick={() => router.push('/')}
            >
              Cancel
            </button>
            <div className='checkout-note'>
              Payment confirmation updates your merchant webhook events and
              dashboard timeline.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className='checkout-wrap'>
          <section className='state-card'>
            <div className='state-body'>
              <h1>Loading checkout...</h1>
            </div>
          </section>
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
