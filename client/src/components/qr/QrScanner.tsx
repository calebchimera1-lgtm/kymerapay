import { CameraOff, ImageUp, Keyboard, ScanLine } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { decodeQr } from '@/utils/qrDecode';

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable';

/**
 * Camera QR scanner with two fallbacks: decode an uploaded photo, or type/paste
 * the code. Emits the raw scanned text once; the caller validates it. Scanning
 * never pays — it only leads to a confirmation screen.
 */
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [manual, setManual] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const manualId = useId();
  const fileId = useId();

  canvasRef.current ??= document.createElement('canvas');

  function emit(text: string) {
    if (doneRef.current) return;
    doneRef.current = true;
    onResult(text);
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled)
          setCamera((err as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable');
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCamera('scanning');

      // ~6 decodes per second is plenty and keeps phones cool.
      let last = 0;
      const tick = async (time: number) => {
        if (cancelled || doneRef.current) return;
        if (time - last > 160 && video.readyState >= 2) {
          last = time;
          const text = await decodeQr(video, canvasRef.current!).catch(() => null);
          if (text) {
            emit(text);
            return;
          }
        }
        frame = requestAnimationFrame((t) => void tick(t));
      };
      frame = requestAnimationFrame((t) => void tick(t));
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // `emit` is stable for the lifetime of the scanner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decodeFile(file: File) {
    setUploadError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodeQr(bitmap, canvasRef.current!);
      if (text) emit(text);
      else setUploadError('No QR code found in that image. Try a clearer photo.');
    } catch {
      setUploadError('That file could not be read as an image.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
          aria-label="Camera preview"
        />
        {camera === 'scanning' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-10 rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
          />
        )}
        {camera !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {camera === 'starting' ? (
              <>
                <Spinner className="size-6" label="Starting camera" />
                <p className="text-sm">Starting camera…</p>
              </>
            ) : (
              <>
                <CameraOff className="size-8 opacity-80" aria-hidden="true" />
                <p className="text-sm">
                  {camera === 'denied'
                    ? 'Camera access was blocked. Allow it in your browser settings, or use a photo or the code below.'
                    : 'No camera available. Upload a photo of the QR code or enter the code below.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
      <p
        className="flex items-center justify-center gap-2 text-sm text-fg-muted"
        aria-live="polite"
      >
        <ScanLine className="size-4" aria-hidden="true" />
        {camera === 'scanning' ? 'Point your camera at a payment QR code.' : 'Other ways to scan:'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor={fileId}
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-semibold hover:bg-surface-muted"
          >
            <ImageUp className="size-4" aria-hidden="true" /> Upload a photo
          </label>
          <input
            id={fileId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void decodeFile(file);
              event.target.value = '';
            }}
          />
          {uploadError && (
            <p role="alert" className="text-xs font-medium text-danger">
              {uploadError}
            </p>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (manual.trim()) emit(manual.trim());
          }}
        >
          <label htmlFor={manualId} className="sr-only">
            Enter or paste a QR code
          </label>
          <input
            id={manualId}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Paste code or link"
            autoCapitalize="none"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            className="size-12"
            aria-label="Use this code"
          >
            <Keyboard className="size-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}
