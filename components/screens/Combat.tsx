'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ac, clickAt, muteMusic, playFile, playMusic, playVoice, settings, sfx, stopVoices } from '@/lib/audio';
import { COUNT_IN_BEATS, RECORD_TAIL_MS, REVIEW_DURATION_MS, TAUNT_ON_HIT_CHANCE, ULTIMATE_PASS_THRESHOLD } from '@/lib/config';
import { ENEMIES } from '@/lib/content';
import { reportAdventurePerformance } from '@/lib/client-performance';
import { grade, mic, simulate, type NoteResult } from '@/lib/mic';
import type { Exercise } from '@/lib/music';
import { instrumentOf, stat, useGame } from '@/lib/store';
import { buildFacts, fetchTaunt, speak, type Taunt } from '@/lib/voice';
import CardView from '../CardView';
import Hud from '../Hud';
import PerformOverlay, { createLiveSheet, type PerformStage } from '../PerformOverlay';
import { Bg, HpBar, Octagon, Scene, Sprite } from '../ui';
import { mapFx } from './MapScreen';
import { useViewport } from '@/lib/viewport';

type Phase = 'enter' | 'player' | 'perform' | 'attack' | 'enemy' | 'win' | 'ko';
type Active = number | 'encore';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const clock = () => performance.now();
const FLOOR_Y = 590; // fighters stand on this line
// Live grading cadence while recording (the cursor still moves every frame).
const LIVE_GRADE_MS = 66;
// Safety net for a voice clip that never reports its end; real lines finish well before.
const LINE_LIMIT_MS = 12000;
const RIFF = { x: 210, size: 320 };

