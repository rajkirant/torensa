export default function supportsCanvasMime(mime: string): boolean {
  const canvas = document.createElement("canvas");
  try {
    return canvas.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}
