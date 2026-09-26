/**
 * App.tsx — the screen router.
 *
 * The current screen comes from the store; each case renders one screen
 * component. This is the whole navigation model (PRD §2 user flow) — there is
 * no react-router, just a switch on `screen`.
 */

import { useGame } from './store';
import { SightReadDemo } from './screens/SightReadDemo';
import { Title } from './screens/Title';
import { KeySelect } from './screens/KeySelect';
import { GameMap } from './screens/Map';
import { Combat } from './screens/Combat';
import { Victory } from './screens/Victory';
import { FinalVictory } from './screens/FinalVictory';
import { Loss } from './screens/Loss';

// TEMP: while building the sight-reading concept, show the demo instead of the
// normal game flow. Set to false to get the real title -> map -> combat router back.
const SHOW_DEMO = true;

export default function App() {
  const screen = useGame((s) => s.screen);

  if (SHOW_DEMO) return <SightReadDemo />;

  switch (screen) {
    case 'title':
      return <Title />;
    case 'keySelect':
      return <KeySelect />;
    case 'map':
      return <GameMap />;
    case 'combat':
      return <Combat />;
    case 'victory':
      return <Victory />;
    case 'finalVictory':
      return <FinalVictory />;
    case 'loss':
      return <Loss />;
  }
}