export default function Combat() {
  const combat = useGame((s) => s.combat)!;
  const { handheld, bleedX, bleedY } = useViewport();
  const run = useGame((s) => s.run);
  const demoMode = useGame((s) => s.demoMode);
  const overlay = useGame((s) => s.overlay);
  const enemy = ENEMIES[combat.enemyIdx];
  const inst = instrumentOf(run);
  const cardDamage = stat(run, 'cardDamage');
  const encoreDamage = stat(run, 'encoreDamage');
  const passLine = stat(run, 'passLine') / 100; // cards only; the Encore has its own line
  const timing = stat(run, 'timingWindow');

  const [phase, setPhase] = useState<Phase>('enter');
  const [perform, setPerform] = useState<{ ex: Exercise; active: Active; stage: PerformStage; count: number } | null>(null);
  // The cursor beat and live grading change every frame; only the sheet listens
  // to them, so the fight scene is not re-rendered sixty times a second.
  const [sheet] = useState(createLiveSheet);
  const [hearing, setHearing] = useState<number | null>(null);
  const [fx, setFx] = useState<{ riff?: 'windup' | 'attack' | 'hurt' | 'encore'; enemy?: 'windup' | 'hit' | 'attack' | 'dissolve'; pop?: { v: number; side: 'enemy' | 'riff'; key: number }; flash?: 'red' | 'white'; barrage?: number; enemyBarrage?: number; burst?: number; riffBurst?: number; flyoff?: { type: string; key: number } }>({});
  const [taunt, setTaunt] = useState<(Taunt & { heat: number; speaking: boolean }) | null>(null);
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number; ox: number; oy: number; sx: number; sy: number; pointerId: number; pointerType: string; overEnemy: boolean } | null>(null);
  // Touch: a tapped card is picked up and aimed; tapping the foe (or the card again) plays it.
  const [picked, setPicked] = useState<number | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const [micReady, setMicReady] = useState(mic.status === 'on');
  const rootRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const dragRef = useRef(drag);
  const pickedRef = useRef(picked);
  useLayoutEffect(() => { dragRef.current = drag; pickedRef.current = picked; }, [drag, picked]);
  const busy = useRef(false); // one performance at a time
  const performing = useRef(false); // count-in + recording: no voice may start
  const voiceLine = useRef<Promise<void>>(Promise.resolve()); // the heckle currently being spoken

  const size = enemy.size;
  const enemyX = 1030 - size / 2;
  const enemyY = FLOOR_Y - size;
  // The fight scene covers the window as one piece (see .scene); on phones it also lifts, within
  // the art's spare margin, so the hand never covers the fighters. Hit tests map through the same transform.
  const cover = Math.max(1 + (2 * bleedX) / 1440, 1 + (2 * bleedY) / 900);
  const lift = handheld ? -Math.min(130, (cover - 1) * 450) : 0;
  const onGlass = (x: number, y: number) => ({ x: 720 + (x - 720) * cover, y: 450 + lift + (y - 450) * cover });
  const hit = onGlass(enemyX + size * 0.15, enemyY + size * 0.1);
  const enemyRect = { ...hit, w: size * 0.7 * cover, h: size * 0.9 * cover };

  // ---------- entry (M2 step 4) ----------
  useEffect(() => {
    alive.current = true;
    playMusic(enemy.boss ? 'boss' : 'battle');
    mic.start().then((ok) => {
      if (!alive.current) return;
      setMicReady(ok);
      if (!ok) useGame.getState().setDemo(true);
    });
    const entryTimers = [
      window.setTimeout(() => { setPhase('player'); setDealKey((k) => k + 1); }, 1500),
      window.setTimeout(() => sfx('stampHit'), 700),
      ...[0, 1, 2].map((i) => window.setTimeout(() => sfx('deal'), 1500 + i * 90)),
    ];
    const l = (r: { stableMidi: number | null }) => setHearing(r.stableMidi);
    mic.listeners.add(l);
    return () => {
      alive.current = false;
      performing.current = false;
      entryTimers.forEach(clearTimeout);
      mic.listeners.delete(l);
      mic.endRecording();
      muteMusic(false);
      stopVoices();
    };
  }, [enemy.boss]);

  // ---------- trash talk ----------
  const say = useCallback(
    async (moment: 'miss' | 'enemyTurn' | 'hit', ex: Exercise, results: NoteResult[], failCount: number) => {
      const s = useGame.getState();
      const c = s.combat!;
      const facts = buildFacts(ex, results, inst.shift, inst.writtenOffset, s.run.hp, failCount);
      const t = await fetchTaunt(enemy, c.heat, moment, facts, c.used);
      if (!t) return;
      // One heckle at a time: a new line waits for the current one to finish
      // instead of cutting it off mid-sentence.
      const previous = voiceLine.current;
      let release = () => {};
      voiceLine.current = previous.then(() => new Promise<void>((r) => (release = r)));
      await previous;
      try {
        // A slow reply must not start talking once the next performance is under way (it would leak into the mic).
        if (!alive.current || performing.current) return;
        s.noteTaunt(t.id);
        setTaunt({ ...t, heat: c.heat, speaking: true });
        await Promise.race([speak(t, enemy), wait(LINE_LIMIT_MS)]);
        if (alive.current) setTaunt((cur) => (cur && cur.id === t.id ? { ...cur, speaking: false } : cur));
      } finally {
        if (t.audio) URL.revokeObjectURL(t.audio);
        release();
      }
    },
    [enemy, inst],
  );

  // ---------- M4: K.O. ----------
  async function ko() {
    setPhase('ko');
    setTaunt(null);
    stopVoices();
    muteMusic(true);
    setFx({ flash: 'white' });
    await wait(100);
    if (!alive.current) return;
    setFx({ riff: 'hurt' });
    await wait(600);
    if (!alive.current) return;
    void playFile('/audio/sfx/ko-slam.mp3');
    if (enemy.ko) void playVoice(enemy.ko, enemy.voice === 'choir');
    await wait(enemy.ko ? 2400 : 1600);
    if (!alive.current) return;
    muteMusic(false);
    if (useGame.getState().bossDemo) return useGame.getState().endBossDemo();
    useGame.getState().loseRun();
    useGame.getState().go('loss');
  };

  // ---------- win ----------
  async function win() {
    setPhase('win');
    setTaunt(null);
    setFx({ enemy: 'dissolve' });
    if (enemy.defeat) void playVoice(enemy.defeat, enemy.voice === 'choir');
    void playFile('/audio/sfx/victory-sting.mp3', 0.9);
    await wait(enemy.defeat ? 2600 : 1600);
    if (!alive.current) return;
    if (useGame.getState().bossDemo) return useGame.getState().endBossDemo();
    const final = useGame.getState().run.floor + 1 >= ENEMIES.length;
    useGame.getState().winFight();
    mapFx.reveal = true;
    useGame.getState().go(final ? 'final' : enemy.boss ? 'actclear' : 'victory');
  };

  // ---------- 09a: Riff attacks ----------
  async function attack(dmg: number, active: Active) {
    setPhase('attack');
    const encore = active === 'encore';
    setFx({ riff: encore ? 'encore' : 'windup' });
    if (encore) {
      await wait(500);
      if (!alive.current) return;
      void playFile('/audio/sfx/encore-hit.mp3');
    } else {
      await wait(220);
      if (!alive.current) return;
      setFx({ riff: 'attack' });
      sfx('zap');
    }
    setFx((f) => ({ ...f, barrage: Date.now() }));
    if (typeof active === 'number') setFx((f) => ({ ...f, flyoff: { type: useGame.getState().combat!.hand[active].type, key: Date.now() } }));
    await wait(encore ? 700 : 520);
    if (!alive.current) return;
    sfx('impact');
    setFx((f) => ({ ...f, enemy: 'hit', burst: Date.now(), pop: { v: dmg, side: 'enemy', key: Date.now() }, flash: encore ? 'white' : undefined }));
    useGame.getState().damageEnemy(dmg);
    sfx('damage', 0.1);
    await wait(900);
    setFx({});
  };

  // ---------- 09b: enemy turn ----------
  async function enemyTurn(lastPass: boolean, ex: Exercise, results: NoteResult[], failCount: number) {
    if (!alive.current) return;
    setPhase('enemy');
    const c = useGame.getState().combat!;
    // One more line if they're fired up (heat 1 after a pass, heat 3 after a miss), sometimes after a hit.
    const wantLine = lastPass ? c.heat >= 1 || Math.random() < TAUNT_ON_HIT_CHANCE : c.heat >= 3;
    const talking = wantLine ? say(lastPass ? (c.heat >= 1 ? 'enemyTurn' : 'hit') : 'enemyTurn', ex, results, failCount) : Promise.resolve();
    await wait(500);
    if (!alive.current) return;
    setFx({ enemy: 'windup' });
    await wait(220);
    if (!alive.current) return;
    const launched = Date.now();
    setFx({ enemy: 'attack', enemyBarrage: launched });
    void playFile(enemy.attackSfx, 0.9);
    // The attack reaches Riff before HP drops; the projectile carries the hit.
    await wait(520);
    if (!alive.current) return;
    const hp = useGame.getState().enemyHitsPlayer();
    sfx('hurt');
    setFx({ enemy: 'attack', enemyBarrage: launched, riffBurst: launched, riff: 'hurt', flash: 'red', pop: { v: enemy.damage, side: 'riff', key: Date.now() } });
    await wait(800);
    if (!alive.current) return;
    setFx({});
    if (hp <= 0) return ko();
    // The turn comes back once the enemy has finished its line.
    await Promise.race([talking, wait(LINE_LIMIT_MS)]);
    await wait(250);
    if (!alive.current) return;
    useGame.getState().nextRound();
    busy.current = false;
    setTaunt((t) => (t && !t.speaking ? null : t));
    setPhase('player');
    setDealKey((k) => k + 1);
    [0, 1, 2].forEach((i) => window.setTimeout(() => sfx('deal'), i * 90));
  };

  // ---------- one card / encore performance ----------
  const performAction = useCallback(
    async (active: Active) => {
      const s = useGame.getState();
      const c = s.combat;
      if (busy.current || s.overlay || !c) return;
      if (active === 'encore' ? !c.encore?.charged : !c.hand[active] || c.hand[active].landed) return;
      busy.current = true;
      performing.current = true;
      setPicked(null);
      setDrag(null);
      const ex = active === 'encore' ? c.encoreExercise : c.hand[active].exercise;
      const attemptId = crypto.randomUUID();
      const practiceUser = s.user?.username ?? null;
      setTaunt(null);
      stopVoices();
      // Silence from the moment a card is picked until the review is over: the
      // battle loop's tempo and key fight the sheet the player is reading.
      muteMusic(true);
      setPhase('perform');
      // M1: flip (card grows + scaleX pinch) then unfold into the sheet
      sfx('flip');
      setPerform({ ex, active, stage: 'unfold', count: 0 });
      sheet.set({ beat: null, results: [] });
      if (active === 'encore') void playFile('/audio/sfx/encore-charge.mp3', 0.8);
      await wait(450);
      if (!alive.current) return;
      // Count-in: music + voices stay hard-muted so nothing leaks into the mic.
      const mspb = 60000 / ex.tempo;
      const beats = settings.countIn || COUNT_IN_BEATS;
      const ctx = ac();
      const t0 = ctx.currentTime + 0.12;
      for (let b = 0; b < beats; b++) clickAt(t0 + (b * mspb) / 1000, b === 0);
      const startPerf = performance.now() + 120 + beats * mspb;
      for (let b = 0; b < beats; b++) {
        window.setTimeout(() => alive.current && setPerform((p) => p && { ...p, stage: 'countin', count: b + 1 }), 120 + b * mspb);
      }
      // Feed negative beats through the count-in so follow-along circles for the
      // first notes are already closing when the downbeat arrives.
      let counting = true;
      const pre = () => {
        if (!counting || !alive.current) return;
        sheet.set({ beat: (clock() - startPerf) / mspb });
        requestAnimationFrame(pre);
      };
      requestAnimationFrame(pre);
      const demo = useGame.getState().demoMode || mic.status !== 'on';
      const sim = demo ? simulate(ex, inst.shift, 0.82) : null;
      await wait(120 + beats * mspb - 30);
      counting = false;
      if (!alive.current) return;
      mic.beginRecording();
      const totalBeats = ex.notes[ex.notes.length - 1].startBeat + ex.notes[ex.notes.length - 1].durBeats;
      setPerform((p) => p && { ...p, stage: 'recording' });
      await new Promise<void>((done) => {
        let graded = -Infinity;
        let results: (NoteResult | undefined)[] = [];
        const tick = () => {
          if (!alive.current) return done();
          const now = performance.now();
          const beat = (now - startPerf) / mspb;
          // The cursor moves every frame; grading the growing take only needs
          // ~15 passes a second (a note's result only lands when it ends).
          if (now - graded >= LIVE_GRADE_MS) {
            graded = now;
            if (sim) {
              results = ex.notes.map((n, i) => (beat >= n.startBeat + n.durBeats ? sim[i] : undefined));
            } else {
              const g = grade(ex, mic.peek(), startPerf, inst.shift, timing);
              results = ex.notes.map((n, i) => (now >= startPerf + (n.startBeat + n.durBeats) * mspb + 110 ? g[i] : undefined));
            }
          }
          sheet.set({ beat: Math.max(0, beat), results });
          if (now > startPerf + totalBeats * mspb + RECORD_TAIL_MS) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      if (!alive.current) return;
      const readings = mic.endRecording();
      const final: NoteResult[] = sim ?? grade(ex, readings, startPerf, inst.shift, timing);
      const hits = final.filter((r) => r.status === 'hit').length;
      if (!s.bossDemo && (useGame.getState().user?.username ?? null) === practiceUser) {
        void reportAdventurePerformance({ attemptId, instrument: inst.id, exercise: ex, notes: final, simulated: !!sim }, practiceUser !== null);
      }
      const pass = hits / final.length >= (active === 'encore' ? ULTIMATE_PASS_THRESHOLD : passLine);
      performing.current = false;
      if (!alive.current) return;
      sheet.set({ beat: null, results: final });
      setPerform((p) => p && { ...p, stage: 'review' });
      sfx(pass ? 'stampHit' : 'stampMiss');

      const st = useGame.getState();
      const failCount = active === 'encore' ? 0 : c.hand[active].fails + (pass ? 0 : 1);
      if (active === 'encore') st.resolveEncore(pass, hits, final.length, !!sim);
      else st.resolveCard(active, pass, hits, final.length, !!sim);

      // Miss: the enemy heckles during the review (PRD §7a).
      const talk = !pass ? say('miss', ex, final, failCount) : Promise.resolve();
      await wait(REVIEW_DURATION_MS);
      if (!alive.current) return;
      setPerform(null);
      muteMusic(false);

      if (pass) {
        await attack(active === 'encore' ? encoreDamage : cardDamage, active);
      }
      if (!alive.current) return;
      if (useGame.getState().combat!.enemyHp <= 0) return win();
      await talk;
      await enemyTurn(pass, ex, final, failCount);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inst, passLine, timing, cardDamage, encoreDamage, say],
  );

  // ---------- input: drag a card onto the enemy (05) ----------
  const toStage = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    const k = r.width / 1440;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const overEnemy = (x: number, y: number) => x > enemyRect.x && x < enemyRect.x + enemyRect.w && y > enemyRect.y && y < enemyRect.y + enemyRect.h;

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return;
      const p = toStage(e);
      setDrag((d) => d && { ...d, x: p.x, y: p.y, overEnemy: overEnemy(p.x, p.y) });
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      setPicked(null);
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      if (busy.current || useGame.getState().overlay) return;
      if (d?.overEnemy) {
        setPicked(null);
        sfx('drop');
        void performAction(d.idx);
      } else if (d.pointerType !== 'mouse' && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 14) {
        // Use screen pixels so a phone's stage scale does not shrink tap tolerance.
        if (pickedRef.current === d.idx) { setPicked(null); sfx('drop'); void performAction(d.idx); }
        else { setPicked(d.idx); sfx('hover'); }
      } else if (d) sfx('back');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.idx]);

  const canAct = phase === 'player' && !overlay;
  useEffect(() => {
    if (!canAct) {
      dragRef.current = null;
      // An overlay cancels the external pointer gesture before controls can re-open.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrag(null);
      setPicked(null);
    }
  }, [phase, canAct]);
  const playPicked = () => {
    if (picked === null || !canAct) return;
    const i = picked;
    setPicked(null);
    sfx('drop');
    void performAction(i);
  };
  // Pause/stats/map can only open on the player's turn: nothing is running then.
  useEffect(() => {
    useGame.setState({ combatLocked: phase !== 'player' });
    return () => useGame.setState({ combatLocked: false });
  }, [phase]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!canAct) return;
      const live = combat.hand.map((c, i) => ({ c, i })).filter(({ c }) => !c.landed);
      const n = Number(e.key);
      if (n >= 1 && n <= live.length) { setPicked(null); sfx('drop'); void performAction(live[n - 1].i); }
      if ((e.key === 'e' || e.key === 'E') && combat.encore?.charged) { sfx('drop'); void performAction('encore'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [canAct, combat, performAction]);

  // ---------- layout ----------
  const live = combat.hand.map((card, i) => ({ card, i })).filter(({ card }) => !card.landed);
  const fan = live.length === 3 ? [[436, 630, -6], [620, 612, 0], [804, 622, 6]] : live.length === 2 ? [[528, 620, -4], [712, 620, 4]] : [[620, 612, 0]];
  // Handhelds: bigger cards in a wider fan. Their tops stay put (the extra height
  // runs off the bottom of the glass) so the fighters' HP bars stay in view, and a
  // tapped card rises until all of it shows.
  const cardK = handheld ? 1.5 : 1; // S3: phones get big cards in a wide fan, names always readable
  const fanAt = (n: number) => { const [x, y, rot] = fan[n]; return [720 + (x + 100 - 720) * cardK - 100, y + 280 * (cardK - 1) + (handheld ? 18 : 0), rot]; };
  const liftedTop = (y: number) => (handheld ? 604 : y - 44);
  const landedCount = combat.hand.filter((c) => c.landed).length;
  const riffSprite = fx.riff === 'attack' && inst.id === 'trumpet' ? '/assets/sprites/riff-attack.png' : fx.riff === 'hurt' && inst.id === 'trumpet' ? '/assets/sprites/riff-hurt.png' : inst.sprite;
  const enemySprite = fx.enemy === 'attack' && enemy.attackSprite ? enemy.attackSprite : enemy.sprite;
  const banner =
    phase === 'enemy' ? { k: 'ENEMY TURN', t: `${enemy.name} hits Riff for ${enemy.damage}`, c: '#FF6B76' }
    : phase === 'player' ? (combat.encore?.charged ? { k: 'BOSS FIGHT', t: 'Encore is charged. Play the song to end it.', c: 'var(--sun)' } : { k: 'YOUR TURN', t: picked !== null ? `Tap ${enemy.name} to play it` : <><span className="kbd-only">Drag a card onto {enemy.name}</span><span className="touch-only">Tap a card, then tap {enemy.name}</span></>, c: 'var(--sun)' })
    : phase === 'attack' ? { k: 'CARD LANDS!', t: `${enemy.name} takes the hit`, c: 'var(--sun)' }
    : null;
  const dark = fx.riff === 'encore';

  return (
    <div ref={rootRef} className="fill" style={{ background: '#101126', animation: fx.flash === 'red' || phase === 'ko' ? 'shake 300ms steps(4)' : undefined }}>
      <Scene shift={`${lift}px`}>
      <Bg src={enemy.bg} style={{ filter: `${enemy.bgFilter ?? ''} ${phase === 'ko' ? 'saturate(0.2)' : ''} ${dark ? 'brightness(0.2)' : ''}`, transition: 'filter 300ms steps(3)' }} />
      <div className="fill" style={{ background: 'linear-gradient(180deg, rgba(16,17,38,0.35) 0%, rgba(16,17,38,0.1) 45%, rgba(16,17,38,0.15) 70%, rgba(16,17,38,0.8) 100%)' }} />
      {dark && <div style={{ position: 'absolute', left: 120, top: 0, width: 500, height: 900, background: 'linear-gradient(180deg, rgba(255,230,150,0.4), rgba(255,230,150,0.05))', clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)', animation: 'fadeIn 300ms steps(3)' }} />}

      {/* Riff */}
      <div style={{ position: 'absolute', left: RIFF.x, top: FLOOR_Y - RIFF.size, width: RIFF.size, zIndex: 5, animation: phase === 'enter' ? 'slideInLeft 500ms 300ms steps(6) both' : undefined }}>
        <div style={{ position: 'absolute', left: 80, top: RIFF.size - 16, width: 160, height: 18, borderRadius: '50%', background: 'rgba(16,17,38,0.55)' }} />
        <Sprite
          key={`${riffSprite}-${fx.riff}`}
          src={riffSprite}
          x={0}
          y={0}
          size={RIFF.size}
          style={{
            position: 'relative',
            animation:
              phase === 'ko' && fx.riff === 'hurt' ? 'knockback 500ms steps(5) both, dissolve 600ms 1500ms steps(8) forwards'
              : fx.riff === 'hurt' ? 'knockback 500ms steps(5), hitFlash 400ms steps(2)'
              : fx.riff === 'attack' || fx.riff === 'encore' ? 'lungeRight 500ms steps(4)'
              : undefined,
            transform: fx.riff === 'windup' ? 'translateX(-18px) rotate(-3deg)' : undefined,
            filter: fx.flash === 'white' ? 'brightness(0)' : undefined,
          }}
        />
        <HpBar hp={run.hp} max={stat(run, 'maxHp')} big={handheld} style={{ margin: '4px auto 0' }} />
        {fx.riffBurst && <ImpactBurst key={fx.riffBurst} x={RIFF.size / 2} y={RIFF.size * .45} />}
        {phase === 'ko' && <PixelBurst x={160} y={160} delay={1600} />}
      </div>

      {/* Enemy */}
      <div style={{ position: 'absolute', left: enemyX, top: enemyY, width: size, zIndex: 5, animation: phase === 'enter' ? 'slideInRight 500ms 300ms steps(6) both' : undefined }}>
        {phase !== 'win' && (
          <div className="combat-intent ui-b ui-soft" style={{ position: 'absolute', left: size / 2 - 38, top: -46, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 6px', background: 'rgba(16,17,38,0.85)', border: '3px solid #101126' }}>
            <svg width="24" height="24" viewBox="0 0 8 8" shapeRendering="crispEdges">
              <rect x="6" y="0" width="2" height="1" fill="#fff" /><rect x="7" y="1" width="1" height="1" fill="#fff" />
              <rect x="5" y="1" width="2" height="1" fill="#E6ECFF" /><rect x="4" y="2" width="2" height="1" fill="#E6ECFF" />
              <rect x="3" y="3" width="2" height="1" fill="#E6ECFF" /><rect x="2" y="4" width="2" height="1" fill="#E6ECFF" />
              <rect x="1" y="4" width="1" height="1" fill="#FFD23F" /><rect x="3" y="6" width="1" height="1" fill="#FFD23F" /><rect x="0" y="6" width="2" height="2" fill="#A0673A" />
            </svg>
            <span className="f-press" style={{ fontSize: 22, color: '#FF8A93', textShadow: '#101126 3px 3px 0' }}>{enemy.damage}</span>
          </div>
        )}
        <div style={{ position: 'absolute', left: size * 0.26, top: size - 16, width: size * 0.48, height: 18, borderRadius: '50%', background: 'rgba(16,17,38,0.55)' }} />
        <Sprite
          key={`${enemySprite}-${fx.enemy}`}
          src={enemySprite}
          x={0}
          y={0}
          size={size}
          style={{
            position: 'relative',
            animation:
              fx.enemy === 'dissolve' ? 'hitFlash 300ms steps(2), dissolve 1200ms 300ms steps(10) forwards'
              : fx.enemy === 'hit' ? 'hitFlash 400ms steps(2), shakeSmall 300ms steps(3)'
              : fx.enemy === 'attack' ? 'lungeLeft 700ms steps(5)'
              : undefined,
            transform: fx.enemy === 'windup' ? 'translateX(20px) rotate(4deg)' : undefined,
            filter: fx.flash === 'white' ? 'brightness(0)' : enemy.spriteFilter,
          }}
        />
        <HpBar hp={combat.enemyHp} max={enemy.hp} width={250} big={handheld} style={{ margin: '4px auto 0' }} />
        {(drag?.overEnemy || (picked !== null && !drag)) && <Reticle size={size} />}
        {fx.burst && <ImpactBurst key={fx.burst} x={size / 2} y={size * 0.45} big={fx.riff === 'encore'} />}
        {phase === 'win' && <PixelBurst x={size / 2} y={size / 2} />}
      </div>

      {/* Note barrage (09a) */}
      {fx.barrage && <NoteBarrage key={`barrage-${fx.barrage}`} from={{ x: RIFF.x + 280, y: FLOOR_Y - 190 }} to={{ x: 1030, y: enemyY + size * 0.4 }} />}
      {fx.enemyBarrage && <NoteBarrage key={`enemy-barrage-${fx.enemyBarrage}`} from={{ x: enemyX + size * .2, y: enemyY + size * .4 }} to={{ x: RIFF.x + RIFF.size / 2, y: FLOOR_Y - RIFF.size * .55 }} enemy />}

      {/* Damage pops */}
      {fx.pop && (
        <div key={`pop-${fx.pop.key}`} className="f-press" style={{ position: 'absolute', zIndex: 20, left: fx.pop.side === 'enemy' ? enemyX + size * 0.6 : RIFF.x + 60, top: fx.pop.side === 'enemy' ? enemyY + 10 : FLOOR_Y - RIFF.size + 10, fontSize: fx.pop.v >= 100 ? 96 : 60, color: '#FF4F5E', textShadow: '#101126 -4px 0 0, #101126 4px 0 0, #101126 0 -4px 0, #101126 0 4px 0, #FFD23F 6px 8px 0', animation: 'dmgPop 1100ms steps(8) forwards' }}>
          -{fx.pop.v}
        </div>
      )}
      {taunt && <TauntBubble taunt={taunt} name={enemy.name} x={Math.min(960, Math.max(40, enemyX + size / 2 - 230))} y={Math.max(150, enemyY - 150)} />}
      </Scene>
      {fx.flash === 'red' && <div className="fill bleed" style={{ zIndex: 19, background: '#E8434F', animation: 'redFlash 400ms steps(3) forwards', pointerEvents: 'none' }} />}
      {fx.flash === 'white' && phase === 'ko' && <div className="fill bleed" style={{ zIndex: 19, background: '#fff', animation: 'redFlash 200ms steps(2) forwards' }} />}
      {phase === 'ko' && <KoOverlay />}

      {/* Card fly-off (09a) */}
      {fx.flyoff && (
        <div key={`fly-${fx.flyoff.key}`} style={{ position: 'absolute', left: 620, top: 300, zIndex: 25, animation: 'cardFlyOff 700ms steps(8) forwards' }}>
          <div style={{ width: 200, height: 280, background: fx.flyoff.type === 'chord' ? '#C23A7E' : fx.flyoff.type === 'rhythm' ? '#C9901B' : '#2F7EC4', border: '4px solid #101126', boxShadow: '#FFF6E0 0 0 0 4px inset' }} />
        </div>
      )}

      {/* Turn banner */}
      {banner && (
        <div key={banner.k} className="combat-turn-banner" style={{ position: 'absolute', left: 0, top: 'calc(var(--hud-bottom) + var(--banner-gap, 29px))', width: 1440, display: 'flex', justifyContent: 'center', zIndex: 8, animation: 'dropIn 260ms steps(4) both' }}>
          <div className="ui-t ui-soft" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 28px', backgroundImage: 'linear-gradient(90deg, rgba(27,29,58,0), rgba(27,29,58,0.85) 18%, rgba(27,29,58,0.85) 82%, rgba(27,29,58,0))' }}>
            <span className="f-press" style={{ fontSize: 16, color: banner.c }}>{banner.k}</span>
            <span style={{ width: 6, height: 6, background: 'var(--muted)' }} />
            <span className="f-body" style={{ fontSize: 17, fontWeight: 600, color: '#E6E8F7' }}>{banner.t}</span>
          </div>
        </div>
      )}


      {/* Hand */}
      {(phase === 'player' || phase === 'enemy' || phase === 'attack') &&
        live.map(({ card, i }, n) => {
          const [x, y, rot] = fanAt(n);
          const dragging = drag?.idx === i;
          return (
            <div
              key={`${i}-${dealKey}-${card.exercise.id}`}
              onPointerDown={(e) => {
                if (!canAct || busy.current || !e.isPrimary || e.button !== 0 || dragRef.current) return;
                const p = toStage(e);
                sfx('drag');
                setDrag({ idx: i, x: p.x, y: p.y, ox: p.x - x, oy: p.y - y, sx: e.clientX, sy: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, overEnemy: false });
              }}
              onMouseEnter={() => canAct && sfx('hover')}
              style={{
                position: 'absolute', zIndex: dragging ? 40 : 10 + n, touchAction: 'none', cursor: canAct ? 'grab' : 'default',
                left: dragging ? drag.x - drag.ox : x, top: dragging ? drag.y - drag.oy - 20 : picked === i ? liftedTop(y) : y, scale: cardK === 1 ? undefined : cardK,
                ['--rot' as string]: `${rot}deg`,
                transform: dragging ? `rotate(${Math.max(-12, Math.min(12, (drag.x - (x + 100)) / 30))}deg) scale(1.05)` : `rotate(${rot}deg)`,
                transformOrigin: '50% 100%',
                transition: dragging ? undefined : 'top 120ms steps(3)',
                filter: phase !== 'player' ? 'brightness(0.6)' : picked === i ? 'drop-shadow(0 0 14px rgba(255,210,63,0.9))' : undefined,
              }}
              className={canAct && !dragging ? 'card-hover' : undefined}
            >
              <div style={{ ['--rot' as string]: '0deg', animation: `cardDeal 360ms ${n * 90}ms steps(6) both` }}>
                <CardView type={card.type} ex={card.exercise} damage={cardDamage} lifted={dragging} />
              </div>
              <div className="f-press kbd-only" style={{ position: 'absolute', right: 8, bottom: 190, width: 20, height: 20, display: 'grid', placeItems: 'center', background: '#101126', color: 'var(--muted)', fontSize: 10 }}>{n + 1}</div>
            </div>
          );
        })}
      {picked !== null && !drag && (() => {
        const n = live.findIndex(({ i }) => i === picked);
        if (n < 0) return null;
        const [x, y] = fanAt(n);
        const top = liftedTop(y) + 280 * (1 - cardK);
        return (
          <>
            {/* Tap anywhere else to put the card back; tap the foe to play it. */}
            <div className="fill bleed" style={{ zIndex: 9 }} onPointerDown={() => { setPicked(null); sfx('back'); }} />
            <div style={{ position: 'absolute', left: enemyRect.x, top: enemyRect.y, width: enemyRect.w, height: enemyRect.h, zIndex: 36, cursor: 'pointer' }} onPointerDown={playPicked} />
            <DragArrow from={{ x: x + 100, y: top + 10 }} to={{ x: enemyRect.x + enemyRect.w / 2, y: enemyRect.y + enemyRect.h * 0.4 }} active />
          </>
        );
      })()}
      {drag && <DragArrow from={{ x: drag.x, y: drag.y - 20 }} to={drag.overEnemy ? { x: enemyRect.x + enemyRect.w / 2, y: enemyRect.y + enemyRect.h * 0.4 } : { x: drag.x, y: drag.y - 60 }} active={drag.overEnemy} />}

      {/* Bottom-left: mic orb or Encore (boss) */}
      {combat.encore ? (
        <EncoreButton charged={combat.encore.charged && canAct} damage={encoreDamage} onPlay={() => { sfx('drop'); void performAction('encore'); }} />
      ) : (
        <div className="combat-chip ui-bl" style={{ position: 'absolute', left: 'calc(40px - var(--rail-l))', bottom: 'calc(50px - var(--rail-b))', display: 'flex', alignItems: 'center', gap: 14, zIndex: 12 }}>
          <div className="desk-only">
            <Octagon size={112} ring="#FFD23F" fill="#2A2F55">
              <span className="f-press" style={{ fontSize: 16, color: '#fff' }}>{inst.keyLabel}</span>
              <span className="f-label" style={{ fontSize: 10, color: 'var(--sun)' }}>{inst.name.toUpperCase()}</span>
            </Octagon>
          </div>
          <span className="f-press hand-only" style={{ fontSize: 16, color: '#fff' }}>{inst.keyLabel}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="f-label" style={{ fontSize: 12, color: '#C9CDE8' }}>{micReady && !demoMode ? 'MIC' : 'DEMO'}</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
              {[6, 10, 14, 18, 22].map((h, i) => <div key={i} style={{ width: 6, height: h, background: hearing !== null && i < 4 ? 'var(--meadow)' : micReady ? (i < 2 ? 'var(--meadow)' : '#3A3F70') : '#3A3F70' }} />)}
            </div>
          </div>
        </div>
      )}

      {/* Round badge */}
      <div className="combat-chip combat-round ui-br" style={{ position: 'absolute', right: 'calc(40px - var(--rail-r))', bottom: 'calc(50px - var(--rail-b))', display: 'flex', alignItems: 'center', gap: 14, zIndex: 12 }}>
        <span className="f-label hand-only" style={{ fontSize: 12, color: 'var(--muted)' }}>ROUND <b className="f-press" style={{ marginLeft: 6, fontSize: 16, color: '#fff' }}>{combat.round}</b></span>
        <div className="combat-landed" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span className="f-label" style={{ fontSize: 12, color: '#C9CDE8' }}>LANDED</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 16, background: i < landedCount ? 'var(--magenta)' : '#3A3F70', border: '2px solid #101126', animation: i === landedCount - 1 ? 'popIn 300ms steps(4)' : undefined }} />)}
          </div>
        </div>
        <Octagon size={112} className="desk-only">
          <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>ROUND</span>
          <span key={combat.round} className="f-press" style={{ fontSize: 30, color: '#fff', textShadow: '#101126 3px 3px 0', animation: 'popIn 300ms steps(4)' }}>{combat.round}</span>
        </Octagon>
      </div>

      {/* Perform overlay (06 · 07 · 08) */}
      {perform && (
        <>
          {perform.stage === 'unfold' && typeof perform.active === 'number' && (
            <div style={{ position: 'absolute', left: 620, top: 280, zIndex: 32, animation: 'flipOpen 300ms steps(6) both' }}>
              <CardView type={combat.hand[perform.active].type} ex={perform.ex} damage={cardDamage} />
            </div>
          )}
          <PerformOverlay
            ex={perform.ex}
            inst={inst}
            enemy={enemy}
            damage={perform.active === 'encore' ? encoreDamage : cardDamage}
            stage={perform.stage}
            count={perform.count}
            sheet={sheet}
            hearing={perform.stage === 'recording' ? hearing : null}
            passLine={passLine}
            demo={demoMode || !micReady}
          />
        </>
      )}

      {/* Entry letterbox + FIGHT! */}
      {phase === 'enter' && (
        <>
          <div style={{ position: 'absolute', left: 'calc(-1 * var(--bleed-x))', top: 'calc(-1 * var(--bleed-y))', width: 'calc(1440px + 2 * var(--bleed-x))', height: 'calc(450px + var(--bleed-y))', background: '#101126', zIndex: 50, animation: 'curtainUp 500ms steps(6) forwards' }} />
          <div style={{ position: 'absolute', left: 'calc(-1 * var(--bleed-x))', top: 450, width: 'calc(1440px + 2 * var(--bleed-x))', height: 'calc(450px + var(--bleed-y))', background: '#101126', zIndex: 50, animation: 'curtainDown 500ms steps(6) forwards' }} />
          <div className="f-press" style={{ position: 'absolute', left: 0, top: 360, width: 1440, textAlign: 'center', zIndex: 51, fontSize: 88, color: 'var(--sun)', textShadow: '#101126 6px 6px 0, #D1307E 10px 12px 0', animation: 'slam 400ms 600ms steps(6) both, fadeOut 200ms 1300ms forwards' }}>
            {enemy.boss ? 'BOSS!' : 'FIGHT!'}
          </div>
        </>
      )}
      <Hud center={`THE CLIMB · FLOOR ${enemy.floor} OF 18${enemy.boss ? ' · BOSS' : ''}`} />
    </div>
  );
}

function Reticle({ size }: { size: number }) {
  const s = size * 0.7;
  return (
    <svg style={{ position: 'absolute', left: size * 0.15, top: size * 0.1, pointerEvents: 'none', animation: 'popIn 160ms steps(3)' }} width={s} height={s} viewBox="0 0 20 20" shapeRendering="crispEdges">
      {[[0, 0], [16, 0], [0, 16], [16, 16]].map(([x, y], i) => (
        <g key={i} fill="#FFD23F"><rect x={x} y={y} width="4" height="1" /><rect x={x + (x ? 3 : 0)} y={y} width="1" height="4" /><rect x={x} y={y + (y ? 3 : 0)} width="4" height="1" /><rect x={x + (x ? 3 : 0)} y={y} width="1" height="4" /></g>
      ))}
    </svg>
  );
}

function DragArrow({ from, to, active }: { from: { x: number; y: number }; to: { x: number; y: number }; active: boolean }) {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 120;
  return (
    <svg className="fill" style={{ zIndex: 39, pointerEvents: 'none' }} width={1440} height={900}>
      <path d={`M${from.x} ${from.y} Q${mx} ${my} ${to.x} ${to.y}`} stroke={active ? '#FFD23F' : '#FFF6E0'} strokeWidth={6} strokeDasharray="4 10" fill="none" strokeLinecap="square" />
      <rect x={to.x - 8} y={to.y - 8} width={16} height={16} fill={active ? '#FFD23F' : '#FFF6E0'} />
    </svg>
  );
}

function NoteBarrage({ from, to, enemy }: { from: { x: number; y: number }; to: { x: number; y: number }; enemy?: boolean }) {
  const colors = enemy ? ['#E8434F', '#FF8A93', '#FFF6E0'] : ['#FFD23F', '#FF4FA3', '#FFF6E0', '#FFD23F', '#9FD8FF', '#FF7DB8'];
  return (
    <div className="fill" style={{ zIndex: 18, pointerEvents: 'none' }}>
      {colors.map((c, i) => (
        <svg
          key={i}
          width="30"
          height="36"
          viewBox="0 0 5 6"
          shapeRendering="crispEdges"
          style={{ position: 'absolute', left: from.x, top: from.y + ((i * 37) % 60) - 30, ['--dx' as string]: `${to.x - from.x}px`, ['--dy' as string]: `${to.y - from.y - ((i * 37) % 60) + 30}px`, animation: `noteFly 520ms ${i * 60}ms steps(8) both` }}
        >
          <rect x="3" y="0" width="1" height="5" fill={c} /><rect x="0" y="3" width="4" height="3" fill={c} /><rect x="4" y="0" width="1" height="2" fill={c} />
        </svg>
      ))}
    </div>
  );
}

function ImpactBurst({ x, y, big }: { x: number; y: number; big?: boolean }) {
  const s = big ? 260 : 150;
  return (
    <svg style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, pointerEvents: 'none', animation: 'burst 400ms steps(5) forwards' }} width={s} height={s} viewBox="0 0 15 15" shapeRendering="crispEdges">
      <rect x="7" y="0" width="1" height="4" fill="#FFF6E0" /><rect x="7" y="11" width="1" height="4" fill="#FFF6E0" />
      <rect x="0" y="7" width="4" height="1" fill="#FFF6E0" /><rect x="11" y="7" width="4" height="1" fill="#FFF6E0" />
      <rect x="3" y="3" width="2" height="2" fill="#FFD23F" /><rect x="10" y="3" width="2" height="2" fill="#FFD23F" />
      <rect x="3" y="10" width="2" height="2" fill="#FFD23F" /><rect x="10" y="10" width="2" height="2" fill="#FFD23F" />
      <rect x="5" y="5" width="5" height="5" fill="#FF4FA3" /><rect x="6" y="6" width="3" height="3" fill="#fff" />
    </svg>
  );
}

