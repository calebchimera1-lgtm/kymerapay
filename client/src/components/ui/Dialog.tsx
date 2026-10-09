import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Block closing (Escape, backdrop, ✕) while an action is in flight. */
  dismissible?: boolean;
  className?: string;
}

/**
 * Modal built on the native <dialog>: the browser provides focus trapping,
 * Escape handling and an inert background. Bottom sheet on phones, centred
 * card on larger screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && dismissible) onClose();
      }}
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-[1.75rem] bg-surface p-0 text-fg shadow-raised backdrop:bg-black/50 backdrop:backdrop-blur-[2px]',
        'sm:m-auto sm:max-w-md sm:rounded-[1.75rem]',
        'open:animate-rise-in',
        className,
      )}
    >
      <div className="max-h-[90dvh] overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close"
            className="-mt-1 -mr-2 inline-flex size-10 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
