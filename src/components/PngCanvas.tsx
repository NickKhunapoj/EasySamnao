import { useEffect, useRef } from "react";

export function PngCanvas({ bytes, width, height, scale }: { bytes: Uint8Array; width: number; height: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    const image = new Image();
    image.onload = () => {
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      canvas.style.width = `${Math.ceil(width * scale)}px`;
      canvas.style.height = `${Math.ceil(height * scale)}px`;
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [bytes, width, height, scale]);
  return <canvas ref={ref} aria-label="PNG document preview" />;
}
