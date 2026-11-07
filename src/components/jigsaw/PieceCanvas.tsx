import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";

interface PieceCanvasProps {
  /** The master canvas from renderPieces */
  source: HTMLCanvasElement | undefined;
  className?: string;
  style?: CSSProperties;
}

/** Draws a copy of a rendered piece. The master is shared by the tray, board and ghost. */
export default function PieceCanvas({ source, className, style }: PieceCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
  }, [source]);

  return <canvas ref={ref} className={className} style={style} aria-hidden="true" />;
}
