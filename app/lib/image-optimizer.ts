export type BrowserImageVariant = "listingDisplay" | "listingThumbnail" | "agentPortrait";

export type OptimizedImage = {
  blob: Blob;
  width: number;
  height: number;
  contentType: "image/jpeg" | "image/webp";
};

const IMAGE_PRESETS: Record<BrowserImageVariant, { maxDimension: number; quality: number }> = {
  listingDisplay: { maxDimension: 1_600, quality: 0.82 },
  listingThumbnail: { maxDimension: 640, quality: 0.76 },
  agentPortrait: { maxDimension: 800, quality: 0.82 },
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function supportedFile(file: File) {
  return SUPPORTED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.decoding = "async";
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("The image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimizeImageFile(file: File, variant: BrowserImageVariant): Promise<OptimizedImage> {
  if (!supportedFile(file)) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("The image dimensions are unavailable.");

  const preset = IMAGE_PRESETS[variant];
  const scale = Math.min(1, preset.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("The browser could not prepare the image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  // WebP keeps property photos small while the JPEG fallback covers older browsers.
  const webp = await canvasBlob(canvas, "image/webp", preset.quality);
  const blob = webp?.type === "image/webp" ? webp : await canvasBlob(canvas, "image/jpeg", preset.quality);
  if (!blob || (blob.type !== "image/webp" && blob.type !== "image/jpeg")) throw new Error("The browser could not encode the image.");
  return { blob, width, height, contentType: blob.type };
}
