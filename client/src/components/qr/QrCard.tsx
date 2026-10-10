import type { QrCodeDto } from '@app/shared';
import { Check, Download, Share2 } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';

interface QrCardProps {
  qr: QrCodeDto;
  title: string;
  subtitle: string;
  caption?: string;
  size?: number;
  actions?: boolean;
  className?: string;
}

/** Web link equivalent of the QR — opens the pay screen when a phone camera scans it. */
export function payLink(code: string): string {
  return `${window.location.origin}/pay/${code}`;
}

/**
 * A scannable payment code. Always dark-on-white (even in dark mode) because
 * scanners need the contrast. Encodes only the opaque code, never the
 * username or phone number.
 */
export function QrCard({
  qr,
  title,
  subtitle,
  caption,
  size = 220,
  actions = true,
  className,
}: QrCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = payLink(qr.code);
    const shareData = { title: `Pay ${title}`, text: `Pay ${title} on ${BRAND.name} (demo)`, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // The user dismissed the share sheet — nothing to do.
    }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${subtitle.replace(/^@/, '')}-${BRAND.qrScheme}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <figure className={cn('flex flex-col items-center gap-4 text-center', className)}>
      <div className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/5 print:shadow-none">
        <QRCodeSVG
          value={qr.payload}
          size={size}
          level="Q"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0b0f0d"
          title={`Payment QR code for ${title}`}
        />
        {/* Hidden high-resolution copy used for the PNG download. */}
        <QRCodeCanvas
          ref={canvasRef}
          value={qr.payload}
          size={720}
          level="Q"
          marginSize={4}
          className="hidden"
        />
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[#0b0f0d]">
          <LogoMark className="size-5" />
          <span className="text-xs font-bold tracking-wide">{BRAND.name} · DEMO</span>
        </div>
      </div>
      <figcaption className="space-y-0.5">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-fg-muted">{subtitle}</p>
        {caption && <p className="pt-1 text-xs text-fg-muted">{caption}</p>}
      </figcaption>
      {actions && (
        <div className="flex gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={download}
            leftIcon={<Download className="size-4" aria-hidden="true" />}
          >
            Download
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void share()}
            leftIcon={
              copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Share2 className="size-4" aria-hidden="true" />
              )
            }
          >
            {copied ? 'Link copied' : 'Share link'}
          </Button>
        </div>
      )}
    </figure>
  );
}
