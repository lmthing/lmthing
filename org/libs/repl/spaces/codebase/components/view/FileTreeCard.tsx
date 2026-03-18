/**
 * Displays a file tree with optional annotations for each entry.
 *
 * Props:
 * - title: string — what this tree represents (e.g., "Studio App Structure")
 * - root: string — root path (e.g., "studio/")
 * - entries: { path: string; annotation?: string; highlight?: boolean }[] — tree entries
 */

interface FileTreeCardProps {
  title: string;
  root: string;
  entries: { path: string; annotation?: string; highlight?: boolean }[];
}

export function FileTreeCard({ title, root, entries }: FileTreeCardProps) {
  return (
    <div style={{
      border: "1px solid #2ecc71",
      borderRadius: 8,
      padding: 16,
      maxWidth: 520,
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f0faf3",
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#2c3e50", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#7f8c8d", marginBottom: 12, fontFamily: "monospace" }}>
        {root}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 13 }}>
        {entries.map((entry, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
            backgroundColor: entry.highlight ? "#d5f5e3" : "transparent",
            borderRadius: entry.highlight ? 3 : 0,
            paddingLeft: entry.highlight ? 6 : 0,
            paddingRight: entry.highlight ? 6 : 0,
          }}>
            <span style={{ color: entry.highlight ? "#27ae60" : "#2c3e50" }}>
              {entry.path}
            </span>
            {entry.annotation && (
              <span style={{ color: "#95a5a6", fontSize: 12, marginLeft: 12, fontFamily: "system-ui, sans-serif" }}>
                {entry.annotation}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
