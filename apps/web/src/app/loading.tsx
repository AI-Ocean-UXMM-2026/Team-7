export default function Loading() {
  return <div className="page-stack loading-preview" role="status" aria-label="Loading workspace"><div className="skeleton skeleton-heading"/><div className="metrics-grid">{[1,2,3,4].map(i=><div className="card skeleton skeleton-metric" key={i}/>)}</div><div className="card skeleton skeleton-content"/><span className="sr-only">Loading your workspace…</span></div>;
}
