import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/config/routes';
import { Button, Input, TypedSection, Alert } from '@/components/ui';

const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include one uppercase letter')
    .regex(/[a-z]/, 'Include one lowercase letter')
    .regex(/[0-9]/, 'Include one digit')
    .regex(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/, 'Include one special character'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError(null);
    try {
      const token = await authAPI.register(values.email, values.password);
      setToken(token);
      navigate(ROUTES.HOME, { replace: true });
    } catch {
      setError('Registration failed. Use a different email or check password rules.');
    }
  };

  return (
    <TypedSection title="Create account" meta="Required for create · optimize · export">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-5">
        {error && (
          <Alert variant="error" title="Registration failed">
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
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && (
            <p className="mt-1 font-mono text-[0.72rem] text-err">{errors.password.message}</p>
          )}
          <p className="mt-2 font-mono text-[0.68rem] text-ink-faint leading-relaxed">
            Min 8 chars · upper &amp; lower case · digit · special (!@#$…)
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Register'}
          </Button>
          <Link
            to={ROUTES.LOGIN}
            className="font-mono text-[0.72rem] text-ink-soft hover:text-accent transition-colors"
          >
            Sign in instead
          </Link>
        </div>
      </form>
    </TypedSection>
  );
}
