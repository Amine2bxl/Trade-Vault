// Shared client-side image compression. Used by Trade and Missed Setup uploads so
// large high-DPI screenshots (often >8 MB PNG) never fail on upload/size limits.

const MAX_EDGE = 1920; // preserve chart legibility on the long edge
const QUALITY = 0.92; // keeps candlestick text crisp while staying reasonable in size

function drawToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > MAX_EDGE || h > MAX_EDGE) {
          const ratio = Math.min(MAX_EDGE / w, MAX_EDGE / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Compress to a base64 JPEG data URL (stored inline, e.g. Trade screenshots). */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const canvas = await drawToCanvas(file);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

/** Compress to a JPEG File (uploaded to storage, e.g. Missed Setup screenshots). */
export async function compressImageToFile(file: File): Promise<File> {
  const canvas = await drawToCanvas(file);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', QUALITY)
  );
  if (!blob) throw new Error('Image compression failed');
  return new File([blob], `shot-${Date.now()}.jpg`, { type: 'image/jpeg' });
}
