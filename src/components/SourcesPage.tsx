interface SourceEntry {
  id: string
  publisher: string
  title: string
  url: string | null
  category: string
  status: string
  sha256: string | null
  license?: string
  accessAndReuse: string
  notes: string[]
}

interface SourcesPageProps { sources: SourceEntry[] }

const categoryName: Record<string, string> = {
  organizer: 'Benchmark organizer',
  developer: 'Developer report',
  independent: 'Independent evaluator',
  secondary: 'Secondary discovery',
  local: 'Local evaluation',
  'methodology-reference': 'Effort-setting reference',
}

export function SourcesPage({ sources }: SourcesPageProps) {
  return (
    <main className="page-wrap content-page">
      <header className="page-heading">
        <span className="section-kicker">CITATIONS · REVIEW STATE · REUSE NOTES</span>
        <h1>Source register</h1>
        <p>Source category, document-review status, and independent replication status are separate. Every published observation links to a specific source locator.</p>
      </header>
      <div className="source-summary">
        <div><strong>{sources.filter((source) => source.status === 'source-reviewed').length}</strong><span>source-reviewed records</span></div>
        <div><strong>{sources.filter((source) => source.status === 'pending-review').length}</strong><span>pending discovery sources</span></div>
        <p>Review verifies transcription and provenance; it does not certify the underlying experiment or imply independent replication.</p>
      </div>
      <section className="source-register" aria-label="Registered source documents">
        {sources.map((source) => (
          <article className="source-register-row" key={source.id}>
            <div className="source-register-meta"><span>{categoryName[source.category] ?? source.category}</span><span className={`status-pill status-${source.status}`}>{source.status.replaceAll('-', ' ')}</span></div>
            <div className="source-register-main">
              <h2>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a> : source.title}</h2>
              {!source.url && <p>No public source URL; this record identifies a local evaluation artifact.</p>}
              <p>{source.publisher}{source.license ? ` · ${source.license}` : ''}</p>
              <p>{source.accessAndReuse}</p>
              {source.notes.map((note) => <p className="source-note" key={note}>{note}</p>)}
              {source.sha256 && <details><summary>Captured response SHA-256</summary><code>{source.sha256}</code></details>}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
