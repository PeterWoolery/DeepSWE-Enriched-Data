import { useState, type FormEvent } from 'react'
import type { Candidate } from '../lib/schema'
import { durationToSeconds } from '../lib/units'

interface ReviewQueueProps {
  candidates: Candidate[]
}

interface DraftFields {
  model: string
  publisher: string
  category: 'developer' | 'independent' | 'secondary'
  title: string
  url: string
  locator: string
  retrievalDate: string
  version: string
  scope: 'full' | 'subset' | 'unknown'
  rawScore: string
  scoreMetric: string
  denominator: string
  denominatorCount: string
  effort: string
  harness: string
  harnessRevision: string
  cost: string
  costBasis: string
  outputTokens: string
  reasoningTokensIncluded: 'unknown' | 'yes' | 'no'
  duration: string
  durationUnit: 'seconds' | 'minutes'
  durationStatistic: 'mean' | 'median'
  durationPopulation: string
  durationSamples: string
  timingBoundaries: string
  retriesAndTimeouts: string
  environment: string
  notes: string
}

const emptyDraft: DraftFields = {
  model: '', publisher: '', category: 'developer', title: '', url: '', locator: '', retrievalDate: '', version: '1.1', scope: 'unknown',
  rawScore: '', scoreMetric: '', denominator: '', denominatorCount: '', effort: '', harness: '', harnessRevision: '',
  cost: '', costBasis: '', outputTokens: '', reasoningTokensIncluded: 'unknown', duration: '', durationUnit: 'seconds',
  durationStatistic: 'mean', durationPopulation: '', durationSamples: '', timingBoundaries: '', retriesAndTimeouts: '', environment: '', notes: '',
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'result'
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function downloadCandidate(fields: DraftFields) {
  const rawNumber = numberOrNull(fields.rawScore)
  const normalizedScore = fields.scoreMetric.toLowerCase().includes('percent') && rawNumber !== null && rawNumber >= 0 && rawNumber <= 100 ? rawNumber / 100 : null
  const durationValue = numberOrNull(fields.duration)
  const payload = {
    schemaVersion: 1,
    status: 'pending-review',
    candidateId: `candidate-${slug(fields.model)}-${new Date().toISOString().slice(0, 10)}`,
    identity: { modelReported: fields.model.trim(), publisher: fields.publisher.trim(), sourceCategory: fields.category },
    source: {
      title: fields.title.trim(),
      url: fields.url.trim(),
      evidenceLocator: fields.locator.trim(),
      retrievedAt: fields.retrievalDate || null,
      sha256: null,
    },
    submittedAt: new Date().toISOString(),
    benchmark: { name: 'DeepSWE', version: fields.version.trim() || null, scope: fields.scope, taskCount: null },
    result: {
      rawReportedText: fields.rawScore.trim(),
      reportedNumericValue: rawNumber,
      reportedUnit: fields.scoreMetric.trim() || 'not specified',
      normalizedFraction: normalizedScore,
      metricLabel: fields.scoreMetric.trim() || null,
      denominator: fields.denominator.trim() || null,
      denominatorCount: numberOrNull(fields.denominatorCount),
      effortLabel: fields.effort.trim() || null,
      harness: fields.harness.trim() || null,
      harnessRevision: fields.harnessRevision.trim() || null,
    },
    efficiency: {
      cost: {
        value: numberOrNull(fields.cost), unit: 'USD', scope: 'per scored attempt', basis: fields.costBasis.trim() || null,
        missingReason: fields.cost.trim() ? null : 'Not provided',
      },
      outputTokens: {
        value: numberOrNull(fields.outputTokens), scope: 'per scored attempt', includesReasoningTokens: fields.reasoningTokensIncluded === 'unknown' ? null : fields.reasoningTokensIncluded === 'yes',
        missingReason: fields.outputTokens.trim() ? null : 'Not provided',
      },
      duration: {
        reportedValue: durationValue,
        reportedUnit: fields.durationUnit,
        valueSeconds: durationValue === null ? null : durationToSeconds(durationValue, fields.durationUnit),
        statistic: fields.durationStatistic,
        population: fields.durationPopulation.trim() || null,
        sampleCount: numberOrNull(fields.durationSamples),
        timingBoundaries: fields.timingBoundaries.trim() || null,
        retriesAndTimeouts: fields.retriesAndTimeouts.trim() || null,
        environment: fields.environment.trim() || null,
        missingReason: durationValue === null ? 'Not provided' : null,
      },
    },
    review: {
      sourceStatus: 'pending-review',
      independentReplication: 'not-assessed',
      notes: fields.notes.trim(),
      instructions: 'This local draft is a proposal only. Add it through a reviewed PR; it is not uploaded, approved, or included in rankings.',
    },
  }
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${payload.candidateId}.json`
  anchor.click()
  URL.revokeObjectURL(href)
}

export function ReviewQueue({ candidates }: ReviewQueueProps) {
  const [fields, setFields] = useState(emptyDraft)
  const [message, setMessage] = useState('')
  const update = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => setFields((previous) => ({ ...previous, [key]: value }))
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    downloadCandidate(fields)
    setMessage('Local JSON draft downloaded. It remains pending until its evidence and protocol fields are reviewed in a PR.')
  }

  return (
    <main className="page-wrap review-page">
      <header className="page-heading">
        <span className="section-kicker">INCOMING EVIDENCE · NOT RANKED</span>
        <h1>Review queue</h1>
        <p>Discovery leads and community submissions stay separate from approved numeric observations. Values here are claims to investigate, not leaderboard entries.</p>
      </header>
      <div className="review-notice" role="note">
        <strong>{candidates.length} pending leads</strong>
        <span>No candidate scores appear in comparison charts, approved tables, or all-observation exports.</span>
      </div>
      <section className="candidate-list" aria-label="Pending source candidates">
        {candidates.map((candidate) => (
          <article className="candidate-card" key={candidate.id}>
            <div className="candidate-label-row"><span className="candidate-badge">PENDING · {candidate.sourceCategory}</span><span>{candidate.benchmarkVersion ? `DeepSWE v${candidate.benchmarkVersion}` : 'Version unknown'}</span></div>
            <h2>{candidate.modelReported}</h2>
            <p className="candidate-claim">Reported claim: <strong>{candidate.rawScoreText}</strong> <small>({candidate.scoreUnit})</small></p>
            <p>{candidate.reason}</p>
            <div className="candidate-meta"><span>Effort: {candidate.effortLabel ?? 'not reported'}</span><span>Harness: {candidate.harness ?? 'not confirmed'}</span></div>
            <details>
              <summary>Evidence gaps and locator</summary>
              <p>{candidate.evidenceLocator}</p>
              <ul>{candidate.missing.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
            <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">{candidate.sourceTitle} ↗</a>
          </article>
        ))}
      </section>

      <section className="submission-section" aria-labelledby="submission-title">
        <div className="submission-intro">
          <span className="section-kicker">COMMUNITY SUBMISSION</span>
          <h2 id="submission-title">Prepare a source-backed draft</h2>
          <p>This form runs locally in your browser. It does not collect credentials, upload data, or approve a result. The downloaded JSON is a proposal for a reviewed pull request.</p>
        </div>
        <form className="submission-form" onSubmit={onSubmit}>
          <fieldset>
            <legend>Identity and evidence</legend>
            <div className="form-grid">
              <label>Model name as source reports it<input required value={fields.model} onChange={(event) => update('model', event.target.value)} /></label>
              <label>Publisher / evaluator<input required value={fields.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
              <label>Source category<select value={fields.category} onChange={(event) => update('category', event.target.value as DraftFields['category'])}><option value="developer">Developer report</option><option value="independent">Independent evaluator</option><option value="secondary">Secondary / discovery lead</option></select></label>
              <label>Source document title<input required value={fields.title} onChange={(event) => update('title', event.target.value)} /></label>
              <label className="wide-field">Source URL<input required type="url" value={fields.url} onChange={(event) => update('url', event.target.value)} /></label>
              <label className="wide-field">Evidence locator (page, section, figure, row)<input required value={fields.locator} onChange={(event) => update('locator', event.target.value)} /></label>
              <label>Source retrieval date (if known)<input type="date" value={fields.retrievalDate} onChange={(event) => update('retrievalDate', event.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Benchmark and score</legend>
            <div className="form-grid">
              <label>Version<input value={fields.version} onChange={(event) => update('version', event.target.value)} /></label>
              <label>Task scope<select value={fields.scope} onChange={(event) => update('scope', event.target.value as DraftFields['scope'])}><option value="unknown">Unknown</option><option value="full">Full suite</option><option value="subset">Subset</option></select></label>
              <label>Raw score as published<input required value={fields.rawScore} onChange={(event) => update('rawScore', event.target.value)} /></label>
              <label>Score metric / unit (e.g. pass@1, 68.8%)<input required value={fields.scoreMetric} onChange={(event) => update('scoreMetric', event.target.value)} /></label>
              <label>Denominator description<input value={fields.denominator} onChange={(event) => update('denominator', event.target.value)} /></label>
              <label>Denominator count<input type="number" min="0" value={fields.denominatorCount} onChange={(event) => update('denominatorCount', event.target.value)} /></label>
              <label>Effort label as reported<input value={fields.effort} onChange={(event) => update('effort', event.target.value)} /></label>
              <label>Harness<input value={fields.harness} onChange={(event) => update('harness', event.target.value)} /></label>
              <label>Harness revision<input value={fields.harnessRevision} onChange={(event) => update('harnessRevision', event.target.value)} /></label>
              <label>Notes / uncertainty<textarea rows={3} value={fields.notes} onChange={(event) => update('notes', event.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Efficiency measurements (optional, never infer)</legend>
            <p className="fieldset-note">Enter values only when the cited evaluation reports them. Preserve statistic, population, units, and timing boundaries.</p>
            <div className="form-grid">
              <label>Reported USD per scored attempt<input type="number" min="0" step="any" value={fields.cost} onChange={(event) => update('cost', event.target.value)} /></label>
              <label>Cost basis / pricing scope<input value={fields.costBasis} onChange={(event) => update('costBasis', event.target.value)} /></label>
              <label>Output tokens per scored attempt<input type="number" min="0" step="any" value={fields.outputTokens} onChange={(event) => update('outputTokens', event.target.value)} /></label>
              <label>Reasoning-token inclusion<select value={fields.reasoningTokensIncluded} onChange={(event) => update('reasoningTokensIncluded', event.target.value as DraftFields['reasoningTokensIncluded'])}><option value="unknown">Unknown</option><option value="yes">Included</option><option value="no">Excluded</option></select></label>
              <label>Duration value<input type="number" min="0" step="any" value={fields.duration} onChange={(event) => update('duration', event.target.value)} /></label>
              <label>Duration unit<select value={fields.durationUnit} onChange={(event) => update('durationUnit', event.target.value as DraftFields['durationUnit'])}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></label>
              <label>Duration statistic<select value={fields.durationStatistic} onChange={(event) => update('durationStatistic', event.target.value as DraftFields['durationStatistic'])}><option value="mean">Mean</option><option value="median">Median</option></select></label>
              <label>Timing population<input placeholder="e.g. all scored attempts" value={fields.durationPopulation} onChange={(event) => update('durationPopulation', event.target.value)} /></label>
              <label>Timing sample count<input type="number" min="0" value={fields.durationSamples} onChange={(event) => update('durationSamples', event.target.value)} /></label>
              <label>Timer boundaries<input placeholder="model, tools, retries, queue, verification…" value={fields.timingBoundaries} onChange={(event) => update('timingBoundaries', event.target.value)} /></label>
              <label>Timeout / retry policy<input value={fields.retriesAndTimeouts} onChange={(event) => update('retriesAndTimeouts', event.target.value)} /></label>
              <label>Serving / environment<input value={fields.environment} onChange={(event) => update('environment', event.target.value)} /></label>
            </div>
          </fieldset>
          <div className="form-submit-row">
            <button className="button-primary" type="submit">Download pending JSON draft <span aria-hidden="true">↓</span></button>
            <span role="status" aria-live="polite">{message}</span>
          </div>
        </form>
      </section>
    </main>
  )
}
