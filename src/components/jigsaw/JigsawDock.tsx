import { Image as GuideIcon, LayoutGrid } from "lucide-react";
import PeekButton from "./PeekButton";

interface JigsawDockProps {
  /** How connected the painting is, from 0 to 1 */
  meter: number;
  /** Pieces in the largest chunk */
  biggest: number;
  total: number;
  disabled: boolean;
  guideOn: boolean;
  inert: boolean;
  onPeekStart: () => void;
  onPeekEnd: () => void;
  onToggleGuide: () => void;
  onTidy: () => void;
}

export default function JigsawDock({
  meter,
  biggest,
  total,
  disabled,
  guideOn,
  inert,
  onPeekStart,
  onPeekEnd,
  onToggleGuide,
  onTidy,
}: JigsawDockProps) {
  return (
    <div className="jigsaw__dock" inert={inert}>
      <div
        className="jigsaw__progress"
        role="progressbar"
        aria-label="Pieces connected"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(meter * 100)}
      >
        <span style={{ width: `${meter * 100}%` }} />
      </div>
      <span className="jigsaw__count">
        {biggest}/{total}
      </span>
      <PeekButton disabled={disabled} onStart={onPeekStart} onEnd={onPeekEnd} />
      <button
        type="button"
        className="jigsaw__tool"
        aria-label="Guide, show a faded painting under the pieces"
        aria-pressed={guideOn}
        disabled={disabled}
        onClick={onToggleGuide}
      >
        <GuideIcon size={20} strokeWidth={2} />
      </button>
      <button type="button" className="jigsaw__tool" aria-label="Tidy the loose pieces" disabled={disabled} onClick={onTidy}>
        <LayoutGrid size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
