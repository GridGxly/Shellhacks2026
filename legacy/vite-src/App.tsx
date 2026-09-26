/**
 * App.tsx — the screen router.
 *
 * The current screen comes from the store; each case renders one screen
 * component. This is the whole navigation model (PRD §2 user flow) — there is
 * no react-router, just a switch on `screen`.
 */

import { useState } from 'react';
import { useGame } from './store';
import { SightReadDemo } from './screens/SightReadDemo';
import { PitchTester } from './screens/PitchTester';
import { Title } from './screens/Title';
import { KeySelect } from './screens/KeySelect';
import { GameMap } from './screens/Map';
import { Combat } from './screens/Combat';
import { Victory } from './screens/Victory';
import { FinalVictory } from './screens/FinalVictory';
import { Loss } from './screens/Loss';

// TEMP: while building the concept, show the dev demos instead of the real game
// flow. Set to false to get the title -> map -> combat router back.
const SHOW_DEMO = true;

export default function App() {
  const screen = useGame((s) => s.screen);
  const [devPage, setDevPage] = useState<'pitch' | 'read'>('pitch');

  if (SHOW_DEMO) {
    return (
      <div>
        <nav className="dev-nav">
          <button
            className={devPage === 'pitch' ? 'active' : ''}
            onClick={() => setDevPage('pitch')}
          >
            Pitch tester
          </button>
          <button
            className={devPage === 'read' ? 'active' : ''}
            onClick={() => setDevPage('read')}
          >
            Reading demo
          </button>
        </nav>
        {devPage === 'pitch' ? <PitchTester /> : <SightReadDemo />}
      </div>
    );
  }

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