function PixelBurst({ x, y, delay = 300 }: { x: number; y: number; delay?: number }) {
  const colors = ['#FFF6E0', '#D1307E', '#1E2140', '#FFD23F', '#E8434F', '#9AA0C8'];
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const d = 60 + ((i * 37) % 90);
        return <div key={i} style={{ position: 'absolute', width: 8, height: 8, background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d - 80}px`, animation: `pixelDrift 1200ms ${delay + (i % 5) * 60}ms steps(10) both` }} />;
      })}
    </div>
  );
}

function KoOverlay() {
  return (
    <div className="fill bleed" style={{ zIndex: 45, pointerEvents: 'none' }}>
      <div className="bleed" style={{ background: 'rgba(232,67,79,0.35)', animation: 'fadeIn 500ms 100ms steps(4) both' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 'calc(60px + var(--bleed-y))', background: '#101126', animation: 'dropIn 300ms 700ms steps(4) both' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 'calc(60px + var(--bleed-y))', background: '#101126', animation: 'riseIn 300ms 700ms steps(4) both' }} />
      <div className="f-press" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(330px + var(--bleed-y))', textAlign: 'center', fontSize: 180, lineHeight: '190px', color: 'var(--sun)', textShadow: '#101126 10px 10px 0, #E8434F 16px 18px 0', animation: 'slam 300ms 700ms steps(4) both' }}>
        K.O.
      </div>
    </div>
  );
}

function EncoreButton({ charged, damage, onPlay }: { charged: boolean; damage: number; onPlay: () => void }) {
  return (
    <div className="ui-bl" style={{ position: 'absolute', left: 'calc(36px - var(--rail-l))', bottom: 'calc(40px - var(--rail-b))', display: 'flex', alignItems: 'center', gap: 18, zIndex: 12 }}>
      <button
        disabled={!charged}
        onClick={onPlay}
        onMouseEnter={() => charged && sfx('hover')}
        style={{ position: 'relative', width: 148, height: 148, borderRadius: '50%', background: '#101126', display: 'grid', placeItems: 'center', cursor: charged ? 'pointer' : 'default', boxShadow: charged ? '0 0 0 6px rgba(255,79,163,0.4), 0 0 30px rgba(255,79,163,0.6)' : undefined, borderColor: 'transparent' }}
      >
        <div style={{ width: 124, height: 124, borderRadius: '50%', display: 'grid', placeItems: 'center', background: charged ? '#D1307E' : '#3A3F70', border: `6px solid ${charged ? '#FFD23F' : '#2A2F55'}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span className="f-music" style={{ fontSize: 40, lineHeight: '40px', color: charged ? '#FFD23F' : '#6B6F8E' }}>♫</span>
            <span className="f-press" style={{ fontSize: 13, color: charged ? '#fff' : '#9AA0C8', textShadow: '#101126 2px 2px 0' }}>ENCORE</span>
          </div>
        </div>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="f-label" style={{ fontSize: 11, color: charged ? 'var(--sun)' : 'var(--muted)' }}>{charged ? <>■ CHARGED<span className="kbd-only"> · PRESS E</span><span className="touch-only"> · TAP</span></> : '□ LAND ALL 3 CARDS'}</span>
        <span className="f-press" style={{ fontSize: 16, color: '#fff' }}>{damage} DMG</span>
        <span className="f-body" style={{ width: 170, fontSize: 15, lineHeight: '19px', color: 'var(--muted)' }}>Play Gran Vals (the Nokia tune).</span>
      </div>
    </div>
  );
}

