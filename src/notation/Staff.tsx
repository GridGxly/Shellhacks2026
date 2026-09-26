/**
 * Staff.tsx — renders the music with abcjs and drives the feedback visuals (PRD §7).
 *
 * abcjs renders SVG, so:
 *  - the cursor is a vertical line moving across the staff on the shared clock;
 *  - notes are recolored by setting the fill of their SVG elements
 *    (correct = green, wrong = red, silent = grey);
 *  - ghost notes are extra SVG note heads drawn from abcjs note coordinates.
 *
 * TODO(team): import abcjs, render `abc`, add cursor + coloring + ghost notes.
 */

import type { NoteResult } from '../types';

interface StaffProps {
  abc: string;
  results?: NoteResult[] | null;
}

export function Staff(_props: StaffProps) {
  return <div className="staff">TODO: abcjs staff (PRD §7)</div>;
}
