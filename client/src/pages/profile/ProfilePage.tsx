import { BUSINESS_CATEGORY_LABELS, formatKenyanPhone, type AuthUser } from '@app/shared';
import { Lock, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUploader } from '@/components/profile/ImageUploader';
import { PersonalDetailsForm } from '@/components/profile/PersonalDetailsForm';
import { useRemoveAvatar, useUploadAvatar } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';
import { MyQrPanel } from '@/components/qr/MyQrPanel';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSignOut } from '@/hooks/useSignOut';
import { useAuthStore } from '@/store/authStore';
import { formatMonthYear } from '@/utils/dates';

const ACCOUNT_TYPE: Record<AuthUser['role'], string> = {
  USER: 'Personal account',
  BUSINESS: 'Business account',
  ADMIN: 'Administrator',
  SYSTEM: 'System',
};

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const { signOut, pending } = useSignOut();

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />

      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          {user.business ? (
            <Avatar name={user.fullName} src={user.business.logoUrl} size="xl" />
          ) : (
            <AvatarEditor />
          )}
          <div>
            <h2 className="text-xl font-bold">{user.fullName}</h2>
            <p className="text-fg-muted">@{user.username}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge tone="primary">{ACCOUNT_TYPE[user.role]}</Badge>
            {user.role !== 'ADMIN' && <Badge>KES Wallet</Badge>}
            {user.isDemo && <Badge tone="accent">Demo account</Badge>}
          </div>
          <p className="text-sm text-fg-muted">Joined {formatMonthYear(user.createdAt)}</p>
        </CardBody>
      </Card>

      {user.role !== 'ADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>Your payment QR</CardTitle>
          </CardHeader>
          <CardBody className="pb-8">
            <MyQrPanel size={180} />
          </CardBody>
        </Card>
      )}

      {user.business ? (
        <Link
          to="/business/profile"
          className="flex items-center justify-between rounded-card border border-border bg-surface p-5 font-semibold shadow-card hover:border-border-strong"
        >
          Edit business profile & logo <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardBody>
            <PersonalDetailsForm />
          </CardBody>
        </Card>
      )}

      {user.business && (
        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            {!user.business.isVerified && <Badge tone="neutral">Unverified</Badge>}
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-border">
              <Row label="Business name" value={user.business.businessName} />
              <Row label="Category" value={BUSINESS_CATEGORY_LABELS[user.business.category]} />
              <Row label="Location" value={user.business.location} />
              {user.business.description && <Row label="About" value={user.business.description} />}
            </dl>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
            <Lock className="size-3.5" aria-hidden="true" /> Only visible to you
          </span>
        </CardHeader>
        <CardBody>
          <dl className="divide-y divide-border">
            <Row label="E-mail" value={user.email} />
            {user.phone && <Row label="Phone" value={formatKenyanPhone(user.phone)} />}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
          <Button
            variant="secondary"
            fullWidth
            loading={pending}
            onClick={() => void signOut()}
            leftIcon={<LogOut className="size-4" aria-hidden="true" />}
            className="text-danger"
          >
            Sign out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="text-sm font-medium break-words sm:text-right">{value}</dd>
    </div>
  );
}

function AvatarEditor() {
  const user = useAuthStore((state) => state.user)!;
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const error = upload.error ?? remove.error;
  return (
    <ImageUploader
      name={user.fullName}
      src={user.avatarUrl}
      label="Change profile photo"
      uploading={upload.isPending || remove.isPending}
      error={error ? toApiClientError(error).message : null}
      onUpload={(file) => upload.mutate(file)}
      onRemove={() => remove.mutate()}
    />
  );
}
