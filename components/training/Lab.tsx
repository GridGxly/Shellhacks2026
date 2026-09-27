'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ac, muteMusic, playMusic, sfx, stopVoices, settings } from '@/lib/audio';
import { INSTRUMENTS } from '@/lib/content';
import { PERFECT_MS } from '@/lib/config';
import { mic, type NoteResult } from '@/lib/mic';
import { noteName, writtenKey } from '@/lib/music';
import { useGame } from '@/lib/store';
import { TavernRecorder, type TavernClip } from '@/lib/tavern';
import {
  analyzeTake, buildCards, clampLabSettings, composeOffline, defaultLabSettings, gradeLetter, hintFor, keyIndex, keyLabel,
  LAB_DIFFS, LAB_FOCI, LAB_KEYS, LAB_STYLES, suggestedNext,
  type LabCard, type LabChatTurn, type LabSettings,
} from '@/lib/lab';
import { performTraining, playTake, previewTraining, speakTraining, type TrainingFrame } from '@/lib/training-audio';
import type { TrainingFeedback } from '@/lib/training-types';
import Staff from '../Staff';
import TrainingStage from './TrainingStage';
import TwinsFeedback from './TwinsFeedback';
import '../screens/training-screen.css';

type Phase = 'compose' | 'cards' | 'countin' | 'performing' | 'feedback' | 'review';
const blank: TrainingFrame = { phase: 'countin', beat: -4, count: 1, results: [], activity: 0, pitch: null };
const toPerfClock = (epochMs: number) => performance.now() + epochMs - Date.now();
const wall = () => Date.now();

type Miss = { index: number; startBeat: number; speaker: 'castor' | 'pollux'; line: string };