function TauntBubble({ taunt, name, x, y }: { taunt: Taunt & { heat: number; speaking: boolean }; name: string; x: number; y: number }) {
  const hot = taunt.heat >= 3;
  return (
    <div key={taunt.id + taunt.text} className="ui-b ui-soft" style={{ position: 'absolute', left: x, top: y, width: 460, zIndex: 35, animation: `popIn 220ms steps(4) both${hot ? ', shakeSmall 200ms 220ms steps(2) 4' : ''}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px 18px', background: 'var(--parchment)', border: `4px solid ${hot ? '#E8434F' : '#101126'}`, boxShadow: 'inset 0 -5px 0 #F0DDB4, #101126 6px 6px 0', rotate: hot ? '-1.5deg' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="f-press" style={{ padding: '3px 8px', background: '#101126', fontSize: 10, color: 'var(--sun)' }}>{name.toUpperCase()}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
              {[6, 12, 16, 8, 14, 5, 10].map((h, i) => <div key={i} style={{ width: 3, height: h, background: '#D1307E', transformOrigin: 'center', animation: taunt.speaking ? `wave ${220 + i * 50}ms steps(3) infinite` : undefined, opacity: taunt.speaking ? 1 : 0.3 }} />)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="f-label" style={{ fontSize: 10, color: '#6B6F8E' }}>HEAT</span>
            {[1, 2, 3].map((h) => <div key={h} style={{ width: 10, height: 12, background: taunt.heat >= h ? (taunt.heat >= 2 ? '#E8434F' : '#FFD23F') : '#D8D2C0' }} />)}
          </div>
        </div>
        <div className="f-body" style={{ fontSize: 21, fontWeight: 600, lineHeight: '27px', color: '#101126' }}>&ldquo;{taunt.text}&rdquo;</div>
      </div>
      <svg style={{ marginLeft: 180, marginTop: -4, display: 'block' }} width="54" height="36" viewBox="0 0 9 6" shapeRendering="crispEdges">
        <rect x="0" y="0" width="9" height="1" fill="#101126" /><rect x="1" y="0" width="7" height="1" fill="#F0DDB4" />
        <rect x="1" y="1" width="6" height="1" fill="#101126" /><rect x="2" y="1" width="4" height="1" fill="#FFF6E0" />
        <rect x="2" y="2" width="4" height="1" fill="#101126" /><rect x="3" y="2" width="2" height="1" fill="#FFF6E0" />
        <rect x="3" y="3" width="2" height="1" fill="#101126" /><rect x="4" y="4" width="1" height="1" fill="#101126" />
      </svg>
    </div>
  );
}
