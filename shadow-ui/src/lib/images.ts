import type { ImageAttachment } from "@/types";

const MAX_SIDE = 1280;
const MAX_FILE_MB = 20;

function loadImage(src: string, name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't read ${name}.`));
    img.src = src;
  });
}

// Shrinks an image in the browser before sending, so it's faster for the
// model and lighter on memory. Always outputs JPEG.
export async function fileToImage(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_FILE_MB}MB.`);

  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src, file.name);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare images.");
    ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { id: crypto.randomUUID(), dataUrl, base64: dataUrl.split(",")[1] };
  } finally {
    URL.revokeObjectURL(src);
  }
}
