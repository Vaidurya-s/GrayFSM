import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/config/routes';
import { Button, Input, TypedSection, Alert } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setToken = useAuthStore((s) => s.setToken);
  const [error, setError] = useState<string | null>(null);

  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const from =
    (redirectParam && redirectParam.startsWith('/') ? redirectParam : null) ??
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    ROUTES.HOME;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const token = await authAPI.login(values.email, values.password);
      setToken(token);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <TypedSection title="Sign in" meta="Catalog access · write operations">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-5">
        {error && (
          <Alert variant="error" title="Authentication failed">
            {error}
          </Alert>
        )}

        <div>
          <label htmlFor="email" className="block font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint mb-1">
            Email
          </label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && (
            <p className="mt-1 font-mono text-[0.72rem] text-err">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint mb-1">
            Password
          </label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && (
            <p className="mt-1 font-mono text-[0.72rem] text-err">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link
            to={ROUTES.REGISTER}
            className="font-mono text-[0.72rem] text-ink-soft hover:text-accent transition-colors"
          >
            Create account
          </Link>
        </div>
      </form>
    </TypedSection>
  );
}
