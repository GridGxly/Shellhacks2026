/**
 * Staff.tsx — renders the music with abcjs and drives the feedback visuals (PRD §7).
 *
 * How it works:
 *   - abcjs draws the music. The written notes are voice 1 (`.abcjs-v0`).
 *   - A TimingCallbacks clock fires an event as each note starts. We use it only
 *     as a clock — to know when a note's window opens and closes.
 *   - When a note's window closes, we ask `getPlayed` what pitch was played over
 *     that window and grade it: green = hit, dim red = miss, grey = silent.
 *   - On a miss, the played pitch is added to a SECOND VOICE (`.abcjs-v1`) and
 *     the staff is re-rendered, so abcjs itself puts the ghost note on the right
 *     line/space (with accidentals and ledger lines). No pixel math — the same
 *     technique the Pitch tester uses.
 *   - Because a re-render replaces the SVG, colors and cursor positions are
 *     always re-read from the live DOM rather than cached from the old SVG.
 */

import { useEffect, useRef } from 'react';
import * as abcjs from 'abcjs';
import type { EventCallback, NoteTimingEvent } from 'abcjs';
import type { Exercise } from '../types';
import type { KeyId } from '../config';
import { INPUT_LATENCY_MS } from '../config';
import { exerciseToAbc } from './toAbc';

// Note colors. The ghost color lives in palette.css (`.abcjs-v1`).
const COLOR_CORRECT = '#5ed67a'; // hit
const COLOR_MISS_TARGET = '#c98a94'; // miss: the note you should've played, dimmed
const COLOR_SILENT = '#7a6a8f'; // nothing detected

const RENDER_OPTS = { add_classes: true, staffwidth: 640 };

interface StaffProps {
  exercise: Exercise;
  instrumentKey: KeyId;
  /** Flip to true to start the cursor + grading; false stops it. */
  playing: boolean;
  /**
   * The grading seam. Return the CONCERT-pitch MIDI the player played during
   * note `index`, whose sound arrived between `fromMs` and `toMs`
   * (performance.now() time, already shifted for mic latency), or null for
   * silence.
   */
  getPlayed?: (index: number, fromMs: number, toMs: number) => number | null;
  /** Fired right after each note is graded, for score/combo HUDs. */
  onNoteGraded?: (index: number, correct: boolean) => void;
  /** Fired once, after the last note has been graded. */
  onFinished?: () => void;
}

/** Paint every path inside an abcjs note group (head, stem, flag). */
function paint(el: Element, color: string) {
  el.querySelectorAll('path').forEach((p) => {
    p.style.fill = color;
  });
}

