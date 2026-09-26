/**
 * store.ts — the single Zustand store every screen reads from (PRD §8).
 *
 * Why one store: no prop-drilling. Any component calls `useGame()` and reads
 * exactly the slice it needs. Screens switch by setting `screen`.
 *
 * What's here now: the initial run state + `resetRun` (used by the loss
 * "Continue" button and "Start New Adventure").
 * What's still TODO for the team: the combat actions (start a fight, play a
 * card, grade, apply damage, enemy turn, victory/loss transitions). Those live
 * in PRD §4 (combat rules) and §8 (ultimate charge logic).
 */

import { create } from 'zustand';
import { PLAYER_HP } from './config';
import type { KeyId } from './config';
import type { GameState, MapNode } from './types';

/** The 3-node map: enemy -> enemy -> boss (PRD §2). Node 1 starts available. */
function makeInitialNodes(): MapNode[] {
  return [
    { id: 'node-1', type: 'enemy', status: 'available' },
    { id: 'node-2', type: 'enemy', status: 'locked' },
    { id: 'node-3', type: 'boss', status: 'locked' },
  ];
}

/** Everything that a fresh run starts from. */
function initialRunState() {
  return {
    screen: 'title' as const,
    instrumentKey: null,
    playerHp: PLAYER_HP,
    nodes: makeInitialNodes(),
    currentNodeId: null,
    combat: null,
    lastResult: null,
  };
}

export const useGame = create<GameState>((set) => ({
  ...initialRunState(),

  setScreen: (screen) => set({ screen }),

  selectKey: (key: KeyId) => set({ instrumentKey: key, screen: 'map' }),

  resetRun: () => set(initialRunState()),

  // TODO(team): combat actions go here. See PRD §4 and §8. Sketch of what's needed:
  //   setScreen(screen)            -> navigate between screens
  //   selectKey(key)               -> store instrument key, go to map
  //   enterNode(nodeId)            -> build a CombatState and go to 'combat'
  //   refreshHandMusic()           -> draw a fresh Exercise per card (new music each round)
  //   playCard(index) / playUltimate()
  //   applyGrade(results)          -> pass = damage + remove card; fail = card returns
  //   enemyTurn()                  -> apply enemy intent unless it just died
  //   winFight() / loseFight()     -> heal to full on win; loss screen on 0 HP
}));
