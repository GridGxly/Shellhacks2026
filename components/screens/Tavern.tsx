'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ac, clickAt, muteMusic, playMusic, settings, sfx, stopVoices } from '@/lib/audio';
import { RECORD_TAIL_MS, TAVERN_BUFF_TIPS, TAVERN_PASS, TIMING_WINDOW_MS } from '@/lib/config';
import { recordGuestPerformance } from '@/lib/client-performance';
import { INSTRUMENTS, type InstrumentId } from '@/lib/content';
import { grade, mic, simulate, type NoteResult } from '@/lib/mic';
import { useGame } from '@/lib/store';
import { duetDurationMs, duetPart, playDuet, TavernError, TavernRecorder, tavernRequest, useTavernRoom, tavernGuestName, type TavernSeat } from '@/lib/tavern';
import type { PublicTavernRoom, TavernEntry, TavernResultInput } from '@/lib/tavern-types';
import Staff from '../Staff';
import TavernRoom, { type TavernPhase } from '../tavern/TavernRoom';
import { Ornament } from '../ui';
import './tavern-screen.css';

export default function Tavern() {
  const user = useGame((s) => s.user);
  const [instrument, setInstrument] = useState<InstrumentId>(() => useGame.getState().run.instrument);
  const [seat, setSeat] = useState<TavernSeat | null>(null);
  const [phase, setPhase] = useState<TavernPhase>('lobby');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [verdictAt, setVerdictAt] = useState(0);
  const [results, setResults] = useState<(NoteResult | undefined)[]>([]);
  const [activity, setActivity] = useState<[number, number]>([0, 0]);
  const [hadBuff] = useState(() => useGame.getState().tavernBuff);
  const lifetime = useRef<AbortController | null>(null);
  const recording = useRef<TavernRecorder | null>(null);
  const performanceStarted = useRef(false);
  const playbackStarted = useRef(false);
    const returnHome = useCallback(() => {
    lifetime.current?.abort(); recording.current?.cancel(); mic.endRecording(); mic.stop();
    muteMusic(false); useGame.getState().go('title', 'iris');
  }, []);
  const disconnect = useCallback(() => {
    lifetime.current?.abort(); recording.current?.cancel(); mic.endRecording(); mic.stop();
    muteMusic(false); setPhase('disconnected');
  }, []);
  const { room, offset } = useTavernRoom(seat, disconnect);
  const mine = room ? seat?.part === 'A' ? room.host : room.guest : null;
  const partner = room ? seat?.part === 'A' ? room.guest : room.host : null;
  const inst = INSTRUMENTS.find((i) => i.id === (mine?.instrument ?? instrument))!;
  const ex = duetPart(seat?.part ?? 'A');
  const localStart = room?.startAt === undefined ? null : room.startAt - offset;
  const stagePhase = phase === 'hosting' && partner ? 'ready' : phase;
  const elapsed = localStart === null ? -1 : now - localStart;
  const verdictElapsed = verdictAt ? now - verdictAt : -1;
  const pass = room?.pass ?? null;
  const myAccuracy = mine?.result ? mine.result.hits / mine.result.total : undefined;
  const partnerAccuracy = partner?.result ? partner.result.hits / partner.result.total : undefined;

  useEffect(() => {
    const controller = lifetime.current = new AbortController();
    playMusic('tavern'); stopVoices(); muteMusic(false);
    const clock = window.setInterval(() => setNow(Date.now()), 50);
    return () => {
      controller.abort(); window.clearInterval(clock); recording.current?.cancel();
      mic.endRecording(); mic.stop(); muteMusic(false);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'disconnected') return;
    const timer = window.setTimeout(returnHome, 3500);
    return () => window.clearTimeout(timer);
  }, [phase, returnHome]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ['lobby', 'hosting', 'ready'].includes(phase)) returnHome();
      if (event.key === 'Enter' && phase === 'verdict' && Date.now() - verdictAt >= 4000) returnHome();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, verdictAt, returnHome]);

  // The server provides one downbeat. The audio clock, recorder and grader all
  // derive from that instant; polling does not advance a player's performance.
  useEffect(() => {
    if (!room?.startAt || !seat || performanceStarted.current || phase === 'disconnected') return;
    performanceStarted.current = true;
    const controller = lifetime.current!;
    const start = room.startAt - offset;
    const downbeatPerf = performance.now() + start - Date.now();
    const part = duetPart(seat.part);
    const practiceUser = useGame.getState().user?.username ?? null;
    const guestAttempt = crypto.randomUUID();
    const mspb = 60000 / part.tempo;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (at: number, fn: () => void) => timers.push(setTimeout(() => { if (!controller.signal.aborted) fn(); }, Math.max(0, at - Date.now())));
    const begin = setTimeout(() => { setPhase('countdown'); muteMusic(true); stopVoices(); sfx('tick'); }, 0);
    timers.push(begin);
    const count = settings.countIn === 2 ? 2 : 4;
    for (let b = -count; b < 0; b++) {
      const at = start + b * mspb;
      later(at - 100, () => clickAt(ac().currentTime + Math.max(0, at - Date.now()) / 1000, b === -count));
    }
    const simulated = demo ? simulate(part, inst.shift) : null;
    let grading: ReturnType<typeof setInterval> | undefined;
    later(start, () => {
      setPhase('performing'); mic.beginRecording();
      const recorder = recording.current = new TavernRecorder();
      recorder.start(demo ? null : mic.mediaStream, downbeatPerf);
      grading = setInterval(() => {
        if (controller.signal.aborted) return;
        const elapsed = performance.now() - downbeatPerf;
        const live = simulated ?? grade(part, mic.peek(), downbeatPerf, inst.shift, TIMING_WINDOW_MS);
        setResults(live.map((note, i) => elapsed >= (part.notes[i].startBeat + part.notes[i].durBeats) * mspb + 110 ? note : undefined));
      }, 80);
    });
    later(start + duetDurationMs() + RECORD_TAIL_MS, () => {
      clearInterval(grading);
      const final = simulated ?? grade(part, mic.endRecording(), downbeatPerf, inst.shift, TIMING_WINDOW_MS);
      mic.endRecording(); setResults(final); setPhase('uploading');
      void (async () => {
        const clip = await recording.current?.stop() ?? { offsetMs: 0 };
        if (controller.signal.aborted) return;
        mic.stop();
        const hitIndices = final.filter((note) => note.status === 'hit').map((note) => note.index);
        const body: TavernResultInput = { hits: hitIndices.length, total: part.notes.length, hitIndices, notes: final, simulated: !!simulated, ...clip };
        try {
          await tavernRequest<PublicTavernRoom>(`/api/tavern/${seat.code}/result`, body, seat, controller.signal);
          if (!practiceUser && !useGame.getState().user && !controller.signal.aborted) {
            recordGuestPerformance({ source: 'tavern', attemptId: guestAttempt, instrument: inst.id, exercise: part, notes: final, simulated: !!simulated });
          }
          if (!controller.signal.aborted) setPhase((current) => current === 'uploading' ? 'waiting' : current);
        } catch { if (!controller.signal.aborted) disconnect(); }
      })();
    });
    const stop = () => { timers.forEach(clearTimeout); clearInterval(grading); };
    controller.signal.addEventListener('abort', stop, { once: true });
    // startAt is immutable. Cleanup is owned by the lifetime controller so a
    // refined clock sample cannot cancel an already-scheduled recording.
    return () => {};
  }, [room?.startAt, seat, offset, phase, demo, inst.id, inst.shift, disconnect]);

  useEffect(() => {
    if (!seat || !room?.playbackAt || !room.host.result || !room.guest?.result || playbackStarted.current || phase === 'disconnected') return;
    playbackStarted.current = true;
    const controller = lifetime.current!;
    const start = setTimeout(() => {
      if (controller.signal.aborted) return;
      setPhase('duet'); muteMusic(true);
      void playDuet(room, seat, offset, controller.signal, setActivity).then(() => {
        if (controller.signal.aborted) return;
        setVerdictAt(Date.now()); setPhase('verdict'); muteMusic(false);
        sfx(room.pass ? 'stampHit' : 'stampMiss');
        if (room.pass) {
          useGame.setState((state) => ({ tavernBuff: true, user: state.user ? { ...state.user, tavernBuff: true } : null }));
        }
        void tavernRequest(`/api/tavern/${seat.code}/done`, {}, seat, controller.signal).catch(() => {});
      }).catch(() => { if (!controller.signal.aborted) disconnect(); });
    }, 0);
    controller.signal.addEventListener('abort', () => clearTimeout(start), { once: true });
  }, [room, seat, offset, phase, disconnect]);

  const enableMic = async () => {
    if (busy) return;
    ac(); setBusy(true); setError('');
    const ready = await mic.start();
    if (lifetime.current?.signal.aborted) { mic.stop(); return; }
    setMicReady(ready); setDemo(false); setBusy(false);
    if (!ready) setError('Microphone unavailable. Allow access in your browser, or try the demo duet.');
  };
  const enter = async (join: boolean) => {
    if (busy || (!micReady && !demo)) { if (!busy) setError('Enable your microphone or choose demo duet first.'); return; }
    setBusy(true); setError(''); ac();
    try {
      const entry = await tavernRequest<TavernEntry>(join ? `/api/tavern/${code}/join` : '/api/tavern', { instrument, name: tavernGuestName() }, undefined, lifetime.current!.signal);
      if (lifetime.current?.signal.aborted) return;
      setSeat({ code: entry.code, token: entry.token, part: entry.part }); setPhase('hosting'); sfx('drop');
    } catch (err) {
      if (!lifetime.current?.signal.aborted) { setError(err instanceof TavernError ? err.message : 'Could not reach the tavern. Try again.'); sfx('denied'); }
    } finally { setBusy(false); }
  };
  const startShow = async () => {
    if (!seat || busy) return;
    setBusy(true); setError('');
    try { await tavernRequest(`/api/tavern/${seat.code}/start`, {}, seat, lifetime.current!.signal); sfx('click'); }
    catch (err) { setError(err instanceof TavernError ? err.message : 'Could not start the show.'); }
    finally { setBusy(false); }
  };
  const visibleHits = results.filter((note) => note?.status === 'hit').length;
  const visibleCount = results.filter(Boolean).length;
  const count = elapsed < 0 ? Math.ceil(-elapsed / (60000 / ex.tempo)) : 0;
  const sheet = ['countdown', 'performing', 'uploading', 'waiting'].includes(phase);
  const readyToContinue = phase === 'verdict' && verdictElapsed >= 4000;

  return <TavernRoom phase={stagePhase} mine={{ name: mine?.name ?? user?.username ?? 'YOU', instrument: inst.id, accuracy: myAccuracy }} partner={partner ? { name: partner.name, instrument: partner.instrument, accuracy: partnerAccuracy } : null} joined={!!partner} lightElapsed={elapsed === -1 && localStart === null ? -1 : elapsed + 4000} verdictElapsed={verdictElapsed} pass={pass} activity={activity}>
    {phase === 'lobby' && <>
      <header className="tavern-heading"><h1>TAVERN MODE</h1><Ornament /><p>Two musicians. One stage. A little courage for the climb.</p></header>
      <div className="tavern-lobby-cards">
        <section className="tavern-board"><span className="tavern-board-number">01</span><h2>HOST A SHOW</h2><p>Take the stage and invite one friend with a four-character code.</p><button className="tavern-action" disabled={busy || (!micReady && !demo)} onClick={() => void enter(false)}>HOST SHOW →</button></section>
        <section className="tavern-board"><span className="tavern-board-number">02</span><h2>JOIN A SHOW</h2><label htmlFor="tavern-code">YOUR FRIEND’S CODE</label><input id="tavern-code" aria-label="Tavern code" autoComplete="off" maxLength={4} value={code} placeholder="ABCD" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && code.length === 4) void enter(true); }} /><button className="tavern-action" disabled={busy || code.length !== 4 || (!micReady && !demo)} onClick={() => void enter(true)}>JOIN SHOW →</button></section>
      </div>
      <div className="tavern-setup"><label>YOUR INSTRUMENT <select aria-label="Your tavern instrument" value={instrument} onChange={(e) => setInstrument(e.target.value as InstrumentId)}>{INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.keyLabel}</option>)}</select></label><button className="tavern-outline" disabled={busy} onClick={() => void enableMic()}>{micReady ? '✓ MICROPHONE READY' : 'ENABLE MICROPHONE'}</button><button className={`tavern-outline${demo ? ' selected' : ''}`} disabled={busy} onClick={() => { mic.stop(); setMicReady(false); setDemo(true); setError(''); ac(); }}>DEMO DUET</button></div>
      <p className="tavern-note">HEADPHONES RECOMMENDED · You hear your partner only during the final replay.<br />{demo ? 'DEMO: notes are simulated; the replay uses instruments.' : 'Guests welcome. Recordings disappear after the show.'}</p>
    </>}
    {(stagePhase === 'hosting' || stagePhase === 'ready') && <>
      <section className="tavern-room-code"><span className="f-label">{seat?.part === 'A' ? 'INVITE YOUR DUET PARTNER' : `${room?.host.name ?? 'YOUR HOST'}’S SHOW`}</span><strong>{seat?.code}</strong><button className="tavern-outline" onClick={() => { void navigator.clipboard.writeText(seat!.code).then(() => setCopied(true)).catch(() => setError('Copy the four-character code shown above.')); }}>{copied ? 'COPIED ✓' : 'COPY CODE'}</button></section>
      <section className="tavern-bottom-status"><h2>{!partner ? 'WAITING FOR YOUR PARTNER…' : seat?.part === 'A' ? 'THE STAGE IS YOURS' : 'WAITING FOR THE HOST…'}</h2><p>{!partner ? 'Share the code. Your friend can join as a guest.' : `You play Part ${seat?.part} · ${seat?.part === 'A' ? 'Melody' : 'Harmony'} · four bars together.`}</p>{partner && seat?.part === 'A' && <button className="tavern-action" disabled={busy} onClick={() => void startShow()}>START SHOW →</button>}</section>
    </>}
    {sheet && <>
      <section className="tavern-sheet"><header><strong>DUET · PART {seat?.part} <span>{seat?.part === 'A' ? 'MELODY' : 'HARMONY'}</span></strong><span>♩ = {ex.tempo} · {inst.name}{demo ? ' · DEMO' : ''}</span></header><Staff ex={ex} shift={inst.shift} writtenOffset={inst.writtenOffset} width={1080} beat={phase === 'countdown' || phase === 'performing' ? elapsed / (60000 / ex.tempo) : null} results={results} /><footer><strong>{phase === 'countdown' ? 'GET READY' : phase === 'performing' ? 'RECORDING' : phase === 'uploading' ? 'SENDING YOUR TAKE…' : 'WAITING FOR YOUR PARTNER…'}</strong><span>{visibleCount ? `${Math.round(visibleHits / visibleCount * 100)}% · ${visibleHits}/${visibleCount} NOTES` : 'PLAY ON THE NEXT 1'}</span></footer></section>
      {phase === 'countdown' && count > 0 && count <= settings.countIn && <div key={count} className="tavern-count">{settings.countIn - count + 1}</div>}
      <div className="tavern-partner-status"><div className="f-label">{partner?.result ? 'PARTNER FINISHED ✓' : 'PARTNER PLAYING'}</div><div className="tavern-progress"><i style={{ width: `${Math.max(0, Math.min(1, elapsed / duetDurationMs())) * 100}%` }} /></div><p>{phase === 'performing' ? 'Your microphones stay separate.' : 'Both takes are needed for the replay.'}</p></div>
    </>}
    {phase === 'duet' && <>
      <header className="tavern-heading"><h1>LISTEN TO YOUR DUET</h1><Ornament /><p>Two parts. One performance.</p></header><section className="tavern-playback"><div className="f-label">{room?.host.result?.hasAudio && room.guest?.result?.hasAudio ? 'YOUR RECORDED PERFORMANCE' : 'INSTRUMENT REPLAY FOR UNAVAILABLE TAKES'}</div><div className="tavern-progress"><i style={{ width: `${Math.max(0, Math.min(1, (now - ((room?.playbackAt ?? now) - offset)) / duetDurationMs())) * 100}%` }} /></div></section>
    </>}
    {phase === 'verdict' && <>
      <header className="tavern-heading tavern-verdict"><h1 style={{ color: pass ? 'var(--sun)' : '#FF8A93' }}>{pass ? 'ENCORE!' : 'BOOED OFF!'}</h1><Ornament /><p>{pass ? 'The house loved your duet.' : 'A tough crowd. A fresh stage awaits.'} Combined accuracy: {Math.round(((mine?.result?.hits ?? 0) + (partner?.result?.hits ?? 0)) / ((mine?.result?.total ?? 0) + (partner?.result?.total ?? 0) || 1) * 100)}% · Need {TAVERN_PASS * 100}%</p></header>
      {pass && <div className="tavern-tip-award"><strong>+{TAVERN_BUFF_TIPS} TIPS · NEXT CLIMB</strong><span>{hadBuff ? 'Your reward is already waiting. Tavern buffs never stack.' : user ? 'Saved to your account. Used once when you start a new climb.' : 'Ready for your next climb in this session.'}</span>{[0, 1, 2, 3, 4].map((i) => <i key={i} className="tavern-tip-coin" style={{ animationDelay: `${1200 + i * 100}ms`, left: -240 + i * 230 }}>●</i>)}</div>}
      {readyToContinue && <button className="tavern-action tavern-continue" onClick={returnHome}>CONTINUE →</button>}
    </>}
    {phase === 'disconnected' && <div className="tavern-disconnected"><h1>SHOW DISCONNECTED</h1><Ornament /><p>Your partner left, or the tavern lost its connection.<br />This show can’t be resumed. Returning home…</p><button className="tavern-action" onClick={returnHome}>BACK HOME →</button></div>}
    {error && <div key={error} className="tavern-error" role="alert">{error}</div>}
    {['lobby', 'hosting', 'ready'].includes(stagePhase) && <button className="tavern-leave" onClick={returnHome}>ESC · LEAVE TAVERN</button>}
  </TavernRoom>;
}
