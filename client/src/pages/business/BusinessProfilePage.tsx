import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, businessDetailsSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/feedback/FormAlert';
import { SelectInput } from '@/components/forms/SelectInput';
import { TextArea } from '@/components/forms/TextArea';
import { TextInput } from '@/components/forms/TextInput';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUploader } from '@/components/profile/ImageUploader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useUpdateBusiness, useUploadLogo } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { applyServerErrors } from '@/utils/forms';

const FIELDS = [
  'businessName',
  'category',
  'location',
  'description',
  'registrationNumber',
] as const;
const categoryOptions = BUSINESS_CATEGORIES.map((value) => ({
  value,
  label: BUSINESS_CATEGORY_LABELS[value],
}));

export function BusinessProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const business = user.business!;
  const update = useUpdateBusiness();
  const logo = useUploadLogo();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: {
      businessName: business.businessName,
      category: business.category,
      location: business.location,
      description: business.description ?? '',
      registrationNumber: business.registrationNumber ?? '',
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Business profile"
        description="What customers see when they find or pay you."
      />

      <Card>
        <CardBody className="flex flex-col items-center gap-2 py-8 text-center">
          <ImageUploader
            name={business.businessName}
            src={business.logoUrl}
            label="Upload a logo"
            uploading={logo.isPending}
            error={logo.error ? toApiClientError(logo.error).message : null}
            onUpload={(file) => logo.mutate(file)}
          />
          <h2 className="pt-2 text-lg font-bold">{business.businessName}</h2>
          <p className="text-sm text-fg-muted">@{user.username}</p>
          <Badge tone={business.isVerified ? 'success' : 'neutral'}>
            {business.isVerified ? 'Verified' : 'Unverified (demo)'}
          </Badge>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            noValidate
            className="space-y-5"
            onSubmit={handleSubmit((values) => {
              setFormError(null);
              setSaved(false);
              // Empty optional fields are sent as "" so the server clears them.
              update.mutate(
                {
                  ...values,
                  description: values.description ?? '',
                  registrationNumber: values.registrationNumber ?? '',
                },
                {
                  onSuccess: (account) => {
                    setSaved(true);
                    reset({
                      businessName: account.business!.businessName,
                      category: account.business!.category,
                      location: account.business!.location,
                      description: account.business!.description ?? '',
                      registrationNumber: account.business!.registrationNumber ?? '',
                    });
                  },
                  onError: (error) => setFormError(applyServerErrors(error, setError, FIELDS)),
                },
              );
            })}
          >
            <FormAlert message={formError} />
            <TextInput
              label="Business name"
              error={errors.businessName?.message}
              {...register('businessName')}
            />
            <SelectInput
              label="Category"
              options={categoryOptions}
              error={errors.category?.message}
              {...register('category')}
            />
            <TextInput
              label="Location"
              error={errors.location?.message}
              {...register('location')}
            />
            <TextArea
              label="About the business"
              maxLength={500}
              error={errors.description?.message}
              {...register('description')}
            />
            <TextInput
              label="Registration number (optional)"
              hint="Placeholder only — not verified in the demo. Visible only to you."
              error={errors.registrationNumber?.message}
              {...register('registrationNumber')}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={update.isPending} disabled={!isDirty}>
                Save changes
              </Button>
              {saved && !isDirty && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1 text-sm font-medium text-success"
                >
                  <Check className="size-4" aria-hidden="true" /> Saved
                </span>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
