/* A constrained explanation layer, not a general-purpose chat. The server
 * receives only the selected observation's existing collocation facts. */

import { useState } from 'react';
import { apiPost } from '@/data/api/client';
import { useAnalysisStore } from '@/state/analysisStore';
import { EmptyState, ErrorState, LoadingState, UnavailableNote } from '@/ui/states/StatusStates';
import styles from './BriefingPanel.module.css';

interface BriefingResponse {
  readonly observation_id: string;
  readonly variable: string;
  readonly briefing: string;
  readonly generated_by: string;
  readonly historical_window_label: string;
}

const QUESTIONS = [
  'What does the model-observation agreement show?',
  'What should I be cautious about in this evidence?',
  'Summarise this selected observation in plain language.',
] as const;

export function BriefingPanel({ observationId }: { observationId: string | null }) {
  const variable = useAnalysisStore((s) => s.variable);
  const [answer, setAnswer] = useState<BriefingResponse | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!observationId) {
    return <EmptyState label="Select an observation to create a briefing" detail="Choose a real Argo marker or record first." />;
  }
  if (variable !== 'temperature' && variable !== 'salinity') {
    return (
      <UnavailableNote reason="This briefing is grounded in observed-versus-modelled collocation. This Argo cache has that evidence only for temperature and salinity.">
        <EmptyState label="No evidence briefing for this variable" detail="Switch to sea-water temperature or salinity." />
      </UnavailableNote>
    );
  }

  async function ask(nextQuestion: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<BriefingResponse>(
        `/api/v1/briefing/${encodeURIComponent(observationId!)}`,
        { variable, question: nextQuestion },
      );
      setAnswer(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.wrap} aria-label="Evidence briefing">
      <div className={styles.hero}>
        <span className={styles.eyebrow}>AI-ASSISTED EVIDENCE BRIEFING</span>
        <h2 className={styles.title}>Explain this selected record</h2>
        <p className={styles.intro}>
          Grounded only in this cached Argo–HYCOM comparison. It cannot browse, forecast, or replace the source evidence.
        </p>
      </div>
      <div className={styles.questions}>
        {QUESTIONS.map((item) => <button key={item} type="button" className={styles.chip} onClick={() => ask(item)} disabled={loading}>{item}</button>)}
      </div>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (question.trim()) ask(question.trim()); }}>
        <label className={styles.label} htmlFor="briefing-question">Ask about this evidence</label>
        <div className={styles.inputRow}>
          <input id="briefing-question" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. What is the main limitation?" />
          <button type="submit" disabled={loading || !question.trim()}>Ask</button>
        </div>
      </form>
      {loading && <LoadingState label="Creating grounded briefing…" />}
      {error && <ErrorState message={error} onRetry={() => ask(question || QUESTIONS[0])} />}
      {answer && !loading && (
        <article className={styles.answer}>
          <div className={styles.answerMeta}><span>{answer.generated_by}</span><span>{answer.historical_window_label}</span></div>
          <div className={styles.answerText}>{answer.briefing}</div>
        </article>
      )}
    </section>
  );
}
