import { registerUserSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/feedback/FormAlert';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PinInput } from '@/components/forms/PinInput';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/auth.service';
import { applyServerErrors } from '@/utils/forms';
import { useRegistration } from './useRegistration';

const formSchema = registerUserSchema
  .extend({ confirmPin: z.string() })
  .refine((values) => values.pin === values.confirmPin, {
    path: ['confirmPin'],
    message: 'PINs do not match.',
  });

const SERVER_FIELDS = ['fullName', 'username', 'email', 'phone', 'password', 'pin'] as const;

export function PersonalRegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      pin: '',
      confirmPin: '',
    },
  });

  const mutation = useRegistration(authService.register, (error) =>
    setFormError(applyServerErrors(error, setError, SERVER_FIELDS)),
  );

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(({ confirmPin: _confirm, ...values }) => {
        setFormError(null);
        mutation.mutate(values);
      })}
    >
      <FormAlert message={formError} />
      <TextInput
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <TextInput
        label="Username"
        leading="@"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="caleb254"
        hint="Friends find and pay you with this."
        error={errors.username?.message}
        {...register('username')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextInput
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          hint="Kenyan mobile. Kept private."
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters with a letter and a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="grid grid-cols-2 gap-4">
        <PinInput
          label="Payment PIN"
          hint="4 digits to confirm payments."
          error={errors.pin?.message}
          {...register('pin')}
        />
        <PinInput
          label="Confirm PIN"
          error={errors.confirmPin?.message}
          {...register('confirmPin')}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={mutation.isPending}
        leftIcon={<UserPlus className="size-5" aria-hidden="true" />}
      >
        Create demo account
      </Button>
    </form>
  );
}
