import { useCallback, useEffect, useRef, useState } from "react";
import { useGameClock } from "../../hooks/useGameClock";
import { useGameEvents } from "../../hooks/useGameEvents";
import { useGameTimers } from "../../hooks/useGameTimers";
import type { TableMotion } from "../../hooks/useGameTimers";
import type { GameEvents } from "../../hooks/useGameEvents";
import { useTableDrag } from "../../hooks/useTableDrag";
import { useTableView } from "../../hooks/useTableView";
import type { GamePhase, Jigsaw, JigsawProgress, JigsawRecord, JigsawRound, PieceGroup, Point, RoundState } from "../../types/jigsaw";
import { jigsawImageUrl } from "../../utils/jigsaw/assets";
import { prefersReducedMotion, shakeElement, slideElement } from "../../utils/jigsaw/flight";
import {
  clampGroup,
  clampGroups,
  connection,
  createRound,
  formatTime,
  isComplete,
  joinGroup,
  largestGroup,
  moveGroup,
  neighbours,
  raiseGroup,
  snapDistance,
  tidy,
  tryPair,
} from "../../utils/jigsaw/game";
import { cellOf, cellSize } from "../../utils/jigsaw/geometry";
import { groupTransform, tableLayout, tableUnits } from "../../utils/jigsaw/layout";
import { playFinish, playSnap, vibrate } from "../../utils/jigsaw/sound";
import {
  clearProgress,
  readGuide,
  readMuted,
  saveGuide,
  saveMuted,
  saveProgress,
  saveRecord,
} from "../../utils/jigsaw/storage";
import JigsawTable from "./JigsawTable";
import type { Glow } from "./JigsawTable";
import JigsawBar from "./JigsawBar";
import JigsawDock from "./JigsawDock";
import JigsawZoom from "./JigsawZoom";

interface JigsawGameProps {
  round: JigsawRound;
  jigsaw: Jigsaw;
  pieces: HTMLCanvasElement[];
  /** A saved daily round to carry on from */
  initialProgress: JigsawProgress | null;
  onFinish: (record: JigsawRecord) => void;
}

const GLOW_MS = 650;

interface Actions extends GameEvents {
  advance: (from: GamePhase) => void;
  endMotion: (motion: TableMotion) => void;
}

const noop = () => {};

const setGroupAt = (state: RoundState, id: number, at: Point): RoundState => ({
  ...state,
  groups: state.groups.map((group) => (group.id === id ? { ...group, ...at } : group)),
});

