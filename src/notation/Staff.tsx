/**
 * Staff.tsx — renders the music with abcjs and drives the feedback visuals (PRD §7).
 *
 * THE BIG IDEA (read this once and the rest is obvious):
 *   abcjs does two separate jobs for us.
 *     1. renderAbc(...)      -> draws the sheet music as an SVG and returns a
 *                               "visual object" describing it.
 *     2. new TimingCallbacks -> a little clock that, given that visual object and
 *                               a tempo, calls us back AT THE MOMENT each note
 *                               should play, handing us the note's on-screen
 *                               position AND its actual SVG elements.
 *
 *   So the moving cursor and the live green/red grading are the SAME event:
 *   "note N just started" -> move the cursor to it, decide right/wrong, recolor it.
 *
 * The seam with the "backend": this component doesn't know HOW a note is graded.
 * It calls `gradeNote(index)` and trusts the answer. Today the demo passes a fake
 * grader; later your friend's mic/pitch code passes the real one. Nothing else
 * here has to change.
 */

import { useEffect, useRef } from 'react';
import * as abcjs from 'abcjs';
import type { TuneObject, NoteTimingEvent, EventCallback } from 'abcjs';
import type { Exercise } from '../types';
import type { KeyId } from '../config';
import { exerciseToAbc } from './toAbc';

// Match these to palette.css (--correct / --wrong / --ghost). abcjs colors SVG
// via a fill attribute, which can't read a CSS variable, so we spell hex here.
const COLOR_CORRECT = '#5ed67a';
const COLOR_WRONG = '#ff5a6e';
const COLOR_SILENT = '#7a6a8f';

// MIDI pitch class -> which staff LETTER it sits on (C=0, D=1, ... B=6).
// Sharps share a line/space with their natural (C# sits on the C line).
const LETTER_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/** A note's vertical "staff step": how many letter-steps above low C it is. */
function staffStep(midi: number): number {
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 = C, octave 4
  return octave * 7 + LETTER_OF_PC[midi % 12];
}

interface StaffProps {
  exercise: Exercise;
  instrumentKey: KeyId;
  /** Flip to true to start the cursor + grading; false stops it. */
  playing: boolean;
  /**
   * The grading seam. Return the CONCERT-pitch MIDI number the player actually
   * played for note `index`, or null for silence. The Staff compares it to the
   * expected note and draws the ghost at the real pitch that was played.
   */
  getPlayed?: (index: number) => number | null;
  /** Fired right after each note is graded, for score/combo HUDs. */
  onNoteGraded?: (index: number, correct: boolean) => void;
  /** Fired once when the cursor reaches the end of the piece. */
  onFinished?: () => void;
}

