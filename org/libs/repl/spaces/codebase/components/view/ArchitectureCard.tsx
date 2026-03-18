/**
 * Displays an architecture explanation with title, description, data flow steps, and key insights.
 *
 * Props:
 * - title: string — architecture topic (e.g., "Agent Execution Flow")
 * - description: string — overview of the architecture
 * - steps?: { label: string; detail: string }[] — data flow steps
 * - insights?: string[] — key architectural insights
 */

interface ArchitectureCardProps {
  title: string;
  description: string;
  steps?: { label: string; detail: string }[];
  insights?: string[];
}

export function ArchitectureCard({ title, description, steps, insights }: ArchitectureCardProps) {
  return (
    <div style={{
      border: "1px solid #9b59b6",
      borderRadius: 8,
      padding: 16,
      maxWidth: 520,
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f8f5ff",
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#2c3e50", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "#34495e", marginBottom: 16, lineHeight: 1.5 }}>
        {description}
      </div>

      {steps && steps.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50", marginBottom: 8 }}>
            Data Flow
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex",
              marginBottom: 10,
              paddingBottom: i < steps.length - 1 ? 10 : 0,
              borderBottom: i < steps.length - 1 ? "1px solid #e8daef" : "none",
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#9b59b6",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                marginRight: 10,
                marginTop: 2,
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50" }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 13, color: "#7f8c8d", marginTop: 2 }}>
                  {step.detail}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {insights && insights.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50", marginBottom: 6, marginTop: 8 }}>
            Key Insights
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {insights.map((insight, i) => (
              <li key={i} style={{ fontSize: 13, color: "#34495e", marginBottom: 4, lineHeight: 1.4 }}>
                {insight}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
