import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../config/routes';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password);
      navigate(ROUTES.HOME);
    } catch (err) {
      const detail = (err as AxiosError<{ detail?: string }>)?.response?.data?.detail;
      setError(detail || 'Registration failed. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'mt-1 block w-full px-3 py-2 border border-rule-strong rounded-md shadow-sm focus:ring-accent focus:border-accent text-sm bg-paper text-ink placeholder-ink-faint';

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <h1 className="text-2xl font-bold text-ink mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-soft">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-ink-faint">
            Min 8 chars with upper, lower, digit, and a special character.
          </p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-soft">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