export function Staff({
  exercise,
  instrumentKey,
  playing,
  getPlayed,
  onNoteGraded,
  onFinished,
}: StaffProps) {
  const renderRef = useRef<HTMLDivElement>(null); // abcjs draws the SVG in here
  const cursorRef = useRef<HTMLDivElement>(null); // our sweeping vertical line
  const visualObjRef = useRef<TuneObject | null>(null);
  const timingRef = useRef<abcjs.TimingCallbacks | null>(null);

  // Keep the latest callbacks in refs so the timing engine (created once per
  // "play") always calls the freshest version without us restarting it.
  const getPlayedRef = useRef(getPlayed);
  const onNoteGradedRef = useRef(onNoteGraded);
  const onFinishedRef = useRef(onFinished);
  getPlayedRef.current = getPlayed;
  onNoteGradedRef.current = onNoteGraded;
  onFinishedRef.current = onFinished;

  // 1) Draw the sheet music whenever the exercise or instrument key changes.
  useEffect(() => {
    if (!renderRef.current) return;
    const abc = exerciseToAbc(exercise, instrumentKey);
    const tunes = abcjs.renderAbc(renderRef.current, abc, {
      add_classes: true, // tags each SVG note so it's easy to find/recolor
      staffwidth: 640,
    });
    visualObjRef.current = tunes[0] ?? null;
  }, [exercise, instrumentKey]);

  // 2) Start / stop the cursor + grading when `playing` flips.
  useEffect(() => {
    if (!playing || !renderRef.current) return;

    // Re-render a clean staff so each Play starts with no colors or ghosts.
    const abc = exerciseToAbc(exercise, instrumentKey);
    const tunes = abcjs.renderAbc(renderRef.current, abc, {
      add_classes: true,
      staffwidth: 640,
    });
    const visualObj = tunes[0];
    if (!visualObj) return;
    visualObjRef.current = visualObj;

    let noteIndex = 0; // which note in exercise.notes is firing

    // Draw a ghost of the pitch the player ACTUALLY played by CLONING the real
    // SVG note head glyph and shifting it vertically to the played pitch. Cloning
    // (instead of a CSS oval) means the ghost is a real note, identical in shape
    // to the printed music. `expected`/`played` are concert-pitch MIDI numbers.
    function dropGhost(event: NoteTimingEvent, expected: number, played: number, correct: boolean) {
      const head = event.elements?.[0]?.[0] as unknown as SVGGraphicsElement | undefined;
      if (!head || typeof head.getBBox !== 'function' || !head.parentNode) return;

      // A note head spans one staff space = two letter-steps, so one staff step
      // is ~half the head height. Higher pitch sits higher (smaller y) → minus.
      const h = head.getBBox().height;
      const pxPerStep = h / 2;
      const dy = -(staffStep(played) - staffStep(expected)) * pxPerStep;

      const clone = head.cloneNode(true) as SVGGraphicsElement;
      clone.classList.add('ghost-clone');
      clone.style.fill = correct ? COLOR_CORRECT : COLOR_WRONG;
      clone.style.opacity = '0.6';
      // Compose our vertical shift with any transform the glyph already has.
      const existing = clone.getAttribute('transform') ?? '';
      clone.setAttribute('transform', `translate(0, ${dy}) ${existing}`.trim());
      head.parentNode.appendChild(clone); // same SVG space, drawn on top
    }

    // abcjs calls this at the exact moment each note should play.
    const eventCallback: EventCallback = (event: NoteTimingEvent | null) => {
      // A null event means "the piece is over".
      if (!event) {
        onFinishedRef.current?.();
        return undefined;
      }
      if (!event.elements || event.elements.length === 0) return undefined;

      // What was expected vs. what the player actually played.
      const expected = exercise.notes[noteIndex]?.midi;
      const played = getPlayedRef.current ? getPlayedRef.current(noteIndex) : expected;
      const correct = played != null && played === expected;

      // Recolor the expected note: green (hit), red (wrong pitch), grey (silent).
      const color = correct ? COLOR_CORRECT : played == null ? COLOR_SILENT : COLOR_WRONG;
      // Use inline style (not setAttribute): an inline style beats the
      // stylesheet rule that paints un-played notes in the default ink color.
      for (const group of event.elements) {
        for (const el of group) el.style.fill = color;
      }

      // Ghost the actual pitch only on a miss (a hit already turned green).
      // Skip silence — there's no pitch to show.
      if (!correct && played != null && expected != null) {
        dropGhost(event, expected, played, correct);
      }

      onNoteGradedRef.current?.(noteIndex, correct);
      noteIndex += 1;
      return undefined;
    };

    const timing = new abcjs.TimingCallbacks(visualObj, {
      qpm: exercise.tempo, // beats per minute -> drives the whole clock
      eventCallback,
    });

    timingRef.current = timing;
    timing.start();

    // Smooth cursor: instead of jumping per note, run an animation-frame loop
    // that reads the clock's current millisecond and interpolates the cursor's x
    // between the surrounding notes' positions.
    const stops = timing.noteTimings
      .filter((e) => e.left != null)
      .map((e) => ({
        ms: e.milliseconds,
        left: e.left as number,
        top: e.top ?? 0,
        height: e.height ?? 40,
      }))
      .sort((a, b) => a.ms - b.ms);

    let raf = 0;
    function frame() {
      const cursor = cursorRef.current;
      if (cursor && stops.length > 0) {
        const t = timing.currentMillisecond();
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1].ms <= t) i += 1;
        const a = stops[i];
        const b = stops[i + 1] ?? a;
        const span = b.ms - a.ms;
        const frac = span > 0 ? Math.min(1, Math.max(0, (t - a.ms) / span)) : 0;
        cursor.style.left = `${a.left + (b.left - a.left) * frac}px`;
        cursor.style.top = `${a.top}px`;
        cursor.style.height = `${a.height}px`;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Cleanup: stop the clock + loop and hide the cursor when we stop playing.
    return () => {
      cancelAnimationFrame(raf);
      timing.stop();
      timingRef.current = null;
      if (cursorRef.current) cursorRef.current.style.left = '-9999px';
    };
  }, [playing, exercise, instrumentKey]);

  return (
    <div className="staff-wrap">
      <div className="staff-render" ref={renderRef} />
      <div className="staff-cursor" ref={cursorRef} />
    </div>
  );
}
