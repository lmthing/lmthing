export function ActivityIndicator() {
  return (
    <div className="twv-activity-indicator" aria-live="polite" aria-label="Agent is working">
      <span className="twv-activity-dot" />
      <span>Working...</span>
    </div>
  )
}
