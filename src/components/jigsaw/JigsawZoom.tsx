import { ZoomIn, ZoomOut } from "lucide-react";
import { MAX_ZOOM, MIN_ZOOM } from "../../utils/jigsaw/view";

const STEP = 1.4;

interface JigsawZoomProps {
  zoom: number;
  disabled: boolean;
  onZoom: (factor: number) => void;
}

export default function JigsawZoom({ zoom, disabled, onZoom }: JigsawZoomProps) {
  return (
    <div className="jigsaw__zoom" role="group" aria-label="Zoom">
      <button
        type="button"
        aria-label="Zoom in"
        disabled={disabled || zoom >= MAX_ZOOM}
        onClick={() => onZoom(STEP)}
      >
        <ZoomIn size={19} strokeWidth={2} />
      </button>
      {zoom > MIN_ZOOM && <span className="jigsaw__zoom-level">{zoom}x</span>}
      <button
        type="button"
        aria-label="Zoom out"
        disabled={disabled || zoom <= MIN_ZOOM}
        onClick={() => onZoom(1 / STEP)}
      >
        <ZoomOut size={19} strokeWidth={2} />
      </button>
    </div>
  );
}
