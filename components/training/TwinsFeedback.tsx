import type { TrainingFeedback } from '@/lib/training-types';

export default function TwinsFeedback({ feedback, speaker }: { feedback: TrainingFeedback; speaker: 'castor' | 'pollux' | null }) {
  return <div className="training-twins-feedback">
    <article className={speaker === 'castor' ? 'speaking' : ''}><h3>CASTOR · PITCH</h3><p>{feedback.castor}</p></article>
    <article className={speaker === 'pollux' ? 'speaking' : ''}><h3>POLLUX · PULSE</h3><p>{feedback.pollux}</p></article>
  </div>;
}
