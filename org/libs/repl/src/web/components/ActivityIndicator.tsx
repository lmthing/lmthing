export function ActivityIndicator() {
  return (
    <div className="activity-indicator" aria-live="polite" aria-label="Agent is working">
      <span className="activity-dot" />
      <span>Working...</span>
    </div>
  )
}
