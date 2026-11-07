import { Fragment, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import type { PlacedPainting, TimelinePainting } from "../../types/timeline";
import { PLACEMENTS, correctSlot } from "../../utils/timeline/game";

const FEEDBACK_MS = 2000;
/** Movement before a press counts as a drag, so a tap never places a card. */
const DRAG_THRESHOLD = 8;

interface TimelineBoardProps {
  round: TimelinePainting[];
  imageUrl: (painting: TimelinePainting) => string;
  label: string;
  onFinish: (placed: PlacedPainting[], marks: boolean[]) => void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface Feedback {
  id: number;
  correct: boolean;
  message: string;
}

export default function TimelineBoard({ round, imageUrl, label, onFinish }: TimelineBoardProps) {
  const [placed, setPlaced] = useState<PlacedPainting[]>([{ painting: round[0], correct: null }]);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<Drag | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const current = round[marks.length + 1];
  const isFinished = marks.length === PLACEMENTS;

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      if (isFinished) onFinish(placed, marks);
    }, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback, isFinished, marks, onFinish, placed]);

  const placeAt = (slot: number) => {
    if (!current) return;
    const answer = correctSlot(placed, current.year);
    const correct = slot === answer;
    const next = [...placed];
    next.splice(answer, 0, { painting: current, correct });
    setPlaced(next);
    setMarks([...marks, correct]);
    setFeedback({
      id: current.id,
      correct,
      message: correct ? `Correct, ${current.year}` : `Not quite, it's from ${current.year}`,
    });
  };

  const findNearestSlot = (clientY: number): number | null => {
    const list = listRef.current;
    const slots = list?.querySelectorAll<HTMLElement>("[data-slot]");
    if (!list || !slots || slots.length === 0) return null;
    // Letting go back over the tray cancels the move.
    if (clientY > list.getBoundingClientRect().bottom) return null;
    let nearest = 0;
    let nearestDistance = Infinity;
    slots.forEach((slot, index) => {
      const rect = slot.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    return nearest;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = event.clientX - drag.startX;
    const y = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(x, y) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setOffset({ x, y });
    setActiveSlot(findNearestSlot(event.clientY));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>, place: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const slot = drag.moved ? findNearestSlot(event.clientY) : null;
    setOffset({ x: 0, y: 0 });
    setActiveSlot(null);
    if (place && slot !== null) placeAt(slot);
  };

  const isDragging = offset.x !== 0 || offset.y !== 0;

  return (
    <div className="timeline__board">
      <header className="timeline__bar">
        <Link to="/games" className="timeline__close" aria-label="Leave the game">
          <X size={22} strokeWidth={2} />
        </Link>
        <p className="timeline__kicker">{label}</p>
        <p className="timeline__progress" aria-label={`${marks.length} of ${PLACEMENTS} placed`}>
          {marks.length}/{PLACEMENTS}
        </p>
      </header>

      <p
        className={`timeline__message${feedback ? (feedback.correct ? " is-right" : " is-wrong") : ""}`}
        role="status"
      >
        {feedback ? feedback.message : "Where does this painting belong?"}
      </p>

      <ol className="timeline__list" ref={listRef}>
        <li className="timeline__end-label">Oldest</li>
        {placed.map((item, index) => (
          <Fragment key={item.painting.id}>
            <li className="timeline__slot-row">
              <button
                type="button"
                data-slot={index}
                className={`timeline__slot${activeSlot === index ? " is-active" : ""}`}
                aria-label={
                  index === 0
                    ? `Place before ${item.painting.year}`
                    : `Place between ${placed[index - 1].painting.year} and ${item.painting.year}`
                }
                disabled={isFinished}
                onClick={() => placeAt(index)}
              />
            </li>
            <li
              className={`timeline__card${item.correct === true ? " is-right" : ""}${item.correct === false ? " is-wrong" : ""}${feedback?.id === item.painting.id ? " is-new" : ""}`}
            >
              <img src={imageUrl(item.painting)} alt="" draggable={false} />
              <span className="timeline__card-text">
                <span className="timeline__card-title">{item.painting.title}</span>
                <span className="timeline__card-artist">{item.painting.artist}</span>
              </span>
              <span className="timeline__year">
                {item.correct === true && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                {item.correct === false && <X size={15} strokeWidth={3} aria-hidden="true" />}
                {item.painting.year}
              </span>
            </li>
          </Fragment>
        ))}
        <li className="timeline__slot-row">
          <button
            type="button"
            data-slot={placed.length}
            className={`timeline__slot${activeSlot === placed.length ? " is-active" : ""}`}
            aria-label={`Place after ${placed[placed.length - 1].painting.year}`}
            disabled={isFinished}
            onClick={() => placeAt(placed.length)}
          />
        </li>
        <li className="timeline__end-label">Newest</li>
      </ol>

      <div className="timeline__tray">
        {current && (
          <div
            key={current.id}
            className={`timeline__current${isDragging ? " is-dragging" : ""}`}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${isDragging ? 0.6 : 1})`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => handlePointerEnd(event, true)}
            onPointerCancel={(event) => handlePointerEnd(event, false)}
          >
            <img src={imageUrl(current)} alt={current.title} draggable={false} />
            <div className="timeline__current-text">
              <p className="timeline__current-title">{current.title}</p>
              <p className="timeline__current-artist">{current.artist}</p>
              <p className="timeline__hint">Drag it into the timeline</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
