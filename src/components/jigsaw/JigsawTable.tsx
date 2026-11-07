import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import type { HeldGroup, TableHandlers } from "../../hooks/useTableDrag";
import type { GamePhase, Jigsaw, PieceGroup } from "../../types/jigsaw";
import { SCATTER_STAGGER_MS } from "../../utils/jigsaw/timing";
import { allCutsPath, cellOf, pieceBounds, piecePath } from "../../utils/jigsaw/geometry";
import { groupTransform } from "../../utils/jigsaw/layout";
import type { TableLayout } from "../../utils/jigsaw/layout";
import PieceCanvas from "./PieceCanvas";

export interface Glow {
  id: number;
  pieces: number[];
}

interface JigsawTableProps {
  tableRef: RefObject<HTMLDivElement | null>;
  /** Everything the camera moves. Its transform is written directly during gestures. */
  worldRef: RefObject<HTMLDivElement | null>;
  zoomed: boolean;
  jigsaw: Jigsaw;
  imageUrl: string;
  pieces: HTMLCanvasElement[];
  layout: TableLayout | null;
  groups: PieceGroup[] | null;
  phase: GamePhase;
  guideOn: boolean;
  peeking: boolean;
  /** Chunks accept pointer and keyboard input */
  interactive: boolean;
  selected: number | null;
  focused: number | null;
  held: HeldGroup | null;
  glow: Glow | null;
  /** The chunk that has just been joined */
  fresh: number | null;
  /** "tidying" and "settling" animate chunks between positions */
  motion: "tidying" | "settling" | null;
  handlers: TableHandlers;
  onResize: (width: number, height: number) => void;
  onTapGroup: (id: number) => void;
  onFocusGroup: (id: number | null) => void;
}

const pct = (value: number): string => `${Math.round(value * 10000) / 100}%`;

function groupLabel(group: PieceGroup, jigsaw: Jigsaw): string {
  if (group.pieces.length > 1) return `Group of ${group.pieces.length} pieces`;
  const { col, row } = cellOf(group.id, jigsaw.cols);
  return `Piece, row ${row + 1}, column ${col + 1}`;
}

export default function JigsawTable({
  tableRef,
  worldRef,
  zoomed,
  jigsaw,
  imageUrl,
  pieces,
  layout,
  groups,
  phase,
  guideOn,
  peeking,
  interactive,
  selected,
  focused,
  held,
  glow,
  fresh,
  motion,
  handlers,
  onResize,
  onTapGroup,
  onFocusGroup,
}: JigsawTableProps) {
  const resizeRef = useRef(onResize);
  useEffect(() => {
    resizeRef.current = onResize;
  });

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) resizeRef.current(el.clientWidth, el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [tableRef]);

  const outlines = useMemo(
    () => (glow ? glow.pieces.map((piece) => ({ piece, d: piecePath(jigsaw, piece) })) : []),
    [glow, jigsaw],
  );

  const stroke = jigsaw.width / 900;
  const isReveal = phase === "preview" || phase === "cut";
  const atHome = isReveal;
  const sheetStyle: CSSProperties | undefined = layout
    ? { left: layout.originX, top: layout.originY, width: layout.boardWidth, height: layout.boardHeight }
    : undefined;
  const cuts = (
    <svg className="jigsaw__cuts" viewBox={`0 0 ${jigsaw.width} ${jigsaw.height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={allCutsPath(jigsaw)} pathLength={1} strokeWidth={stroke * 1.4} />
    </svg>
  );

  return (
    <div
      ref={tableRef}
      className={`jigsaw__table is-${phase}${motion ? ` is-${motion}` : ""}${interactive ? " is-live" : ""}${
        zoomed ? " is-zoomed" : ""
      }`}
      onContextMenu={(event) => event.preventDefault()}
      {...handlers}
    >
      <div ref={worldRef} className="jigsaw__world">
      {layout && (isReveal || guideOn) && phase !== "finish" && (
        <div className={`jigsaw__sheet ${isReveal ? "is-reveal" : "is-guide"}`} style={sheetStyle} aria-hidden="true">
          <img src={imageUrl} alt="" draggable={false} />
          {cuts}
        </div>
      )}

      {layout &&
        groups?.map((group, index) => {
          const isHeld = held !== null && held.id === group.id;
          const state = `${isHeld ? " is-held" : ""}${selected === group.id || focused === group.id ? " is-selected" : ""}${
            fresh === group.id ? " is-fresh" : ""
          }${atHome ? " is-hidden" : ""}`;
          return (
            <div
              key={group.id}
              data-group={group.id}
              className={`jigsaw__group${state}`}
              style={
                {
                  width: layout.boardWidth,
                  height: layout.boardHeight,
                  transform: atHome ? groupTransform(layout, 0, 0) : groupTransform(layout, group.x, group.y),
                  "--delay": `${index * SCATTER_STAGGER_MS}ms`,
                } as CSSProperties
              }
            >
              <div
                className="jigsaw__group-body"
                style={isHeld ? { transformOrigin: `${held.ox}% ${held.oy}%` } : undefined}
              >
                {group.pieces.map((piece) => {
                  const bounds = pieceBounds(jigsaw, piece);
                  const { col, row } = cellOf(piece, jigsaw.cols);
                  return (
                    <PieceCanvas
                      key={piece}
                      source={pieces[piece]}
                      className={`jigsaw__piece${phase === "finish" ? " is-wave" : ""}`}
                      style={
                        {
                          left: pct(bounds.x / jigsaw.width),
                          top: pct(bounds.y / jigsaw.height),
                          width: pct(bounds.width / jigsaw.width),
                          height: pct(bounds.height / jigsaw.height),
                          "--wave": `${(col + row) * 55}ms`,
                        } as CSSProperties
                      }
                    />
                  );
                })}
                {glow && outlines.some((o) => group.pieces.includes(o.piece)) && (
                  <svg
                    key={glow.id}
                    className="jigsaw__glow-layer"
                    viewBox={`0 0 ${jigsaw.width} ${jigsaw.height}`}
                    aria-hidden="true"
                  >
                    {outlines
                      .filter((o) => group.pieces.includes(o.piece))
                      .map((o) => (
                        <path key={o.piece} className="jigsaw__glow" d={o.d} strokeWidth={stroke * 3} />
                      ))}
                  </svg>
                )}
              </div>
            </div>
          );
        })}

      {layout && phase === "finish" && (
        <div className="jigsaw__sheet is-finish" style={sheetStyle} aria-hidden="true">
          <img src={imageUrl} alt="" draggable={false} />
          <span className="jigsaw__sheen" />
        </div>
      )}
      </div>

      <div className={`jigsaw__peek${peeking ? " is-on" : ""}`} aria-hidden="true">
        {layout && (
          <div className="jigsaw__sheet is-peek" style={sheetStyle}>
            <img src={imageUrl} alt="" draggable={false} />
          </div>
        )}
      </div>

      {interactive && groups && (
        <ul className="jigsaw__sr" aria-label="Pieces on the table">
          {[...groups]
            .sort((a, b) => a.id - b.id)
            .map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  aria-pressed={selected === group.id}
                  aria-label={groupLabel(group, jigsaw)}
                  onClick={() => onTapGroup(group.id)}
                  onFocus={() => onFocusGroup(group.id)}
                  onBlur={() => onFocusGroup(null)}
                />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