export default function Lab({ onBack }: { onBack: () => void }) {
  const inst = INSTRUMENTS.find(i => i.id === useGame.getState().run.instrument) ?? INSTRUMENTS[0];
  const [phase, setPhase] = useState<Phase>('compose');
  const [settingsLab, setSettingsLab] = useState<LabSettings>(defaultLabSettings);
  const [focus, setFocus] = useState<keyof LabSettings>('tempo');
  const [history, setHistory] = useState<LabChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [said, setSaid] = useState('something sad and slow in D, lots of dotted rhythms, like a folk song');
  const [speaker, setSpeaker] = useState<'castor' | 'pollux' | null>('pollux');
  const [line, setLine] = useState('Folk in D, slow, dotted. I will keep the pulse honest. Compose it, or change a chip.');
  const [cards, setCards] = useState<LabCard[]>([]);
  const [cardId, setCardId] = useState('');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState(blank);
  const [previewAt, setPreviewAt] = useState(0);
  const [now, setNow] = useState(wall);
  const [feedback, setFeedback] = useState<TrainingFeedback | null>(null);
  const [voiceToken, setVoiceToken] = useState<string>();
  const [detail, setDetail] = useState<string[]>([]);
  const [grade, setGrade] = useState<'S' | 'A' | 'B' | 'C' | 'D'>('C');
  const [nextId, setNextId] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteResult[]>([]);
  const [clip, setClip] = useState<TavernClip | null>(null);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [missIndex, setMissIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [playBeat, setPlayBeat] = useState<number | null>(null);
  const audio = useRef<AbortController | null>(null);
  const recorder = useRef<TavernRecorder | null>(null);
  const op = useRef(0);

  const card = cards.find(c => c.id === cardId) ?? cards[0];
  const key = writtenKey(inst.writtenOffset, settingsLab.tonic, settingsLab.spelling);
  const recording = phase === 'countin' || phase === 'performing';

  const stopAudio = () => {
    audio.current?.abort(); audio.current = null; stopVoices(); mic.endRecording(); mic.stop();
    muteMusic(false); recorder.current?.cancel(); recorder.current = null; setPreviewAt(0); setPlayBeat(null);
  };

  useEffect(() => {
    playMusic('map'); muteMusic(false);
    const operations = op;
    const voice = audio;
    const take = recorder;
    return () => {
      operations.current++;
      voice.current?.abort(); voice.current = null;
      take.current?.cancel(); take.current = null;
      stopVoices(); mic.endRecording(); mic.stop(); muteMusic(false);
    };
  }, []);
  useEffect(() => {
    const animated = previewAt > 0 || recording;
    const timer = setTimeout(() => setNow(wall()), animated ? 50 : 1000);
    return () => clearTimeout(timer);
  }, [previewAt, recording, now]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy || recording) return;
      sfx('back');
      if (phase === 'compose') onBack();
      else { stopAudio(); setPhase('compose'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hold = (text: string, signal: AbortSignal) => new Promise<void>((done) => {
    const timer = setTimeout(done, Math.min(7000, Math.max(2600, text.length * 55)));
    signal.addEventListener('abort', () => { clearTimeout(timer); done(); }, { once: true });
  });

  const speakLines = async (replies: { speaker: 'castor' | 'pollux'; line: string }[], tokens?: { castor?: string; pollux?: string }) => {
    const controller = audio.current = new AbortController();
    for (const reply of replies) {
      if (controller.signal.aborted) return;
      setSpeaker(reply.speaker); setLine(reply.line);
      const token = tokens?.[reply.speaker];
      const played = token ? await speakTraining({ voiceToken: token, speaker: reply.speaker }, controller.signal).catch(() => false) : false;
      if (!played) await hold(reply.line, controller.signal);
    }
    if (audio.current === controller) setSpeaker(null);
  };

  const send = async (text = draft.trim()) => {
    if (!text || busy) return;
    stopAudio(); const turn = ++op.current; setBusy(true); setError(''); setDraft('');
    const nextHistory = [...history, { from: 'player' as const, text }].slice(-12);
    setHistory(nextHistory); setSaid(text);
    try {
      const response = await fetch('/api/training/lab/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: nextHistory, current: settingsLab }),
      });
      const data = await response.json() as { replies?: { speaker: 'castor' | 'pollux'; line: string }[]; proposal?: LabSettings; voiceTokens?: { castor?: string; pollux?: string }; error?: string };
      if (turn !== op.current) return;
      if (!response.ok) throw new Error(data.error || 'The twins could not hear that.');
      if (data.proposal) setSettingsLab(clampLabSettings(data.proposal));
      const replies = data.replies?.length ? data.replies : [{ speaker: 'pollux' as const, line: 'Say that again a little simpler.' }];
      setHistory(h => [...h, ...replies.map(r => ({ from: r.speaker, text: r.line }))].slice(-12));
      void speakLines(replies, data.voiceTokens);
    } catch (err) { if (turn === op.current) setError(err instanceof Error ? err.message : 'The twins could not hear that.'); }
    finally { if (turn === op.current) setBusy(false); }
  };

  const compose = async () => {
    if (busy) return;
    stopAudio(); const turn = ++op.current; setBusy(true); setError('');
    try {
      const response = await fetch('/api/training/lab/compose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsLab }),
      });
      const data = await response.json() as { exercise?: ReturnType<typeof composeOffline>; error?: string };
      if (turn !== op.current) return;
      const exercise = data.exercise ?? composeOffline(settingsLab);
      const next = buildCards(exercise);
      if (!next.length) throw new Error(data.error || 'That piece could not be turned into cards.');
      setCards(next); setCardId(next[0].id); setPhase('cards');
      setSpeaker('castor'); setLine('Bar one first. Slow it until the dotted quarters sit.');
    } catch (err) { if (turn === op.current) setError(err instanceof Error ? err.message : 'Could not compose.'); }
    finally { if (turn === op.current) setBusy(false); }
  };

  const preview = async () => {
    if (!card || busy) return;
    stopAudio(); const controller = audio.current = new AbortController(); setPreviewAt(wall());
    try { await previewTraining(card.ex, inst.shift, controller.signal); }
    catch { /* leaving the card stops the preview */ }
    finally { if (audio.current === controller) { audio.current = null; setPreviewAt(0); } }
  };

  const play = async () => {
    if (!card || busy) return;
    stopAudio(); const turn = ++op.current; setBusy(true); setError(''); setFrame(blank);
    const controller = audio.current = new AbortController();
    try {
      ac();
      if (!demo && !(await mic.start())) throw new Error('Allow microphone access to play, or select Demo practice.');
      if (controller.signal.aborted || turn !== op.current) { mic.stop(); return; }
      const countBeats = settings.countIn === 2 ? 2 : 4;
      const downbeat = wall() + 250 + countBeats * 60000 / card.ex.tempo;
      recorder.current?.cancel();
      const take = recorder.current = new TavernRecorder();
      take.start(demo ? null : mic.mediaStream, toPerfClock(downbeat));
      setPhase('countin');
      const result = await performTraining(card.ex, inst.shift, demo, downbeat, controller.signal, next => { setFrame(next); setPhase(next.phase); }, take);
      const recorded = await take.stop();
      if (recorder.current === take) recorder.current = null;
      if (turn !== op.current || controller.signal.aborted) return;
      setNotes(result); setClip(recorded.audio ? recorded : null);
      setGrade(gradeLetter(result)); setDetail(analyzeTake(card.ex, result, inst, settingsLab.tonic, settingsLab.spelling));
      setNextId(suggestedNext(cards, card.id, result));
      const fallback: TrainingFeedback = { source: 'offline', castor: detailLine(result, 'castor'), pollux: detailLine(result, 'pollux') };
      setFeedback(fallback); setVoiceToken(undefined); setPhase('feedback'); setBusy(false);
      try {
        const coached = await fetch('/api/training/feedback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exercise: card.ex, notes: result, instrument: inst.id, final: false }),
        });
        const data = await coached.json() as { feedback?: TrainingFeedback; voiceToken?: string };
        if (turn !== op.current) return;
        if (data.feedback) { setFeedback(data.feedback); setVoiceToken(data.voiceToken); void playFeedback(data.feedback, data.voiceToken); }
        else void playFeedback(fallback);
      } catch { if (turn === op.current) void playFeedback(fallback); }
    } catch (err) {
      if (turn === op.current) { setPhase('cards'); setError(err instanceof Error ? err.message : 'Could not start the take.'); }
    } finally { if (turn === op.current) setBusy(false); }
  };

  const playFeedback = async (next: TrainingFeedback, token?: string) => {
    audio.current?.abort(); const controller = audio.current = new AbortController();
    for (const twin of ['castor', 'pollux'] as const) {
      if (controller.signal.aborted) break;
      setSpeaker(twin); setLine(next[twin]);
      const played = await speakTraining(token ? { voiceToken: token, speaker: twin } : { speaker: twin }, controller.signal).catch(() => false);
      if (!played) await hold(next[twin], controller.signal);
    }
    if (audio.current === controller) setSpeaker(null);
  };

  const openReview = () => {
    if (!card) return;
    stopAudio();
    const list: Miss[] = notes.flatMap((n, i) => {
      const bad = n.status === 'wrong' || n.status === 'silent' || (n.onsetOffsetMs !== null && Math.abs(n.onsetOffsetMs) > PERFECT_MS);
      if (!bad) return [];
      const speaker = n.status === 'wrong' || n.status === 'silent' ? 'castor' as const : 'pollux' as const;
      const line = n.status === 'silent' ? 'No sound on this one. Breathe, then speak it.' : n.status === 'wrong' ? 'That pitch wandered. Hear it, then play it alone.' : (n.onsetOffsetMs ?? 0) > 0 ? 'Late. Wait for the beat, then tongue it.' : 'Early. Let the beat arrive.';
      return [{ index: i, startBeat: card.ex.notes[i].startBeat, speaker, line }];
    });
    setMisses(list); setMissIndex(0); setPhase('review');
    if (list[0]) void playMiss(list, 0);
  };

  const playMiss = async (list: Miss[], index: number) => {
    if (!card) return;
    const miss = list[index]; if (!miss) return;
    audio.current?.abort(); const controller = audio.current = new AbortController();
    setMissIndex(index); setReviewing(true); setSpeaker(miss.speaker); setLine(miss.line);
    const beatMs = 60000 / card.ex.tempo;
    try {
      if (clip) await playTake(clip, Math.max(0, (miss.startBeat - 2) * beatMs), (miss.startBeat + 1) * beatMs, controller.signal, ms => setPlayBeat(ms / beatMs));
      else setPlayBeat(miss.startBeat);
      if (controller.signal.aborted) return;
      await speakTraining(voiceToken ? { voiceToken, speaker: miss.speaker } : { speaker: miss.speaker }, controller.signal).catch(() => false);
      if (controller.signal.aborted) return;
      await hold(miss.line, controller.signal);
    } finally { if (audio.current === controller) { setSpeaker(null); setReviewing(false); } }
  };

  const cycle = <T,>(list: readonly T[], value: T, dir: 1 | -1) => list[(list.indexOf(value) + dir + list.length) % list.length];
  const patch = (next: Partial<LabSettings>) => setSettingsLab(s => clampLabSettings({ ...s, ...next }));
  const stagePhase = recording ? phase : previewAt ? 'preview' : phase === 'review' ? 'feedback' : phase === 'cards' || phase === 'compose' ? 'configure' : phase === 'feedback' ? 'feedback' : 'configure';

  return <TrainingStage phase={stagePhase} activeMentor={speaker} line={line} playbackElapsed={previewAt ? now - previewAt : -1} previewNotes={card ? card.ex.notes.map(n => ({ atMs: 160 + n.startBeat * 60000 / card.ex.tempo, durationMs: n.durBeats * 60000 / card.ex.tempo })) : []} activity={frame.activity}>
    <header className="training-header"><div><h1>GEMS AND I</h1><p>TRAINING WITH THE DIOSCURI</p></div><button onClick={() => { stopAudio(); if (phase === 'compose') onBack(); else setPhase('compose'); }} disabled={busy && !recording}><kbd>ESC</kbd>BACK</button></header>

    {phase === 'compose' && <section className="training-lab">
      <div className="training-lab-kicker">COMPOSE</div>
      <h2>TELL US THE SONG</h2>
      <div className="training-lab-said"><span>YOU SAID</span><p>{said}</p></div>
      <p className="training-lab-label">THEIR PROPOSAL</p>
      <div className="training-lab-row">
        <Chip label="KEY" active={focus === 'tonic'} onFocus={() => setFocus('tonic')}>
          <button type="button" onClick={() => patch(LAB_KEYS[(keyIndex(settingsLab) + LAB_KEYS.length - 1) % LAB_KEYS.length])}>−</button>
          <b>{keyLabel(settingsLab)}</b>
          <button type="button" onClick={() => patch(LAB_KEYS[(keyIndex(settingsLab) + 1) % LAB_KEYS.length])}>+</button>
        </Chip>
        <Chip label="BPM" active={focus === 'tempo'} onFocus={() => setFocus('tempo')}>
          <button type="button" onClick={() => patch({ tempo: settingsLab.tempo - 4 })}>−</button>
          <b>{settingsLab.tempo}</b>
          <button type="button" onClick={() => patch({ tempo: settingsLab.tempo + 4 })}>+</button>
        </Chip>
        <Chip label="TIME" active={focus === 'beatsPerBar'} onFocus={() => setFocus('beatsPerBar')}>
          <button type="button" data-on={settingsLab.beatsPerBar === 3} onClick={() => patch({ beatsPerBar: 3 })}>3/4</button>
          <button type="button" data-on={settingsLab.beatsPerBar === 4} onClick={() => patch({ beatsPerBar: 4 })}>4/4</button>
        </Chip>
      </div>
      <div className="training-lab-row">
        <Chip label="BARS" active={focus === 'bars'} onFocus={() => setFocus('bars')}>
          <button type="button" onClick={() => patch({ bars: 4 })}>−</button>
          <b>{settingsLab.bars}</b>
          <button type="button" onClick={() => patch({ bars: 8 })}>+</button>
        </Chip>
        <Chip label="DIFF" active={focus === 'difficulty'} onFocus={() => setFocus('difficulty')}><b onClick={() => patch({ difficulty: cycle(LAB_DIFFS, settingsLab.difficulty, 1) })}>{settingsLab.difficulty.toUpperCase()}</b></Chip>
        <Chip label="STYLE" active={focus === 'style'} onFocus={() => setFocus('style')}><b onClick={() => patch({ style: cycle(LAB_STYLES, settingsLab.style, 1) })}>{settingsLab.style.toUpperCase()}</b></Chip>
        <Chip label="FOCUS" active={focus === 'focus'} onFocus={() => setFocus('focus')}><b onClick={() => patch({ focus: cycle(LAB_FOCI, settingsLab.focus, 1) })}>{settingsLab.focus.toUpperCase()}</b></Chip>
      </div>
      <p className="training-small">{hintFor(focus, settingsLab)}</p>
      <button className="training-primary" disabled={busy} onClick={() => void compose()}>{busy ? 'WRITING…' : 'COMPOSE IT →'}</button>
      <form className="training-lab-compose" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input value={draft} maxLength={280} placeholder="faster, no accidentals…" onChange={e => setDraft(e.target.value)} />
        <button type="submit" disabled={busy || !draft.trim()}>SEND</button>
      </form>
    </section>}

    {phase === 'cards' && card && <section className="training-lab">
      <div className="training-lab-kicker training-lab-kicker-sun">THE PIECE</div>
      <h2>THE CARDS</h2>
      <p className="training-lab-label">{keyLabel(settingsLab)} · {settingsLab.tempo} BPM · {settingsLab.bars} BARS · {settingsLab.style.toUpperCase()}</p>
      <ol className="training-lab-cards">
        {cards.map((c, i) => <li key={c.id}><button type="button" data-on={c.id === card.id} onClick={() => { stopAudio(); setCardId(c.id); }}><i>{i + 1}</i><strong>{c.title}</strong><em>{c.tag}</em></button></li>)}
      </ol>
      <div className="training-lab-staff"><span>BAR · {card.title}</span><Staff ex={card.ex} shift={inst.shift} writtenOffset={inst.writtenOffset} keySig={key} width={640} beat={previewAt ? (now - previewAt - 160) / (60000 / card.ex.tempo) : null} results={[]} /></div>
      <div className="training-lab-playas"><span>PLAY AS</span><button type="button" data-on={!demo} onClick={() => setDemo(false)}>MIC</button><button type="button" data-on={demo} onClick={() => setDemo(true)}>DEMO</button></div>
      <div className="training-actions">
        <button disabled={busy} onClick={() => previewAt ? stopAudio() : void preview()}>{previewAt ? 'STOP' : 'HEAR IT'}</button>
        <button className="training-primary" disabled={busy} onClick={() => void play()}>PLAY</button>
        <button disabled>REVIEW</button>
      </div>
    </section>}

    {recording && card && <>
      <section className="training-sheet">
        <header><strong>{card.title}</strong><span>{demo ? 'DEMO' : 'YOUR TURN'} · {inst.name} · ♩ {card.ex.tempo}</span></header>
        <h2>{card.tag === 'FULL' ? 'The whole piece.' : 'Play this card into the mic.'}</h2>
        <Staff ex={card.ex} shift={inst.shift} writtenOffset={inst.writtenOffset} keySig={key} width={1160} barsPerLine={2} beat={frame.beat} results={frame.results} approach />
        <footer><span>{phase === 'countin' ? 'GET READY' : 'PLAYING · MUSIC MUTED'}</span><span>{frame.pitch === null ? '—' : noteName(Math.round(frame.pitch) + inst.writtenOffset, key)}</span></footer>
        <div className="training-input-meter"><i style={{ width: `${frame.activity * 100}%` }} /></div>
      </section>
      {phase === 'countin' && <div className="training-count" key={frame.count}>{frame.count}</div>}
    </>}

    {phase === 'feedback' && feedback && card && <section className="training-feedback">
      <h2>GRADE {grade}</h2>
      <p className="training-small">{feedback.source === 'offline' ? 'BUILT-IN COACHING' : 'GEMINI COACHING'} · {demo ? 'DEMO RESULTS' : 'MEASURED RESULTS'}</p>
      <TwinsFeedback feedback={feedback} speaker={speaker} />
      <div className="training-lab-detail"><span>IN DETAIL</span>{detail.map(line => <p key={line}>{line}</p>)}</div>
      <div className="training-actions">
        <button onClick={() => feedback && void playFeedback(feedback, voiceToken)}>REPLAY VOICES</button>
        <button onClick={openReview}>REVIEW</button>
        {nextId && <button className="training-primary" onClick={() => { stopAudio(); setCardId(nextId); setPhase('cards'); }}>NEXT CARD →</button>}
      </div>
    </section>}

    {phase === 'review' && card && <section className="training-feedback training-review">
      <h2>{misses.length ? 'WHERE IT WENT WRONG' : 'A CLEAN TAKE'}</h2>
      {misses[missIndex] && <>
        <p className="training-small">STOP {missIndex + 1} OF {misses.length} · {misses[missIndex].speaker === 'castor' ? 'PITCH' : 'TIMING'}{clip ? '' : ' · NO RECORDING'}</p>
        <Staff ex={card.ex} shift={inst.shift} writtenOffset={inst.writtenOffset} keySig={key} width={680} barsPerLine={2} beat={playBeat ?? misses[missIndex].startBeat} results={notes} />
        <div className="training-twins-feedback"><article data-twin={misses[missIndex].speaker} className={speaker === misses[missIndex].speaker ? 'speaking' : ''}><h3>{misses[missIndex].speaker === 'castor' ? 'CASTOR · PITCH' : 'POLLUX · PULSE'}</h3><p>{misses[missIndex].line}</p></article></div>
        <div className="training-actions">
          <button disabled={missIndex === 0} onClick={() => void playMiss(misses, missIndex - 1)}>← PREVIOUS</button>
          <button onClick={() => void playMiss(misses, missIndex)}>{reviewing ? 'REPLAY' : clip ? '▶ HEAR IT' : '▶ EXPLAIN'}</button>
          {missIndex + 1 < misses.length
            ? <button className="training-primary" onClick={() => void playMiss(misses, missIndex + 1)}>NEXT MISS →</button>
            : <button className="training-primary" onClick={() => { stopAudio(); setPhase('cards'); }}>DONE →</button>}
        </div>
      </>}
      {!misses.length && <p>Every note matched. Take the next card.</p>}
      <div className="training-actions"><button onClick={() => { stopAudio(); setPhase('cards'); }}>{misses.length ? 'SKIP REVIEW' : 'BACK'}</button></div>
    </section>}

    {error && <div className="training-error" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
  </TrainingStage>;
}

function Chip({ label, active, onFocus, children }: { label: string; active: boolean; onFocus: () => void; children: ReactNode }) {
  return <div className="training-lab-chip" data-on={active} onClick={onFocus}>{label}<div className="training-lab-value">{children}</div></div>;
}

function detailLine(notes: NoteResult[], who: 'castor' | 'pollux') {
  const hits = notes.filter(n => n.status === 'hit').length;
  if (who === 'castor') return hits === notes.length ? 'Every pitch sat. Keep that colour on the next card.' : 'One pitch wandered. Hear it once, then play that note alone.';
  const late = notes.filter(n => (n.onsetOffsetMs ?? 0) > PERFECT_MS).length;
  return late ? 'The pulse sat late. Wait, then tongue it.' : 'The pulse held. Do it again a little bolder.';
}
