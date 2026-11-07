import type { KeyboardEvent, PointerEvent } from "react";
import { Eye } from "lucide-react";

interface PeekButtonProps {
  disabled: boolean;
  onStart: () => void;
  onEnd: () => void;
}

/** Hold to look at the whole painting. Works by pointer, Space and Enter. */
export default function PeekButton({ disabled, onStart, onEnd }: PeekButtonProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) onStart();
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") onEnd();
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onStart();
  };

  return (
    <button
      type="button"
      className="jigsaw__tool"
      aria-label="Peek at the painting, hold to look"
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={onEnd}
    >
      <Eye size={20} strokeWidth={2} />
    </button>
  );
}
