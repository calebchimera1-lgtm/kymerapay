import { Camera, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

interface ImageUploaderProps {
  name: string;
  src: string | null;
  label: string;
  uploading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onRemove?: () => void;
}

/**
 * Photo/logo picker. Quick client-side checks for a friendly message; the
 * server re-validates, re-encodes and strips metadata regardless.
 */
export function ImageUploader({
  name,
  src,
  label,
  uploading,
  error,
  onUpload,
  onRemove,
}: ImageUploaderProps) {
  const inputId = useId();
  const errorId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar name={name} src={src} size="xl" />
        <label
          htmlFor={inputId}
          className="absolute -right-1 -bottom-1 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border-4 border-surface bg-primary text-primary-fg hover:bg-primary-hover"
        >
          {uploading ? (
            <Spinner className="size-4" label="Uploading" />
          ) : (
            <Camera className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">{label}</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT.join(',')}
          className="sr-only"
          disabled={uploading}
          aria-describedby={shownError ? errorId : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (!ACCEPT.includes(file.type))
              return setLocalError('Choose a PNG, JPEG or WebP image.');
            if (file.size > MAX_BYTES) return setLocalError('Images must be 2 MB or smaller.');
            setLocalError(null);
            onUpload(file);
          }}
        />
      </div>
      {shownError && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {shownError}
        </p>
      )}
      {src && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
        >
          Remove photo
        </Button>
      )}
    </div>
  );
}
