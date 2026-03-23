import { parseDimensions } from "../utils/parseDimensions";

interface ScaleReferenceProps {
  dimensions: string | undefined;
  accentColor?: string;
}

const HUMAN_HEIGHT_CM = 170;
const CONTAINER_HEIGHT_PX = 200;
const HUMAN_SVG_ASPECT = 0.3;

export function ScaleReference({ dimensions, accentColor = "#f5f5f5" }: ScaleReferenceProps) {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;

  const { heightCm, widthCm } = parsed;

  const scale = CONTAINER_HEIGHT_PX / HUMAN_HEIGHT_CM;

  const artHeightPx = Math.min(heightCm * scale, CONTAINER_HEIGHT_PX);
  const artWidthPx = Math.min(widthCm * scale, CONTAINER_HEIGHT_PX * 1.5);
  const humanHeightPx = CONTAINER_HEIGHT_PX;
  const humanWidthPx = humanHeightPx * HUMAN_SVG_ASPECT;

  return (
    <div className="scale-ref" aria-label={`Artwork is ${heightCm} cm tall × ${widthCm} cm wide, shown next to a 170cm human figure`}>
      <div className="scale-ref__visual" style={{ height: `${CONTAINER_HEIGHT_PX}px` }}>
        {/* Human silhouette */}
        <div className="scale-ref__human" style={{ height: `${humanHeightPx}px`, width: `${humanWidthPx}px` }}>
          <svg viewBox="0 0 60 200" fill={accentColor} opacity="0.4" aria-hidden="true">
            <circle cx="30" cy="18" r="14" />
            <path d="M30 34 C15 34, 8 50, 8 70 L8 120 L20 120 L20 190 L40 190 L40 120 L52 120 L52 70 C52 50, 45 34, 30 34Z" />
          </svg>
          <span className="scale-ref__label">170 cm</span>
        </div>

        {/* Artwork rectangle */}
        <div
          className="scale-ref__artwork"
          style={{
            height: `${artHeightPx}px`,
            width: `${artWidthPx}px`,
            borderColor: accentColor,
          }}
        >
          <span className="scale-ref__label">
            {heightCm.toFixed(0)} × {widthCm.toFixed(0)} cm
          </span>
        </div>
      </div>
    </div>
  );
}