export default function JigsawGame({ round, jigsaw, pieces, initialProgress, onFinish }: JigsawGameProps) {
  const total = jigsaw.cols * jigsaw.rows;
  const imageUrl = jigsawImageUrl(round.painting);
  const label = round.puzzle === null ? "Practice" : `No. ${round.puzzle}`;

  const [state, setState] = useState<RoundState | null>(initialProgress?.state ?? null);
  const [tableSize, setTableSize] = useState<{ w: number; h: number } | null>(null);
  const [phase, setPhase] = useState<GamePhase>(initialProgress ? "play" : "preview");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  const [guideOn, setGuideOn] = useState(readGuide);
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [motion, setMotion] = useState<TableMotion | null>(null);
  const [glow, setGlow] = useState<Glow | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const clock = useGameClock(initialProgress?.elapsedMs ?? 0);
  const { start: startClock } = clock;
  const layout = tableSize ? tableLayout(jigsaw, tableSize.w, tableSize.h) : null;

  const stateRef = useRef(state);
  const layoutRef = useRef(layout);
  const phaseRef = useRef(phase);
  const guideRef = useRef(guideOn);
  const recordRef = useRef<JigsawRecord | null>(null);
  const completedRef = useRef(false);
  const peekRef = useRef(false);
  const idRef = useRef(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const actions = useRef<Actions>({
    advance: noop,
    endMotion: noop,
    deselect: noop,
    toggleGuide: noop,
    startPeek: noop,
    endPeek: noop,
    zoom: noop,
    resetZoom: noop,
    pause: noop,
    persist: noop,
  });

  const updateState = (next: RoundState) => {
    stateRef.current = next;
    setState(next);
  };
  const nextId = () => ++idRef.current;
  const announce = (text: string) => setMessage(`${text}${idRef.current % 2 ? "" : "​"}`);
  const canAct = phase === "play" && !paused && motion !== "settling";
  const groupEl = (id: number) => tableRef.current?.querySelector<HTMLElement>(`[data-group="${id}"]`) ?? null;
  const view = useTableView(tableRef, worldRef, canAct);

  const persist = () => {
    if (round.puzzle === null || phaseRef.current !== "play" || recordRef.current || !stateRef.current) return;
    saveProgress({ puzzle: round.puzzle, state: stateRef.current, elapsedMs: clock.read() });
  };

  const handleResize = (width: number, height: number) => {
    setTableSize((current) => (current && current.w === width && current.h === height ? current : { w: width, h: height }));
    const measured = tableLayout(jigsaw, width, height);
    const units = tableUnits(measured);
    const current = stateRef.current;
    let next = current ? clampGroups(current, jigsaw, units) : createRound(jigsaw, round.seed, units, measured.scale);
    if (guideRef.current && !next.guided) next = { ...next, guided: true };
    if (next !== current) updateState(next);
    view.refit();
  };

  const finishRound = (final: RoundState) => {
    clock.stop();
    const record: JigsawRecord = {
      puzzle: round.puzzle,
      totalMs: Math.round(clock.read()),
      pieces: total,
      cols: jigsaw.cols,
      moves: final.moves,
      peeks: final.peeks,
      guided: final.guided,
    };
    recordRef.current = record;
    saveRecord(record);
    if (round.puzzle !== null) clearProgress();
    setPeeking(false);
    setSelected(null);
    view.reset();
    // The last chunk eases to its true spot before the finish sequence.
    updateState({ ...final, groups: final.groups.map((group) => ({ ...group, x: 0, y: 0 })) });
    setMotion("settling");
    announce(`Painting complete in ${formatTime(record.totalMs)}`);
  };

  /** Applies a new state after a drop or a pair, with the reward for any join. */
  const commit = (current: RoundState, next: RoundState, droppedId: number) => {
    const joined = current.groups.length - next.groups.length;
    updateState(next);
    setSelected((id) => (id !== null && next.groups.some((group) => group.id === id) ? id : null));
    if (joined <= 0) {
      persist();
      return;
    }
    const merged = next.groups[next.groups.length - 1];
    const dropped = current.groups.find((group) => group.id === droppedId)?.pieces ?? [];
    const seam = merged.pieces.filter(
      (piece) => dropped.includes(piece) || neighbours(piece, jigsaw).some((other) => dropped.includes(other)),
    );
    setGlow({ id: nextId(), pieces: seam });
    setFresh(merged.id);
    announce(`Joined, ${largestGroup(next)} of ${total} connected`);
    if (isComplete(next)) {
      finishRound(next);
      return;
    }
    playSnap(connection(next, total));
    vibrate(10);
    persist();
    keepOnTable(next, merged);
  };

  /** A chunk that grew past the edge eases back, so no piece is left out of reach. */
  const keepOnTable = (current: RoundState, group: PieceGroup) => {
    const l = layoutRef.current;
    if (!l) return;
    const { x, y } = clampGroup(group, jigsaw, tableUnits(l));
    if (x === group.x && y === group.y) return;
    setMotion("tidying");
    updateState({ ...current, groups: current.groups.map((item) => (item === group ? { ...item, x, y } : item)) });
    persist();
  };

  const handleDrop = async (id: number, x: number, y: number) => {
    const current = stateRef.current;
    const l = layoutRef.current;
    if (!current || !l) return;
    const tolerance = snapDistance(jigsaw, l.scale * view.read().zoom);
    const snapped = guideRef.current && Math.hypot(x, y) <= tolerance;
    const at = snapped ? { x: 0, y: 0 } : { x, y };
    const moved = moveGroup(current, id, at.x, at.y);
    const result = joinGroup(moved, id, jigsaw, tolerance);
    const merged = result.state.groups[result.state.groups.length - 1];
    const el = groupEl(id);

    if (result.joined > 0) {
      if (el) await slideElement(el, groupTransform(l, x, y), groupTransform(l, merged.x, merged.y), 120);
      commit(current, result.state, id);
      return;
    }
    // A loose drop past the edge slides back onto the table.
    const end = clampGroup(merged, jigsaw, tableUnits(l));
    if (el) await slideElement(el, groupTransform(l, x, y), groupTransform(l, end.x, end.y), 160);
    const settled = merged.x === end.x && merged.y === end.y;
    commit(current, settled ? moved : setGroupAt(moved, id, end), id);
  };

  const pair = async (a: number, b: number) => {
    const current = stateRef.current;
    const l = layoutRef.current;
    const first = current?.groups.find((group) => group.id === a);
    const second = current?.groups.find((group) => group.id === b);
    if (!current || !l || !first || !second) return;
    const next = tryPair(current, a, b, jigsaw, snapDistance(jigsaw, l.scale * view.read().zoom));
    const el = groupEl(a);
    if (!next) {
      updateState({ ...current, moves: current.moves + 1 });
      announce("Those pieces don't connect");
      if (el) await shakeElement(el, (dx) => `${groupTransform(l, first.x, first.y)} translateX(${dx}px)`);
      return;
    }
    if (el) await slideElement(el, groupTransform(l, first.x, first.y), groupTransform(l, second.x, second.y), 180);
    commit(current, next, a);
  };

  const handleTap = async (id: number | null) => {
    if (!canAct) return;
    if (id === null || id === selected) {
      if (selected !== null) announce("Selection cleared");
      setSelected(null);
      return;
    }
    if (selected === null) {
      setSelected(id);
      announce("Piece selected. Choose another to connect it.");
      return;
    }
    await pair(selected, id);
  };

  const drag = useTableDrag({
    tableRef,
    jigsaw,
    layout,
    view,
    getGroups: () => stateRef.current?.groups ?? [],
    enabled: canAct,
    onRaise: (id) => {
      if (stateRef.current) updateState(raiseGroup(stateRef.current, id));
    },
    onTap: handleTap,
    onDrop: handleDrop,
  });

  const complete = useCallback(() => {
    if (completedRef.current || !recordRef.current) return;
    completedRef.current = true;
    onFinish(recordRef.current);
  }, [onFinish]);

  const beginPlay = () => {
    phaseRef.current = "play";
    setPhase("play");
    clock.start();
  };

  const advance = (from: GamePhase) => {
    if (from === "preview") {
      if (prefersReducedMotion()) beginPlay();
      else setPhase("cut");
    } else if (from === "cut") {
      setPhase("scatter");
    } else if (from === "scatter") {
      beginPlay();
    }
  };

  const endMotion = (done: TableMotion) => {
    setMotion(null);
    if (done !== "settling") return;
    phaseRef.current = "finish";
    setPhase("finish");
    playFinish();
    vibrate([10, 40, 10]);
  };

  const pause = () => {
    if (phaseRef.current !== "play" || paused || drag.held || motion) return;
    clock.stop();
    setPaused(true);
    setPeeking(false);
    peekRef.current = false;
    persist();
  };

  const resume = () => {
    clock.start();
    setPaused(false);
  };

  const startPeek = () => {
    const current = stateRef.current;
    if (!canAct || peekRef.current || !current) return;
    peekRef.current = true;
    setPeeking(true);
    updateState({ ...current, peeks: current.peeks + 1 });
  };

  const endPeek = () => {
    peekRef.current = false;
    setPeeking(false);
  };

  const toggleGuide = () => {
    if (!canAct) return;
    const on = !guideOn;
    guideRef.current = on;
    setGuideOn(on);
    saveGuide(on);
    const current = stateRef.current;
    if (on && current && !current.guided) updateState({ ...current, guided: true });
    announce(on ? "Guide on" : "Guide off");
  };

  const tidyUp = () => {
    const current = stateRef.current;
    const l = layoutRef.current;
    if (!canAct || !current || !l) return;
    const next = tidy(current, jigsaw, round.seed, tableUnits(l), l.scale);
    if (next === current) {
      announce("Nothing to tidy");
      return;
    }
    setMotion("tidying");
    updateState(next);
    persist();
    announce("Pieces tidied");
  };

  const toggleMuted = () => {
    saveMuted(!muted);
    setMuted(!muted);
  };

  useEffect(() => {
    actions.current = {
      advance,
      endMotion,
      deselect: () => setSelected(null),
      toggleGuide,
      startPeek,
      endPeek,
      zoom: (factor) => {
        if (canAct) view.zoomBy(factor);
      },
      resetZoom: () => {
        if (canAct) view.reset();
      },
      pause,
      persist,
    };
    layoutRef.current = layout;
    phaseRef.current = phase;
  });

  // A continued round starts its clock at once; a new one starts after the scatter.
  useEffect(() => {
    if (initialProgress) startClock();
  }, [initialProgress, startClock]);

  useGameTimers(actions, phase, motion, total, complete);

  useEffect(() => {
    if (!glow) return;
    const timer = window.setTimeout(() => {
      setGlow(null);
      setFresh(null);
    }, GLOW_MS);
    return () => window.clearTimeout(timer);
  }, [glow]);

  useGameEvents(actions);

  /** Keeps the chunk a keyboard user has reached in sight while zoomed. */
  const focusGroup = (id: number | null) => {
    setFocused(id);
    const l = layoutRef.current;
    const group = stateRef.current?.groups.find((item) => item.id === id);
    if (!l || !group) return;
    const { col, row } = cellOf(group.pieces[0], jigsaw.cols);
    const cell = cellSize(jigsaw);
    view.reveal(
      l.originX + ((col + 0.5) * cell.width + group.x) * l.scale,
      l.originY + ((row + 0.5) * cell.height + group.y) * l.scale,
    );
  };

  const groups = state?.groups ?? null;
  const biggest = state ? largestGroup(state) : 1;
  const meter = state ? connection(state, total) : 0;
  const dealt = phase === "play" || phase === "finish";
  const zoomed = view.zoom > 1;

  return (
    <div className={`jigsaw__play${paused ? " is-paused" : ""}`} onContextMenu={(event) => event.preventDefault()}>
      <JigsawBar
        label={label}
        elapsed={clock.elapsed}
        canPause={phase === "play"}
        paused={paused}
        muted={muted}
        onTogglePause={paused ? resume : pause}
        onToggleMuted={toggleMuted}
      />

      <div className={`jigsaw__stage${drag.held ? " is-holding" : ""}`} inert={paused}>
        <JigsawTable
          tableRef={tableRef}
          worldRef={worldRef}
          zoomed={zoomed}
          jigsaw={jigsaw}
          imageUrl={imageUrl}
          pieces={pieces}
          layout={layout}
          groups={groups}
          phase={phase}
          guideOn={guideOn}
          peeking={peeking}
          interactive={canAct}
          selected={selected}
          focused={focused}
          held={drag.held}
          glow={glow}
          fresh={fresh}
          motion={motion}
          handlers={drag.handlers}
          onResize={handleResize}
          onTapGroup={(id) => void handleTap(id)}
          onFocusGroup={focusGroup}
        />
        {phase === "play" && <JigsawZoom zoom={view.zoom} disabled={!canAct} onZoom={view.zoomBy} />}
        {phase === "preview" && (
          <button type="button" className="jigsaw__skip" aria-label="Skip the preview" onClick={() => advance("preview")} />
        )}
        {phase === "finish" && (
          <button type="button" className="jigsaw__skip" aria-label="Skip to the result" onClick={complete} />
        )}
      </div>

      <JigsawDock
        meter={meter}
        biggest={dealt ? biggest : 1}
        total={total}
        disabled={!canAct}
        guideOn={guideOn}
        inert={paused}
        onPeekStart={startPeek}
        onPeekEnd={endPeek}
        onToggleGuide={toggleGuide}
        onTidy={tidyUp}
      />

      {paused && (
        <div className="jigsaw__pause">
          <p className="jigsaw__pause-title">Paused</p>
          <button type="button" className="jigsaw__action jigsaw__action--primary" onClick={resume}>
            Resume
          </button>
        </div>
      )}

      <p className="jigsaw__sr" role="status">
        {message}
      </p>
    </div>
  );
}
