'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ac, muteMusic, playMusic, sfx, stopVoices } from '@/lib/audio';
import { INSTRUMENTS, type InstrumentId } from '@/lib/content';
import { mic } from '@/lib/mic';
import { noteName, writtenKey } from '@/lib/music';
import { useGame } from '@/lib/store';
import { defaultRegiment, makeOfflinePlan, TRAINING_BUFF_TIPS } from '@/lib/training-core';
import { TavernRecorder, type TavernClip } from '@/lib/tavern';
import { TrainingClient, TrainingError } from '@/lib/training';
import { performTraining, playTake, previewTraining, speakTraining, type TrainingFrame } from '@/lib/training-audio';
import type { ReviewSummary, TrainingFeedback, TrainingRegiment, TrainingState } from '@/lib/training-types';
import Staff from '../Staff';
import TrainingStage from '../training/TrainingStage';
import './training-screen.css';

type Phase = 'welcome' | 'choose' | 'configure' | 'ready' | 'countin' | 'performing' | 'feedback' | 'complete' | 'paused' | 'claimed' | 'review';
const KEYS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const blankFrame: TrainingFrame = { phase: 'countin', beat: -4, count: 1, results: [], activity: 0, pitch: null };

export default function Training() {
  const username = useGame(s => s.user?.username ?? null);
  const [state, setState] = useState<TrainingState | null>(null);
  const stateRef = useRef<TrainingState | null>(null);
  const [phase, setPhase] = useState<Phase>('welcome');
  const [regiment, setRegiment] = useState<TrainingRegiment>(() => defaultRegiment(useGame.getState().run.instrument));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [frame, setFrame] = useState(blankFrame);
  const [feedback, setFeedback] = useState<TrainingFeedback | null>(null);
  const [voiceToken, setVoiceToken] = useState<string | undefined>();
  const [speaker, setSpeaker] = useState<'castor' | 'pollux' | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [previewAt, setPreviewAt] = useState(0);
  const [rewardAt, setRewardAt] = useState(0);
  const rewardCounter = useRef<HTMLElement | null>(null);
  const [rewardTarget, setRewardTarget] = useState({ x: 240, y: 720 });
  const [now, setNow] = useState(() => Date.now());
  const [enteredAt] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [stopIndex, setStopIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  // Which exercises have a take to play back, mirrored into state so render
  // never reads the clips ref.
  const [recorded, setRecorded] = useState<string[]>([]);
  const client = useRef<TrainingClient | null>(null);
  // Takes are kept only for this session's review; never uploaded or persisted.
  const clips = useRef(new Map<string, TavernClip>());
  const recorder = useRef<TavernRecorder | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const audio = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const serverOffset = useRef(0);
  const expired = useRef(false);
  const resetRetryAt = useRef(0);

  const apply = (next: TrainingState) => {
    stateRef.current = next; setState(next);
    serverOffset.current = username ? next.serverNow - Date.now() : 0;
    useGame.setState(s => ({ trainingBuff: next.pendingBuff, user: s.user ? { ...s.user, trainingBuff: next.pendingBuff } : null }));
  };
  const failure = (err: unknown) => {
    if (lifetime.current?.signal.aborted) return;
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (err instanceof TrainingError && err.state) { apply(err.state); setPhase(!err.state.plan ? 'choose' : err.state.status === 'complete' ? 'complete' : err.state.status === 'paused' ? 'paused' : 'ready'); }
    setError(err instanceof Error ? err.message : 'Practice is unavailable. Please retry.');
  };
  const stopAudio = () => {
    audio.current?.abort(); audio.current = null; stopVoices(); mic.endRecording(); mic.stop();
    muteMusic(false); setSpeaker(null); setPreviewAt(0);
  };
  useEffect(() => {
    const operations = operation;
    const controller = lifetime.current = new AbortController();
    const api = client.current = new TrainingClient(username, controller.signal);
    playMusic('map'); muteMusic(false); stopVoices();
    void api.load(useGame.getState().trainingBuff).then(next => {
      if (controller.signal.aborted) return;
      stateRef.current = next; setState(next); serverOffset.current = username ? next.serverNow - Date.now() : 0;
      useGame.setState(s => ({ trainingBuff: next.pendingBuff, user: s.user ? { ...s.user, trainingBuff: next.pendingBuff } : null }));
      if (next.plan) { setRegiment(next.plan.regiment); setPhase(next.status === 'complete' ? 'complete' : 'paused'); setFeedback(next.finalFeedback ?? null); }
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load practice.'); });
    const clock = setInterval(() => setNow(Date.now()), 50);
    const takes = clips;
    return () => {
      operations.current++;
      controller.abort(); audio.current?.abort(); clearInterval(clock);
      recorder.current?.cancel(); recorder.current = null; takes.current.clear(); setRecorded([]);
      stopVoices(); mic.endRecording(); mic.stop(); muteMusic(false);
    };
  }, [username]);
  useEffect(() => {
    if (!state || now + serverOffset.current < state.resetsAt || expired.current || now < resetRetryAt.current) return;
    expired.current = true; operation.current++; audio.current?.abort(); mic.endRecording(); mic.stop(); muteMusic(false);
    void client.current!.load(useGame.getState().trainingBuff).then(next => {
      if (lifetime.current?.signal.aborted) return;
      stateRef.current = next; setState(next); serverOffset.current = username ? next.serverNow - Date.now() : 0;
      setPhase('choose'); setBusy(false); setSpeaker(null); setPreviewAt(0); setError('A new practice day has begun. Your unused reward and learning history are safe.');
    }).catch(err => { resetRetryAt.current = Date.now() + 5000; if (!lifetime.current?.signal.aborted) setError(err instanceof Error ? err.message : 'Reconnect to load the new practice day.'); }).finally(() => { expired.current = false; });
  }, [now, state, username]);

  useLayoutEffect(() => {
    if (phase !== 'claimed' || !rewardCounter.current) return;
    const rect = rewardCounter.current.getBoundingClientRect();
    const stage = rewardCounter.current.closest('.training-stage')!.getBoundingClientRect();
    setRewardTarget({ x: (rect.x + rect.width / 2 - stage.x) * 1440 / stage.width, y: (rect.y + rect.height / 2 - stage.y) * 900 / stage.height });
  }, [phase]);
  useEffect(() => {
    if (phase !== 'claimed' || !rewardAt) return;
    const impact = setTimeout(() => sfx('coin'), Math.max(0, rewardAt + 900 - Date.now()));
    return () => clearTimeout(impact);
  }, [phase, rewardAt]);

  const inst = INSTRUMENTS.find(i => i.id === (state?.plan?.regiment.instrument ?? regiment.instrument))!;
  const previewPlan = useMemo(() => makeOfflinePlan(regiment, state?.weaknesses, 'practice-preview'), [regiment, state?.weaknesses]);
  const shownPlan = phase === 'configure' ? previewPlan : state?.plan ?? previewPlan;
  const shownIndex = ['countin', 'performing', 'feedback'].includes(phase) ? activeIndex : Math.min(state?.nextIndex ?? 0, 3);
  const exercise = shownPlan.exercises[shownIndex];
  const previewInst = INSTRUMENTS.find(i => i.id === shownPlan.regiment.instrument)!;
  const key = writtenKey(previewInst.writtenOffset, shownPlan.regiment.concertKey, shownPlan.regiment.spelling);
  const concertKey = writtenKey(0, regiment.concertKey, regiment.spelling);
  const hasPlan = Boolean(state?.plan);
  const recording = phase === 'countin' || phase === 'performing';
  const source = shownPlan.source === 'gemini' ? 'GEMINI PRACTICE' : 'OFFLINE PRACTICE';

  const makePlan = async (mode: TrainingRegiment['mode']) => {
    if (!state || busy) return;
    stopAudio(); const op = ++operation.current; setBusy(true); setError('');
    try {
      const next = await client.current!.plan(state, { ...regiment, mode }, Boolean(state.plan));
      if (op !== operation.current || lifetime.current?.signal.aborted) return;
      apply(next); setRegiment(next.plan!.regiment); setPhase('ready'); setFeedback(null);
    } catch (err) { if (op === operation.current) failure(err); }
    finally { if (op === operation.current) setBusy(false); }
  };
  const preview = async () => {
    if (busy) return;
    stopAudio(); setVoiceStatus(''); const controller = audio.current = new AbortController(); setPreviewAt(Date.now());
    try { await previewTraining(exercise.music, previewInst.shift, controller.signal); }
    catch (err) { if (!controller.signal.aborted) failure(err); }
    finally { if (audio.current === controller) { audio.current = null; setPreviewAt(0); } }
  };
  const playFeedback = async (next: TrainingState, final: boolean, token?: string) => {
    audio.current?.abort(); const controller = audio.current = new AbortController();
    setVoiceStatus('');
    for (const twin of ['castor', 'pollux'] as const) {
      if (controller.signal.aborted || lifetime.current?.signal.aborted) break;
      setSpeaker(twin);
      try {
        const played = await speakTraining(client.current!.voiceBody(next, twin, final, token), controller.signal);
        if (!played && !controller.signal.aborted) setVoiceStatus('Voice unavailable · read the twins’ feedback below.');
      } catch { if (!controller.signal.aborted) setVoiceStatus('Voice unavailable · read the twins’ feedback below.'); }
    }
    if (audio.current === controller) setSpeaker(null);
  };
  const perform = async () => {
    const current = stateRef.current;
    if (!current?.plan || busy || current.nextIndex >= 4) return;
    stopAudio(); const op = ++operation.current; setBusy(true); setError(''); setVoiceStatus('');
    const controller = audio.current = new AbortController();
    try {
      ac();
      if (!demo && !(await mic.start())) throw new Error('Allow microphone access to play, or select Demo practice. Use headphones to keep playback out of your mic.');
      if (controller.signal.aborted || op !== operation.current) { mic.stop(); return; }
      const started = await client.current!.begin(current);
      if (controller.signal.aborted || op !== operation.current) return;
      apply(started); setActiveIndex(started.nextIndex); setFrame(blankFrame); setPhase('countin');
      const ex = started.plan!.exercises[started.nextIndex];
      const downbeat = started.activeAttempt!.startAt - serverOffset.current;
      // performTraining works in performance.now(); the recorder needs the same clock.
      recorder.current?.cancel();
      const take = recorder.current = new TavernRecorder();
      take.start(demo ? null : mic.mediaStream, performance.now() + downbeat - Date.now());
      const notes = await performTraining(ex.music, inst.shift, demo, downbeat, controller.signal, next => { setFrame(next); setPhase(next.phase); });
      const clip = await take.stop();
      if (recorder.current === take) recorder.current = null;
      if (clip.audio) { clips.current.set(ex.id, clip); setRecorded(ids => ids.includes(ex.id) ? ids : [...ids, ex.id]); }
      if (op !== operation.current || controller.signal.aborted) return;
      const next = await client.current!.submit(started, { exerciseId: ex.id, attemptId: started.activeAttempt!.id, notes, simulated: demo });
      if (op !== operation.current) return;
      apply(next); const final = next.status === 'complete'; setPhase(final ? 'complete' : 'feedback');
      setFeedback(final ? next.finalFeedback! : next.receipts.at(-1)!.feedback); setVoiceToken(undefined); setBusy(false);
      try {
        const coached = await client.current!.feedback(next, final);
        if (op !== operation.current) return;
        apply(coached.state); setFeedback(coached.feedback); setVoiceToken(coached.voiceToken);
        void playFeedback(coached.state, final, coached.voiceToken);
      } catch { if (op === operation.current) void playFeedback(next, final); }
    } catch (err) { if (op === operation.current) { if (!(err instanceof TrainingError && err.state)) setPhase('ready'); failure(err); } }
    finally { if (op === operation.current) setBusy(false); }
  };
  const pause = async (action: 'pause' | 'resume' | 'end', home = false) => {
    stopAudio(); const op = ++operation.current; setBusy(true); setError('');
    try {
      const current = stateRef.current;
      if (current?.plan) {
        const next = await client.current!.pause(current, action);
        if (op !== operation.current) return;
        apply(next); setPhase(action === 'pause' ? 'paused' : action === 'end' ? 'choose' : next.status === 'complete' ? 'complete' : 'ready');
      }
      if (home && op === operation.current) useGame.getState().go('title', 'iris');
    } catch (err) { if (op === operation.current) failure(err); }
    finally { if (op === operation.current) setBusy(false); }
  };
  const openReview = async () => {
    if (!state?.plan || busy) return;
    stopAudio(); const op = ++operation.current; setBusy(true); setError('');
    try {
      const summary = await client.current!.review(state);
      if (op !== operation.current) return;
      setReview(summary); setStopIndex(0); setPhase('review');
    } catch (err) { if (op === operation.current) failure(err); }
    finally { if (op === operation.current) setBusy(false); }
  };
  /** Walk one stop: hear the bar it went wrong in, land on the note, then the twin explains. */
  const playStop = async (index: number) => {
    const summary = review; const current = stateRef.current;
    if (!summary || !current?.plan) return;
    const stop = summary.stops[index];
    if (!stop) return;
    audio.current?.abort(); const controller = audio.current = new AbortController();
    setStopIndex(index); setReviewing(true); setVoiceStatus('');
    try {
      const music = current.plan.exercises[stop.exerciseIndex].music;
      const beatMs = 60000 / music.tempo;
      const clip = clips.current.get(stop.exerciseId);
      // Two beats of lead-in, then stop on the note itself.
      if (clip) await playTake(clip, Math.max(0, (stop.startBeat - 2) * beatMs), (stop.startBeat + 1) * beatMs, controller.signal);
      if (controller.signal.aborted) return;
      setSpeaker(stop.speaker);
      const played = await speakTraining({ voiceToken: stop.voiceToken, speaker: stop.speaker }, controller.signal);
      if (!played && !controller.signal.aborted) setVoiceStatus('Voice unavailable · read the note below.');
    } catch { if (!controller.signal.aborted) setVoiceStatus('Voice unavailable · read the note below.'); }
    finally { if (audio.current === controller) { setSpeaker(null); setReviewing(false); } }
  };
  const claim = async () => {
    if (!state || busy) return;
    stopAudio(); const op = ++operation.current; setBusy(true); setError('');
    try {
      const next = await client.current!.claim(state);
      if (op !== operation.current) return;
      apply(next); setRewardAt(Date.now()); setPhase('claimed');
    } catch (err) { if (op === operation.current) failure(err); }
    finally { if (op === operation.current) setBusy(false); }
  };
  const change = (patch: Partial<TrainingRegiment>) => { stopAudio(); setRegiment(r => ({ ...r, ...patch })); };
  const changeAccidentals = (n: number) => change({ concertKey: ((n * 7) % 12 + 12) % 12, spelling: n < 0 ? 'flats' : 'sharps' });
  const completeFeedback = feedback ?? state?.finalFeedback;
  const notes = state?.receipts.flatMap(r => r.notes) ?? [];
  const measured = notes.filter(n => n.onsetOffsetMs !== null);
  const stagePhase = recording ? phase : previewAt ? 'preview' : phase === 'claimed' ? 'complete' : phase === 'review' ? 'feedback' : ['choose', 'configure', 'ready'].includes(phase) ? 'configure' : phase;

  return <TrainingStage phase={stagePhase as 'welcome' | 'configure' | 'preview' | 'countin' | 'performing' | 'feedback' | 'complete' | 'paused'} activeMentor={speaker} introElapsed={now - enteredAt} playbackElapsed={previewAt ? now - previewAt : -1} previewNotes={exercise.music.notes.map(n => ({ atMs: 160 + n.startBeat * 60000 / exercise.music.tempo, durationMs: n.durBeats * 60000 / exercise.music.tempo }))} rewardTarget={rewardTarget} rewardElapsed={rewardAt ? now - rewardAt : -1} activity={frame.activity}>
    <header className="training-header"><div><h1>GEMS AND I</h1><p>TRAINING WITH THE DISCO-CURI</p></div><button onClick={() => void pause('end', true)} disabled={busy && !recording}>END TRAINING</button><strong className="training-source">{source}</strong></header>
    {!state && <div className="training-dialog"><h2>{error ? 'PRACTICE IS UNAVAILABLE' : 'THE TWINS ARE GETTING READY…'}</h2><p>{error || 'Preparing today’s practice.'}</p><button onClick={() => useGame.getState().go('title')}>BACK HOME</button></div>}
    {state && phase === 'welcome' && <section className="training-dialog"><div><h2>BEHOLD, THE RENOWNED DISCO-CURI!</h2><p>Grow stronger with us, so that we may<br />strike down the Choir for good!</p></div><button className="training-primary" onClick={() => setPhase('choose')}>LET’S TRAIN →</button></section>}
    {state && phase === 'choose' && <section className="training-choice"><h2>HOW SHALL WE PRACTICE?</h2><p>Face off against the infamous Disco-curi in a friendly training session.</p><div><button disabled={busy} onClick={() => void makePlan('recommended')}><strong>THE TWINS’ PROGRAM</strong><span>Practice built around your recent pitch and timing.</span></button><button disabled={busy} onClick={() => { change({ mode: 'custom' }); setPhase('configure'); }}><strong>CUSTOMIZE MY TRAINING</strong><span>Choose your key, accidentals, pace and focus.</span></button></div><p className="training-small">Offline practice uses built-in musical exercises and measured feedback. No combat, cards or pass mark.</p></section>}
    {state && phase === 'configure' && <section className="training-modal"><h2>BUILD YOUR PRACTICE</h2><p>Three short exercises. One final phrase. Your own pace.</p><div className="training-fields">
      <label>CONCERT KEY<select value={regiment.concertKey} onChange={e => change({ concertKey: Number(e.target.value) })}>{KEYS.map(pc => <option key={pc} value={pc}>{writtenKey(0, pc, regiment.spelling).name} major</option>)}</select></label>
      <label>SHARPS<select value={Math.max(0, concertKey.accidentals)} onChange={e => changeAccidentals(Number(e.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}{n ? ' ♯' : ''}</option>)}</select></label>
      <label>FLATS<select value={Math.max(0, -concertKey.accidentals)} onChange={e => changeAccidentals(-Number(e.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}{n ? ' ♭' : ''}</option>)}</select></label>
      <label>INSTRUMENT<select value={regiment.instrument} onChange={e => change({ instrument: e.target.value as InstrumentId })}>{INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>TEMPO<select value={regiment.tempo} onChange={e => change({ tempo: Number(e.target.value) })}>{[60, 70, 80, 90, 100, 110, 120].map(n => <option key={n} value={n}>{n} BPM</option>)}</select></label>
      <label>FOCUS<select value={regiment.focus} onChange={e => change({ focus: e.target.value as TrainingRegiment['focus'] })}><option value="mixed">Pitch + pulse</option><option value="pitch">Clear pitches</option><option value="rhythm">Steady rhythm</option></select></label>
    </div><p className="training-small">Key and accidentals change together. Written key for {previewInst.name}: {key.name} major.</p><div className="training-preview"><strong>EXAMPLE PHRASE</strong><Staff ex={exercise.music} shift={previewInst.shift} writtenOffset={previewInst.writtenOffset} keySig={key} width={990} beat={previewAt ? (now - previewAt - 160) / (60000 / exercise.music.tempo) : null} results={[]} /></div><div className="training-actions"><button onClick={() => previewAt ? stopAudio() : void preview()}>{previewAt ? 'STOP PREVIEW' : 'HEAR PREVIEW'}</button><button disabled={busy} className="training-primary" onClick={() => void makePlan('custom')}>{busy ? 'PREPARING…' : 'CREATE MY SET →'}</button></div><p className="training-small">Preview uses built-in exercises. The saved set shows its source before you begin.</p></section>}
    {state && phase === 'ready' && <section className="training-modal training-plan"><h2>{shownPlan.regiment.mode === 'recommended' ? 'YOUR RECOMMENDED SET' : 'YOUR PRACTICE SET'}</h2><p>{shownPlan.focusSummary}</p><ol>{shownPlan.exercises.map((ex, i) => <li key={ex.id} className={i === state.nextIndex ? 'current' : ''}><span>{i < state.nextIndex ? '✓' : String(i + 1).padStart(2, '0')}</span><div><strong>{ex.role === 'final' ? 'FINAL PHRASE' : `SHORT EXERCISE ${i + 1}`}</strong><p>{ex.goal}</p></div></li>)}</ol><div className="training-ready-controls"><label>PLAY AS<select value={demo ? 'demo' : 'mic'} onChange={e => setDemo(e.target.value === 'demo')}><option value="mic">Real microphone</option><option value="demo">Demo practice</option></select></label><button disabled={busy} onClick={() => previewAt ? stopAudio() : void preview()}>{previewAt ? 'STOP PREVIEW' : 'HEAR NEXT EXERCISE'}</button><button className="training-primary" disabled={busy} onClick={() => void perform()}>{busy ? 'GETTING READY…' : `PLAY EXERCISE ${state.nextIndex + 1} →`}</button></div><p className="training-small">{inst.name} · written {key.name} major · {shownPlan.regiment.tempo} BPM · Headphones recommended.<br />{demo ? 'DEMO: simulated notes do not update your learning history.' : 'Music and mentor voices are silent while you play.'}</p></section>}
    {state && recording && <><section className="training-sheet"><header><strong>{exercise.role === 'final' ? 'FINAL PHRASE' : `EXERCISE ${activeIndex + 1} / 4`}</strong><span>{demo ? 'DEMO' : 'YOUR TURN'} · {inst.name} · ♩ {exercise.music.tempo}</span></header><h2>{exercise.goal}</h2><Staff ex={exercise.music} shift={inst.shift} writtenOffset={inst.writtenOffset} keySig={key} width={1160} barsPerLine={2} beat={frame.beat} results={frame.results} approach /><footer><span>{phase === 'countin' ? 'GET READY' : 'PLAYING · MUSIC MUTED'}</span><span>{frame.pitch === null ? '—' : noteName(Math.round(frame.pitch) + inst.writtenOffset, key)} · {frame.results.filter(n => n?.status === 'hit').length}/{frame.results.filter(Boolean).length} NOTES</span></footer><div className="training-input-meter"><i style={{ width: `${frame.activity * 100}%` }} /></div></section>{phase === 'countin' && <div className="training-count" key={frame.count}>{frame.count}</div>}<button className="training-pause-action" onClick={() => void pause('pause')}>PAUSE PRACTICE</button></>}
    {state && phase === 'feedback' && feedback && <section className="training-feedback"><h2>ONE STEP STRONGER</h2><p className="training-small">{feedback.source === 'offline' ? 'BUILT-IN COACHING' : 'GEMINI COACHING'} · {state.receipts.at(-1)?.simulated ? 'DEMO RESULTS' : 'MEASURED RESULTS'}</p><Feedback feedback={feedback} speaker={speaker} /><div className="training-actions"><button onClick={() => void playFeedback(state, false, voiceToken)}>REPLAY VOICES</button><button className="training-primary" onClick={() => { stopAudio(); operation.current++; setPhase('ready'); }}>NEXT EXERCISE →</button></div><p className="training-small">{voiceStatus || `${state.receipts.at(-1)!.hits}/${state.receipts.at(-1)!.total} matching notes. There is no pass mark.`}</p></section>}
    {state && phase === 'complete' && <section className="training-feedback training-complete"><h2>YOUR SET IS COMPLETE</h2><p className="training-small">{state.receipts.some(r => r.simulated) ? 'INCLUDES DEMO RESULTS' : 'MEASURED RESULTS'} · {notes.filter(n => n.status === 'hit').length}/{notes.length} matching notes · {measured.length} measured attacks</p>{completeFeedback && <Feedback feedback={completeFeedback} speaker={speaker} />}<div className="training-reward"><div><strong>DAILY TRAINING TIPS · +120</strong><p>{state.claimed ? 'Today’s reward is already claimed.' : state.pendingBuff ? 'Use your banked training reward in a new campaign before claiming this one.' : 'One reward for your next campaign. Tavern tips can be banked separately.'}</p></div><button className="training-primary" disabled={busy || state.claimed || state.pendingBuff} onClick={() => void claim()}>{state.claimed ? 'CLAIMED ✓' : state.pendingBuff ? 'ALREADY BANKED' : 'CLAIM +120 →'}</button></div><div className="training-actions"><button onClick={() => void playFeedback(state, true, voiceToken)}>REPLAY VOICES</button><button disabled={busy} onClick={() => void openReview()}>REVIEW MY MISSES</button><button onClick={() => { stopAudio(); operation.current++; setPhase('choose'); }}>CONTINUE TRAINING</button><button onClick={() => void pause('pause', true)}>HOME</button></div><p className="training-small">Daily resets at 00:00 UTC. Unused rewards remain banked. {voiceStatus}</p></section>}
    {state && phase === 'review' && review && (() => {
      const stop = review.stops[stopIndex];
      const music = stop ? state.plan!.exercises[stop.exerciseIndex].music : null;
      const receipt = stop ? state.receipts.find(r => r.exerciseId === stop.exerciseId) : null;
      const hasClip = stop ? recorded.includes(stop.exerciseId) : false;
      return <section className="training-feedback training-review">
        <h2>{review.stops.length ? 'WHERE IT WENT WRONG' : 'A CLEAN SET'}</h2>
        <ol className="training-review-list">{review.perExercise.map(ex => <li key={ex.exerciseId} className={stop?.exerciseId === ex.exerciseId ? 'current' : ''}><span>{ex.role === 'final' ? 'FINAL' : `EX ${ex.exerciseIndex + 1}`}</span><strong>{ex.hits}/{ex.total}</strong><i>{review.stops.filter(s => s.exerciseId === ex.exerciseId).length || 'no'} to review</i></li>)}</ol>
        {stop && music && <>
          <p className="training-small">STOP {stopIndex + 1} OF {review.stops.length} · {stop.exerciseIndex === 3 ? 'FINAL PHRASE' : `EXERCISE ${stop.exerciseIndex + 1}`} · {stop.reason === 'pitch' ? 'PITCH' : stop.reason === 'timing' ? 'TIMING' : 'NO SOUND'}{hasClip ? '' : ' · NO RECORDING'}</p>
          <Staff ex={music} shift={inst.shift} writtenOffset={inst.writtenOffset} keySig={key} width={1080} barsPerLine={2} beat={stop.startBeat} results={receipt?.notes ?? []} />
          <div className="training-twins-feedback"><article data-twin={stop.speaker} className={speaker === stop.speaker ? 'speaking' : ''}><h3>{stop.speaker === 'castor' ? 'CASTOR · PITCH' : 'POLLUX · PULSE'}</h3><p>{stop.line}</p></article></div>
          <div className="training-actions">
            <button disabled={stopIndex === 0} onClick={() => void playStop(stopIndex - 1)}>← PREVIOUS</button>
            <button onClick={() => void playStop(stopIndex)}>{reviewing ? 'REPLAY' : hasClip ? '▶ HEAR IT' : '▶ EXPLAIN'}</button>
            {stopIndex + 1 < review.stops.length
              ? <button className="training-primary" onClick={() => void playStop(stopIndex + 1)}>NEXT MISS →</button>
              : <button className="training-primary" onClick={() => { stopAudio(); operation.current++; setPhase('complete'); }}>DONE →</button>}
          </div>
        </>}
        {!review.stops.length && <p>Every note matched. There is nothing to walk through — take the reward and keep the streak.</p>}
        <div className="training-actions"><button onClick={() => { stopAudio(); operation.current++; setPhase('complete'); }}>{review.stops.length ? 'SKIP REVIEW' : 'BACK'}</button></div>
        <p className="training-small">{voiceStatus || (hasClip ? 'Playback is your own take from this session.' : 'Recordings are kept only while this practice screen is open.')}</p>
      </section>;
    })()}
    {state && phase === 'claimed' && <section className="training-dialog training-claimed"><div><h2>TRAINING TIPS BANKED</h2><strong ref={rewardCounter}>+{Math.round(Math.min(1, Math.max(0, now - rewardAt - 900) / 600) * TRAINING_BUFF_TIPS)} TIPS</strong><p>{username ? 'Saved to your account.' : 'Ready in this guest session.'} One training bonus, plus one Tavern bonus if earned.</p></div><div><button className="training-primary" onClick={() => { stopAudio(); operation.current++; setPhase('choose'); }}>KEEP TRAINING →</button><button onClick={() => void pause('pause', true)}>BACK HOME</button></div></section>}
    {state && phase === 'paused' && <section className="training-dialog training-paused"><div><h2>TAKE A BREATH</h2><p>{state.nextIndex}/4 exercises finished. Your next exercise restarts from its first note.<br />{username ? 'Progress is saved until the next 00:00 UTC reset.' : 'Guest progress stays in this tab until refresh or the daily reset.'}</p></div><div><button className="training-primary" disabled={busy} onClick={() => void pause('resume')}>RESUME PRACTICE →</button><button disabled={busy} onClick={() => void pause('pause', true)}>{state.claimed ? 'BACK HOME' : 'FINISH TRAINING LATER'}</button></div></section>}
    {state && !recording && !['welcome', 'claimed', 'paused'].includes(phase) && <button className="training-later" disabled={busy} onClick={() => hasPlan ? void pause('pause', true) : useGame.getState().go('title')}>{hasPlan && !state.claimed ? 'FINISH TRAINING LATER' : 'BACK HOME'}</button>}
    {state && error && <div className="training-error" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
  </TrainingStage>;
}

function Feedback({ feedback, speaker }: { feedback: TrainingFeedback; speaker: 'castor' | 'pollux' | null }) {
  return <div className="training-twins-feedback"><article className={speaker === 'castor' ? 'speaking' : ''}><h3>CASTOR · PITCH</h3><p>{feedback.castor}</p></article><article className={speaker === 'pollux' ? 'speaking' : ''}><h3>POLLUX · PULSE</h3><p>{feedback.pollux}</p></article></div>;
}
