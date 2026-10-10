/**
 * QR decoding: the browser's native BarcodeDetector when available (fast,
 * hardware-accelerated on Android/Chrome), otherwise jsQR, loaded lazily so
 * it never weighs on the main bundle.
 */
interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorConstructor = new (options: { formats: string[] }) => NativeDetector;

let nativeDetector: NativeDetector | null | undefined;

async function getNativeDetector(): Promise<NativeDetector | null> {
  if (nativeDetector !== undefined) return nativeDetector;
  const Detector = (
    globalThis as {
      BarcodeDetector?: DetectorConstructor & { getSupportedFormats?: () => Promise<string[]> };
    }
  ).BarcodeDetector;
  try {
    const formats = (await Detector?.getSupportedFormats?.()) ?? [];
    nativeDetector =
      Detector && formats.includes('qr_code') ? new Detector({ formats: ['qr_code'] }) : null;
  } catch {
    nativeDetector = null;
  }
  return nativeDetector;
}

/** Decodes the first QR code visible in a video frame or image, or returns null. */
export async function decodeQr(
  source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
  canvas: HTMLCanvasElement,
) {
  const detector = await getNativeDetector();
  if (detector) {
    const [hit] = await detector.detect(source);
    return hit?.rawValue ?? null;
  }

  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!width || !height) return null;
  // Downscale large photos; QR detection does not need full resolution.
  const scale = Math.min(1, 1024 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import('jsqr');
  return (
    jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
  );
}
