import type { Dataset } from '../lib/schema'
import { usageScenarios } from '../lib/usage-scenarios'

interface MethodologyPageProps { dataset: Dataset }

function formatDuration(seconds: number) {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} min`
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(seconds)} s`
}

export function MethodologyPage({ dataset }: MethodologyPageProps) {
  const official = dataset.observations.filter((observation) => observation.provenance.sourceId === dataset.sourceRetrieval.sourceId)
  const meanTime = official.filter((observation) => observation.metrics.time.value !== null).length
  const medianTime = official.filter((observation) => observation.metrics.medianTime.value !== null).length
  const scenarioObservationIds = new Set(usageScenarios.map((scenario) => scenario.targetObservationId))
  const missingUsageRows = dataset.observations.filter((observation) => observation.metrics.cost.value === null && observation.metrics.outputTokens.value === null && observation.metrics.time.value === null)
  const noDataCount = missingUsageRows.filter((observation) => !scenarioObservationIds.has(observation.id)).length
  const unscaledNoDataCount = missingUsageRows.filter((observation) => !scenarioObservationIds.has(observation.id) && observation.result.reportedUnit !== '%' && observation.result.reportedUnit !== 'fraction').length
  const chartNoDataCount = noDataCount - unscaledNoDataCount
  return (
    <main className="page-wrap content-page">
      <header className="page-heading">
        <span className="section-kicker">HOW TO READ THE ATLAS</span>
        <h1>Methodology &amp; limits</h1>
        <p>Each dot is a source-attributed evaluation configuration. This explorer describes reported measurements; it does not rerun DeepSWE or establish a universal model ranking.</p>
      </header>
      <div className="method-banner"><span>SNAPSHOT {dataset.revisionId}</span><span>Last data change {new Date(dataset.lastDataChangeAt).toLocaleDateString()}</span><span>Last approved source check {new Date(dataset.lastSuccessfulCheckAt).toLocaleDateString()}</span></div>
      <section className="method-grid">
        <article className="method-card method-card-wide">
          <span className="section-kicker">01 · CONNECTED XY</span>
          <h2>Effort curves are paths, not fitted trends.</h2>
          <p>A line joins only configurations from an explicitly grouped evaluation series with a reviewed effort order. The path follows the model-specific order—not score or X value—so it can double back. Null metric values break the path; unfamiliar or unordered effort labels remain dots. Lines are straight, measured-point markers remain visible, and no intermediate settings are invented.</p>
          <p>Series are separated by publisher/evaluator, exact model, benchmark version and metric, harness, and known provider configuration. A source-backed series may disclose missing protocol fields in the non-strict view; missing fields never pass strict comparison.</p>
        </article>
        <article className="method-card">
          <span className="section-kicker">02 · SCORE</span>
          <h2>One score definition at a time.</h2>
          <p>Datacurve's feed defines <strong>pass@1</strong> over scored rollout attempts. The original paper uses an equal-task-weighted mean of per-task first-rollout pass fractions, while Artificial Analysis averages pass@1 across three attempts per task. Those source experiments stay separate. <strong>pass@4</strong> counts unique tasks with at least one pass among up to four attempts; the paper's results remain version-unknown.</p>
          <p>Reported percentages are normalized to a fraction without rounding; labels and raw values remain attached. Display rounding happens after best-selection.</p>
        </article>
        <article className="method-card">
          <span className="section-kicker">03 · COST</span>
          <h2>Feed costs stay historical.</h2>
          <p>For official Datacurve rows, cost is the source-reported mean USD per scored rollout attempt, not per unique task. The feed's pricing basis is retained when available; current-price repricing is not performed. Other reports need a cost measured for their own experiment and scope.</p>
          <p>Artificial Analysis publishes suite-pooled cost, token, and time metrics across DeepSWE, Terminal-Bench 4.0, and SWE-Atlas-QnA, without benchmark-specific allocation. These suite values are not DeepSWE usage measurements. Optional scenarios are separate cross-harness estimates or exact-model/effort DeepSWE reference transfers; they do not replace source measurements. Fireworks' unscoped Cost/Task values are not normalized, and no rate-card repricing or cost-to-token conversion is performed.</p>
          <p>The GPT-5.6 Sol max row is unresolved: the JSON feed reports ${official.find((row) => row.upstreamConfigurationId === 'mini_swe_agent_gpt_5_6_sol_max')?.pricing.asReportedCost?.toFixed(2) ?? '—'} mean cost while the rendered leaderboard displayed $6.46. Both observations retain attribution; the chart uses the selected feed metric.</p>
        </article>
        <article className="method-card">
          <span className="section-kicker">04 · TOKENS</span>
          <h2>Output tokens, not total tokens.</h2>
          <p>The X metric uses the feed's mean or median output-token count per scored attempt. Input tokens and agent steps are not substituted. Whether reasoning tokens are included is not established consistently, so token equivalence is excluded from strict matching. Optional usage scenarios are mean-only; they do not infer median values, and strict comparisons exclude every scenario.</p>
        </article>
        <article className="method-card method-card-accent">
          <span className="section-kicker">05 · TIME</span>
          <h2>Reported duration, timer boundary unknown.</h2>
          <p>Datacurve reports both mean and median duration on {meanTime} of {official.length} current configurations ({medianTime} median values). The field is seconds over scored rollout attempts, but timer start/end, tool/retry/queue/setup/verification inclusion, timeout handling, environment, and a duration-specific sample count are not stated.</p>
          <p>It is therefore labeled <strong>reported seconds per scored attempt</strong>, not verified end-to-end wall-clock time, and strict timing matching excludes it. Time scenarios use measured wall-clock ratios but retain this scope caveat; mean and median are never silently substituted.</p>
        </article>
        <article className="method-card">
          <span className="section-kicker">06 · UNCERTAINTY</span>
          <h2>Intervals stay attached to points.</h2>
          <p>Datacurve's reported 95% run-to-run interval is preserved with its stated standard-error method across repeated whole-benchmark passes. No interval is inferred for other publishers and no continuous confidence ribbon is drawn. Close scores should not be treated as statistically decisive.</p>
        </article>
        <article className="method-card">
          <span className="section-kicker">07 · BEST / STRICT</span>
          <h2>Display controls do not rewrite evidence.</h2>
          <p>All configurations are the default. Best is an optional projection selected at full numeric precision within one explicit series. Strict mode requires known benchmark scope/version, metric, evaluator, harness revision, evaluation policy, and metric-specific equivalence. Unknowns are shown as exclusion reasons.</p>
        </article>
        <article className="method-card method-card-wide">
          <span className="section-kicker">08 · USAGE SCENARIOS</span>
          <h2>Transfer scenarios stay distinct from measurements.</h2>
          <p>The default-enabled <strong>Include usage scenarios</strong> switch adds standalone hollow diamonds for {usageScenarios.length} exact Artificial Analysis observation rows. Four use separate Datacurve DeepSWE rows with exact model/max matches; GPT-6 Sol/Luna use calibrated suite references; Opus 5.5 uses one adjacent-version Opus 5 max pair. Each marker keeps the AA score and does not populate approved measurement fields. Separate developer reports do not inherit estimates when their experiment identity or harness is unknown.</p>
          <p>The current snapshot has {missingUsageRows.length} observations missing all three usage metrics. {noDataCount} remain without a defensible estimate for cost, output tokens, or time; {chartNoDataCount} percentage-scale scores appear in the no-data gutter. {unscaledNoDataCount} raw-unit-unspecified scores remain unscaled outside the percentage plot. Scenarios are mean-only; median views and strict comparisons exclude them.</p>
          <ul className="scenario-method-list">{usageScenarios.map((scenario) => {
            const target = dataset.observations.find((observation) => observation.id === scenario.targetObservationId)
            return <li key={scenario.id}><strong>{scenario.targetReportedName} · {scenario.targetHarness}:</strong> ${scenario.costUsdPerScoredAttempt.toFixed(2)}, {new Intl.NumberFormat('en').format(scenario.outputTokensPerScoredAttempt)} output tokens, {formatDuration(scenario.timeSecondsPerScoredAttempt)} per scored attempt. {scenario.confidence === 'low' ? 'Low' : 'Very low'} qualitative evidence; timing boundaries are incomplete and this is not an end-to-end duration. <small>{scenario.directUsageReference ? `Direct reference: ${scenario.directUsageReference.configurationId}.` : `${scenario.costCalibrationDescription} ${scenario.outputCalibrationDescription}`}</small>{target && <> Source score: {target.result.reportedText}.</>}</li>
          })}</ul>
          <p>Output scenarios use output-only Intelligence Index figures or exact-model/effort DeepSWE output counts. Coding Agent suite token totals mix input, cache, cache-write, reasoning, and output and are never treated as output counts. Cost uses independent evidence. Evidence quality is qualitative, not probabilistic; observed sensitivity envelopes are not confidence or prediction intervals.</p>
          <p>{[...new Map(usageScenarios.flatMap((scenario) => scenario.sources).map((source) => [source.id, source])).values()].map((source, index) => <span key={source.id}>{index ? ' · ' : ''}<a href={source.url} target="_blank" rel="noreferrer">{source.publisher} {source.id}</a> (accessed {source.accessedOn})</span>)}</p>
        </article>
        <article className="method-card method-card-wide">
          <span className="section-kicker">09 · SOURCES &amp; REUSE</span>
          <h2>Transcription review is not replication.</h2>
          <p>“Source reviewed” means a result and its locator were checked against the cited document. It does not mean the evaluation was independently reproduced. Organizer, developer, independent evaluator, and secondary discovery sources remain distinct. Candidate leads never appear in approved numeric charts or exports.</p>
          <p>The official endpoint is public, but no feed-specific redistribution license was located in the inspected sources. The site stores attributed normalized result facts and source hashes only. It does not redistribute the full JSON feed, source page, PDF, benchmark tasks, solutions, private logs, or trajectories. The Datacurve benchmark repository's Apache-2.0 license is not assumed to license the separate feed.</p>
        </article>
      </section>
      <p className="method-footnote">The benchmark organizer currently reports 113 tasks. The source snapshot and retrieval details are recorded in the checked-in data and source registry. The site is unofficial and not affiliated with Datacurve.</p>
    </main>
  )
}
