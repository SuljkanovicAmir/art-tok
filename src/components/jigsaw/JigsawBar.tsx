import { Link } from "react-router-dom";
import { Volume2, VolumeX, X } from "lucide-react";
import { formatTime } from "../../utils/jigsaw/game";

interface JigsawBarProps {
  label: string;
  elapsed: number;
  canPause: boolean;
  paused: boolean;
  muted: boolean;
  onTogglePause: () => void;
  onToggleMuted: () => void;
}

export default function JigsawBar({ label, elapsed, canPause, paused, muted, onTogglePause, onToggleMuted }: JigsawBarProps) {
  return (
    <header className="jigsaw__bar">
      <Link to="/games" className="jigsaw__close" aria-label="Leave the game">
        <X size={22} strokeWidth={2} />
      </Link>
      <button
        type="button"
        className="jigsaw__clock"
        disabled={!canPause}
        aria-label={paused ? "Resume the clock" : "Pause the clock"}
        onClick={onTogglePause}
      >
        <span className="jigsaw__kicker">{label}</span>
        <span className="jigsaw__time">{formatTime(elapsed)}</span>
      </button>
      <button
        type="button"
        className="jigsaw__close"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={muted}
        onClick={onToggleMuted}
      >
        {muted ? <VolumeX size={22} strokeWidth={2} /> : <Volume2 size={22} strokeWidth={2} />}
      </button>
    </header>
  );
}
