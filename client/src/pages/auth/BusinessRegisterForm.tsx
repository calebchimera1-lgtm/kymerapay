import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, registerBusinessSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/feedback/FormAlert';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PinInput } from '@/components/forms/PinInput';
import { SelectInput } from '@/components/forms/SelectInput';
import { TextArea } from '@/components/forms/TextArea';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/auth.service';
import { applyServerErrors } from '@/utils/forms';
import { useRegistration } from './useRegistration';

const formSchema = registerBusinessSchema
  .extend({ confirmPin: z.string() })
  .refine((values) => values.pin === values.confirmPin, {
    path: ['confirmPin'],
    message: 'PINs do not match.',
  });

const SERVER_FIELDS = [
  'businessName',
  'category',
  'location',
  'description',
  'registrationNumber',
  'username',
  'email',
  'phone',
  'password',
  'pin',
] as const;

const categoryOptions = BUSINESS_CATEGORIES.map((value) => ({
  value,
  label: BUSINESS_CATEGORY_LABELS[value],
}));

export function BusinessRegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: '',
      category: '' as never,
      location: '',
      description: '',
      registrationNumber: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      pin: '',
      confirmPin: '',
    },
  });

  const mutation = useRegistration(authService.registerBusiness, (error) =>
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
        label="Business name"
        autoComplete="organization"
        placeholder="Visible General Supplies Ltd"
        error={errors.businessName?.message}
        {...register('businessName')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Business username"
          leading="@"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="visiblegeneral"
          error={errors.username?.message}
          {...register('username')}
        />
        <SelectInput
          label="Category"
          placeholder="Choose a category"
          options={categoryOptions}
          error={errors.category?.message}
          {...register('category')}
        />
      </div>
      <TextInput
        label="Location"
        placeholder="Moi Avenue, Nairobi"
        error={errors.location?.message}
        {...register('location')}
      />
      <TextArea
        label="Description (optional)"
        maxLength={500}
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Business e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextInput
          label="Business phone"
          type="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>
      <TextInput
        label="Registration number (optional)"
        hint="Placeholder only — not verified in the demo."
        error={errors.registrationNumber?.message}
        {...register('registrationNumber')}
      />
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters with a letter and a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="grid grid-cols-2 gap-4">
        <PinInput label="Payment PIN" error={errors.pin?.message} {...register('pin')} />
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
        leftIcon={<Store className="size-5" aria-hidden="true" />}
      >
        Create business account
      </Button>
    </form>
  );
}
