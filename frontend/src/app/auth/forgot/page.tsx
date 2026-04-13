"use client";

import { FormEvent, useState } from 'react';
import AuthShell from '@/components/AuthShell';
import { forgotPassword } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await forgotPassword({ email });
      const suffix = response.devCode ? ` Code: ${response.devCode}` : "";
      setMessage(`${response.message}${suffix}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send reset code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title='Forgot your password?'
      description='We will email a reset code to the address associated with your account.'
      onSubmit={handleSubmit}
      footer={
        <span>
          Remembered it? <a href='/auth'>Back to sign in</a>
        </span>
      }
    >
      <div className='field'>
        <label htmlFor='email'>Email address</label>
        <input
          id='email'
          name='email'
          className='input'
          type='email'
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder='name@company.com'
          autoComplete='email'
          required
        />
        <span className='field-error'>Enter a valid email address.</span>
      </div>
      {message ? <div className='status info'>{message}</div> : null}
      {error ? <div className='form-error'>{error}</div> : null}
      <button className='btn btn-primary' type='submit' disabled={submitting}>
        {submitting ? 'Sending...' : 'Send reset code'}
      </button>
    </AuthShell>
  );
}