export function Staff({
  exercise,
  instrumentKey,
  playing,
  getPlayed,
  onNoteGraded,
  onFinished,
}: StaffProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null); // abcjs draws the SVG in here
  const cursorRef = useRef<HTMLDivElement>(null); // our sweeping vertical line

  // Keep the latest callbacks in refs so the clock (created once per "play")
  // always calls the freshest version without us restarting it.
  const getPlayedRef = useRef(getPlayed);
  const onNoteGradedRef = useRef(onNoteGraded);
  const onFinishedRef = useRef(onFinished);
  getPlayedRef.current = getPlayed;
  onNoteGradedRef.current = onNoteGraded;
  onFinishedRef.current = onFinished;

  // 1) Draw the (ungraded) music whenever the exercise or key changes. Include
  //    the empty ghost voice so the layout matches what's drawn during play.
  useEffect(() => {
    if (!renderRef.current) return;
    const noGhosts = exercise.notes.map(() => null);
    abcjs.renderAbc(renderRef.current, exerciseToAbc(exercise, instrumentKey, noGhosts), RENDER_OPTS);
  }, [exercise, instrumentKey]);

  // 2) Run the cursor + grading while `playing` is true.
  useEffect(() => {
    const target = renderRef.current;
    if (!playing || !target) return;

    const notes = exercise.notes;
    const msPerBeat = 60000 / exercise.tempo;
    const ghosts: (number | null)[] = notes.map(() => null); // played pitch per missed note
    const colors: (string | null)[] = notes.map(() => null); // grade color per note
    const onsetWall: number[] = []; // performance.now() when each note started
    const timers: number[] = [];
    let noteIndex = 0;

    // Cursor waypoints, re-read from the DOM after every render.
    let stops: { ms: number; left: number; top: number; height: number }[] = [];

    function writtenNotes(): Element[] {
      return Array.from(target!.querySelectorAll('.abcjs-note.abcjs-v0'));
    }

    // Recompute where the cursor should be for each note, from the real SVG.
    function measureStops() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const origin = wrap.getBoundingClientRect();
      const els = writtenNotes();
      stops = [];
      els.forEach((el, i) => {
        const note = notes[i];
        if (!note) return;
        const r = el.getBoundingClientRect();
        // Span the whole staff line the note sits on (class "abcjs-l{n}").
        const line = Array.from(el.classList).find((c) => /^abcjs-l\d+$/.test(c));
        const staff = line ? target!.querySelector(`.abcjs-staff.${line}`) : null;
        const s = staff ? staff.getBoundingClientRect() : r;
        const top = s.top - origin.top - 10;
        const height = s.height + 20;
        stops.push({ ms: note.startBeat * msPerBeat, left: r.left - origin.left, top, height });
        if (i === notes.length - 1) {
          // Final waypoint so the cursor glides through the last note.
          stops.push({ ms: (note.startBeat + note.durBeats) * msPerBeat, left: r.right - origin.left, top, height });
        }
      });
    }

    // Draw the staff (with any ghosts so far), then re-apply colors + cursor map.
    function render() {
      const tunes = abcjs.renderAbc(target!, exerciseToAbc(exercise, instrumentKey, ghosts), RENDER_OPTS);
      const els = writtenNotes();
      colors.forEach((c, i) => {
        if (c && els[i]) paint(els[i], c);
      });
      measureStops();
      return tunes[0];
    }

    // Grade note i over its window, then show the result.
    function grade(i: number, fromMs: number, toMs: number) {
      const expected = notes[i]?.midi;
      if (expected == null) return;
      const played = getPlayedRef.current ? getPlayedRef.current(i, fromMs, toMs) : expected;
      const correct = played != null && played === expected;
      colors[i] = correct ? COLOR_CORRECT : played == null ? COLOR_SILENT : COLOR_MISS_TARGET;

      if (!correct && played != null) {
        ghosts[i] = played;
        render(); // abcjs places the ghost; render() re-applies every color
      } else {
        const el = writtenNotes()[i];
        if (el) paint(el, colors[i]!);
      }
      onNoteGradedRef.current?.(i, correct);
    }

    // Grade a note once its window is closed and the mic has caught up.
    function scheduleGrade(i: number, endWall: number, then?: () => void) {
      const from = onsetWall[i] + INPUT_LATENCY_MS;
      const to = endWall + INPUT_LATENCY_MS;
      timers.push(
        window.setTimeout(() => {
          grade(i, from, to);
          then?.();
        }, INPUT_LATENCY_MS),
      );
    }

    const eventCallback: EventCallback = (event: NoteTimingEvent | null) => {
      const now = performance.now();
      if (!event) {
        // Piece over: grade the last note, then report finished.
        const last = noteIndex - 1;
        if (last >= 0) scheduleGrade(last, now, () => onFinishedRef.current?.());
        else onFinishedRef.current?.();
        return undefined;
      }
      if (!event.elements || event.elements.length === 0) return undefined;

      // Note `noteIndex` starts now, which closes the previous note's window.
      onsetWall[noteIndex] = now;
      if (noteIndex > 0) scheduleGrade(noteIndex - 1, now);
      noteIndex += 1;
      return undefined;
    };

    const visualObj = render();
    if (!visualObj) return;
    // The clock keeps timing from this first render even after re-renders —
    // the rhythm never changes, and we never touch its (stale) elements.
    const timing = new abcjs.TimingCallbacks(visualObj, {
      qpm: exercise.tempo, // beats per minute -> drives the whole clock
      eventCallback,
    });
    timing.start();

    // Smooth cursor: interpolate between waypoints on every animation frame.
    let raf = 0;
    function frame() {
      const cursor = cursorRef.current;
      if (cursor && stops.length > 0) {
        const t = timing.currentMillisecond();
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1].ms <= t) i += 1;
        const a = stops[i];
        const b = stops[i + 1] ?? a;
        // Only glide along the same staff line; snap across line breaks.
        const sameLine = Math.abs(b.top - a.top) < 2;
        const span = b.ms - a.ms;
        const frac = sameLine && span > 0 ? Math.min(1, Math.max(0, (t - a.ms) / span)) : 0;
        cursor.style.left = `${a.left + (b.left - a.left) * frac}px`;
        cursor.style.top = `${a.top}px`;
        cursor.style.height = `${a.height}px`;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Cleanup: stop the clock, loop and pending grades; hide the cursor.
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      timing.stop();
      if (cursorRef.current) cursorRef.current.style.left = '-9999px';
    };
  }, [playing, exercise, instrumentKey]);

  return (
    <div className="staff-wrap" ref={wrapRef}>
      <div className="staff-render" ref={renderRef} />
      <div className="staff-cursor" ref={cursorRef} />
    </div>
  );
}
