'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { useMerchant } from '@/components/MerchantProvider';
import { useToast } from '@/components/ToastProvider';
import { useApiResource } from '@/hooks/useApiResource';
import { api, API_BASE } from '@/lib/api';

export default function SettingsPage() {
  return (
    <DashboardShell active='settings'>
      <SettingsPageContent />
    </DashboardShell>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const merchant = useMerchant();
  const workspace = useApiResource(api.workspace);

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab') ?? 'profile';
    const allowed = new Set([
      'profile',
      'branding',
      'checkout',
      'notifications',
    ]);
    return allowed.has(tab) ? tab : 'profile';
  }, [searchParams]);

  const [walletAddress, setWalletAddress] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandAccent, setBrandAccent] = useState('#10B981');
  const [buttonStyle, setButtonStyle] = useState<'rounded' | 'soft' | 'sharp'>(
    'rounded',
  );
  const [checkoutTheme, setCheckoutTheme] = useState<
    'dark-header' | 'light-minimal'
  >('dark-header');
  const [defaultExpiryMinutes, setDefaultExpiryMinutes] = useState(30);
  const [receiptBehavior, setReceiptBehavior] = useState<
    'optional' | 'always' | 'disabled'
  >('optional');
  const [redirectAfterPayment, setRedirectAfterPayment] = useState(true);
  const [showDescriptionOnCheckout, setShowDescriptionOnCheckout] =
    useState(true);
  const [notifyPaymentCreated, setNotifyPaymentCreated] = useState(true);
  const [notifyPaymentSucceeded, setNotifyPaymentSucceeded] = useState(true);
  const [notifyPaymentFailed, setNotifyPaymentFailed] = useState(true);
  const [notifyWebhookFailed, setNotifyWebhookFailed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profile = merchant.profile;
    if (!profile) return;

    const wallet =
      profile.walletAddress?.toLowerCase() ===
      '0x0000000000000000000000000000000000000000'
        ? ''
        : (profile.walletAddress ?? '');

    setWalletAddress(wallet);
    setBrandName(profile.brandName ?? profile.name ?? '');
    setBrandAccent(profile.brandAccent ?? '#10B981');
    setButtonStyle(profile.buttonStyle ?? 'rounded');
    setCheckoutTheme(profile.checkoutTheme ?? 'dark-header');
    setDefaultExpiryMinutes(profile.defaultExpiryMinutes ?? 30);
    setReceiptBehavior(profile.receiptBehavior ?? 'optional');
    setRedirectAfterPayment(profile.redirectAfterPayment ?? true);
    setShowDescriptionOnCheckout(profile.showDescriptionOnCheckout ?? true);
    setNotifyPaymentCreated(profile.notifyPaymentCreated ?? true);
    setNotifyPaymentSucceeded(profile.notifyPaymentSucceeded ?? true);
    setNotifyPaymentFailed(profile.notifyPaymentFailed ?? true);
    setNotifyWebhookFailed(profile.notifyWebhookFailed ?? true);
  }, [merchant.profile]);

  const walletIsValidOrEmpty = useMemo(() => {
    const trimmed = walletAddress.trim();
    if (!trimmed) return true;
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false;
    if (trimmed.toLowerCase() === '0x0000000000000000000000000000000000000000')
      return false;
    return true;
  }, [walletAddress]);

  const brandAccentIsValid = useMemo(
    () => /^#([0-9a-fA-F]{6})$/.test(brandAccent.trim()),
    [brandAccent],
  );

  const dirty = useMemo(() => {
    const profile = merchant.profile;
    if (!profile) return false;

    const currentWallet =
      profile.walletAddress?.toLowerCase() ===
      '0x0000000000000000000000000000000000000000'
        ? ''
        : (profile.walletAddress ?? '');

    if (activeTab === 'profile') {
      return currentWallet.trim() !== walletAddress.trim();
    }
    if (activeTab === 'branding') {
      return (
        (profile.brandName ?? profile.name ?? '').trim() !== brandName.trim() ||
        (profile.brandAccent ?? '#10B981').trim() !== brandAccent.trim() ||
        (profile.buttonStyle ?? 'rounded') !== buttonStyle ||
        (profile.checkoutTheme ?? 'dark-header') !== checkoutTheme
      );
    }
    if (activeTab === 'checkout') {
      return (
        (profile.defaultExpiryMinutes ?? 30) !== defaultExpiryMinutes ||
        (profile.receiptBehavior ?? 'optional') !== receiptBehavior ||
        (profile.redirectAfterPayment ?? true) !== redirectAfterPayment ||
        (profile.showDescriptionOnCheckout ?? true) !==
          showDescriptionOnCheckout
      );
    }
    if (activeTab === 'notifications') {
      return (
        (profile.notifyPaymentCreated ?? true) !== notifyPaymentCreated ||
        (profile.notifyPaymentSucceeded ?? true) !== notifyPaymentSucceeded ||
        (profile.notifyPaymentFailed ?? true) !== notifyPaymentFailed ||
        (profile.notifyWebhookFailed ?? true) !== notifyWebhookFailed
      );
    }
    return false;
  }, [
    activeTab,
    merchant.profile,
    walletAddress,
    brandName,
    brandAccent,
    buttonStyle,
    checkoutTheme,
    defaultExpiryMinutes,
    receiptBehavior,
    redirectAfterPayment,
    showDescriptionOnCheckout,
    notifyPaymentCreated,
    notifyPaymentSucceeded,
    notifyPaymentFailed,
    notifyWebhookFailed,
  ]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();

    if (!dirty) {
      toast.success('Nothing to save.');
      return;
    }

    if (activeTab === 'profile' && !walletIsValidOrEmpty) {
      toast.error('Enter a valid payout wallet address (or leave it blank).');
      return;
    }

    if (activeTab === 'branding') {
      if (brandName.trim().length < 2) {
        toast.error('Brand name must be at least 2 characters.');
        return;
      }
      if (!brandAccentIsValid) {
        toast.error(
          'Accent color must be a valid hex value (example: #10B981).',
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (activeTab === 'profile') {
        const trimmed = walletAddress.trim();
        await api.updateMe({ walletAddress: trimmed ? trimmed : null });
      }

      if (activeTab === 'branding') {
        await api.updateMe({
          brandName: brandName.trim(),
          brandAccent: brandAccent.trim(),
          buttonStyle,
          checkoutTheme,
        });
      }

      if (activeTab === 'checkout') {
        await api.updateMe({
          defaultExpiryMinutes,
          receiptBehavior,
          redirectAfterPayment,
          showDescriptionOnCheckout,
        });
      }

      if (activeTab === 'notifications') {
        await api.updateMe({
          notifyPaymentCreated,
          notifyPaymentSucceeded,
          notifyPaymentFailed,
          notifyWebhookFailed,
        });
      }

      toast.success('Settings saved.');
      merchant.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!dirty) return false;
    if (activeTab === 'profile') return walletIsValidOrEmpty;
    if (activeTab === 'branding')
      return brandName.trim().length >= 2 && brandAccentIsValid;
    return true;
  }, [
    activeTab,
    saving,
    dirty,
    walletIsValidOrEmpty,
    brandName,
    brandAccentIsValid,
  ]);

  return (
    <>
      <section className='page-header'>
        <div>
          <div className='eyebrow'>Settings</div>
          <h1>Settings</h1>
          <p>
            Manage payout details, branding, checkout defaults, and
            notifications.
          </p>
        </div>
      </section>

      <section className='settings-layout'>
        <aside className='panel settings-nav'>
          <div className='panel-head'>
            <h2>Sections</h2>
          </div>
          <div className='panel-body' style={{ gap: 10 }}>
            <button
              type='button'
              className={`settings-link${activeTab === 'profile' ? ' active' : ''}`}
              onClick={() => router.push('/settings?tab=profile')}
            >
              Profile
            </button>
            <button
              type='button'
              className={`settings-link${activeTab === 'branding' ? ' active' : ''}`}
              onClick={() => router.push('/settings?tab=branding')}
            >
              Branding
            </button>
            <button
              type='button'
              className={`settings-link${activeTab === 'checkout' ? ' active' : ''}`}
              onClick={() => router.push('/settings?tab=checkout')}
            >
              Checkout
            </button>
            <button
              type='button'
              className={`settings-link${activeTab === 'notifications' ? ' active' : ''}`}
              onClick={() => router.push('/settings?tab=notifications')}
            >
              Notifications
            </button>
          </div>
        </aside>

        <form className='panel' onSubmit={handleSave}>
          <div className='panel-head'>
            <div>
              <h2>
                {activeTab === 'profile'
                  ? 'Profile'
                  : activeTab === 'branding'
                    ? 'Branding'
                    : activeTab === 'checkout'
                      ? 'Checkout behavior'
                      : 'Notifications'}
              </h2>
              <p className='cell-muted'>
                {activeTab === 'profile'
                  ? 'Set your payout wallet address for receiving USDT0 payments.'
                  : activeTab === 'branding'
                    ? 'Customize how your checkout and payment links appear to customers.'
                    : activeTab === 'checkout'
                      ? 'Define default expiry and checkout experience behavior.'
                      : activeTab === 'notifications'
                        ? 'Choose which operational events should trigger emails.'
                        : 'Useful links and environment details for integrations.'}
              </p>
            </div>
            {activeTab === 'profile' ? (
              <span
                className={`status ${merchant.walletConfigured ? 'ok' : 'warn'}`}
              >
                {merchant.walletConfigured ? 'Ready' : 'Wallet missing'}
              </span>
            ) : null}
          </div>

          <div className='panel-body'>
            {activeTab === 'profile' ? (
              <>
                <div className='modal-grid'>
                  <div className='field'>
                    <label htmlFor='settings-name'>Name</label>
                    <input
                      id='settings-name'
                      className='input'
                      type='text'
                      value={merchant.profile?.name ?? ''}
                      readOnly
                    />
                  </div>
                  <div className='field'>
                    <label htmlFor='settings-email'>Email</label>
                    <input
                      id='settings-email'
                      className='input'
                      type='email'
                      value={merchant.profile?.email ?? ''}
                      readOnly
                    />
                  </div>
                </div>

                <div className='field'>
                  <label htmlFor='settings-wallet'>Payout wallet address</label>
                  <input
                    id='settings-wallet'
                    className='input'
                    type='text'
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder='0x...'
                    spellCheck={false}
                    autoComplete='off'
                  />
                  <div className='cell-muted'>
                    Payments are transferred to this address on Conflux eSpace.
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === 'branding' ? (
              <>
                <div className='modal-grid'>
                  <div className='field'>
                    <label htmlFor='settings-brand-name'>Brand name</label>
                    <input
                      id='settings-brand-name'
                      className='input'
                      type='text'
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder='Your business'
                      required
                    />
                  </div>
                  <div className='field'>
                    <label htmlFor='settings-brand-accent'>Accent color</label>
                    <input
                      id='settings-brand-accent'
                      className='input'
                      type='text'
                      value={brandAccent}
                      onChange={(e) => setBrandAccent(e.target.value)}
                      placeholder='#10B981'
                      spellCheck={false}
                      required
                    />
                    <div className='cell-muted'>
                      Hex color used for highlights and buttons.
                    </div>
                  </div>
                </div>

                <div className='modal-grid'>
                  <div className='field'>
                    <label htmlFor='settings-button-style'>Button style</label>
                    <select
                      id='settings-button-style'
                      className='input'
                      value={buttonStyle}
                      onChange={(e) =>
                        setButtonStyle(e.target.value as typeof buttonStyle)
                      }
                    >
                      <option value='rounded'>Rounded</option>
                      <option value='soft'>Soft</option>
                      <option value='sharp'>Sharp</option>
                    </select>
                  </div>
                  <div className='field'>
                    <label htmlFor='settings-checkout-theme'>
                      Checkout theme
                    </label>
                    <select
                      id='settings-checkout-theme'
                      className='input'
                      value={checkoutTheme}
                      onChange={(e) =>
                        setCheckoutTheme(e.target.value as typeof checkoutTheme)
                      }
                    >
                      <option value='dark-header'>Default dark header</option>
                      <option value='light-minimal'>Light minimal</option>
                    </select>
                  </div>
                </div>

                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Preview</strong>
                    <span>
                      Buttons and accents will use your current brand color.
                    </span>
                  </div>
                  <span
                    className='status ok'
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: 'white',
                      backgroundImage: `linear-gradient(135deg, ${brandAccent.trim()}33, rgba(15, 23, 42, 0.14))`,
                    }}
                  >
                    {brandAccentIsValid ? 'Valid color' : 'Check hex'}
                  </span>
                </div>
              </>
            ) : null}

            {activeTab === 'checkout' ? (
              <>
                <div className='modal-grid'>
                  <div className='field'>
                    <label htmlFor='settings-expiry'>Default expiry</label>
                    <select
                      id='settings-expiry'
                      className='input'
                      value={defaultExpiryMinutes}
                      onChange={(e) =>
                        setDefaultExpiryMinutes(Number(e.target.value))
                      }
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>
                  <div className='field'>
                    <label htmlFor='settings-receipt'>Receipt behavior</label>
                    <select
                      id='settings-receipt'
                      className='input'
                      value={receiptBehavior}
                      onChange={(e) =>
                        setReceiptBehavior(
                          e.target.value as typeof receiptBehavior,
                        )
                      }
                    >
                      <option value='optional'>Optional</option>
                      <option value='always'>Always send</option>
                      <option value='disabled'>Disabled</option>
                    </select>
                  </div>
                </div>

                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Redirect customers after payment</strong>
                    <span>
                      Send customers back to the merchant success URL if one is
                      provided.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${redirectAfterPayment ? ' active' : ''}`}
                    aria-pressed={redirectAfterPayment}
                    onClick={() => setRedirectAfterPayment((value) => !value)}
                    title={redirectAfterPayment ? 'Enabled' : 'Disabled'}
                  >
                    {redirectAfterPayment ? '✓' : ''}
                  </button>
                </div>

                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Show description on checkout</strong>
                    <span>
                      Display the payment description clearly during customer
                      checkout.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${showDescriptionOnCheckout ? ' active' : ''}`}
                    aria-pressed={showDescriptionOnCheckout}
                    onClick={() =>
                      setShowDescriptionOnCheckout((value) => !value)
                    }
                    title={showDescriptionOnCheckout ? 'Enabled' : 'Disabled'}
                  >
                    {showDescriptionOnCheckout ? '✓' : ''}
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === 'notifications' ? (
              <>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Payment created</strong>
                    <span>
                      Email the customer the hosted checkout link when a payment
                      is created.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${notifyPaymentCreated ? ' active' : ''}`}
                    aria-pressed={notifyPaymentCreated}
                    onClick={() => setNotifyPaymentCreated((value) => !value)}
                  >
                    {notifyPaymentCreated ? '✓' : ''}
                  </button>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Payment succeeded</strong>
                    <span>
                      Email the customer a receipt after successful payment.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${notifyPaymentSucceeded ? ' active' : ''}`}
                    aria-pressed={notifyPaymentSucceeded}
                    onClick={() => setNotifyPaymentSucceeded((value) => !value)}
                  >
                    {notifyPaymentSucceeded ? '✓' : ''}
                  </button>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Payment failed</strong>
                    <span>
                      Email the customer when a payment fails or expires.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${notifyPaymentFailed ? ' active' : ''}`}
                    aria-pressed={notifyPaymentFailed}
                    onClick={() => setNotifyPaymentFailed((value) => !value)}
                  >
                    {notifyPaymentFailed ? '✓' : ''}
                  </button>
                </div>
                <div className='note-row'>
                  <div className='row-copy'>
                    <strong>Webhook delivery failures</strong>
                    <span>
                      Email the merchant when webhook retries are exhausted.
                    </span>
                  </div>
                  <button
                    type='button'
                    className={`check${notifyWebhookFailed ? ' active' : ''}`}
                    aria-pressed={notifyWebhookFailed}
                    onClick={() => setNotifyWebhookFailed((value) => !value)}
                  >
                    {notifyWebhookFailed ? '✓' : ''}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className='panel-divider' />
          <div
            className='panel-body'
            style={{ display: 'flex', justifyContent: 'flex-end' }}
          >
            <button
              className='btn btn-primary'
              type='submit'
              disabled={!canSave}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
