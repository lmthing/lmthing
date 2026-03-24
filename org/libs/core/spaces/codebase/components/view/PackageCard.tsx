/**
 * Displays information about a package in the lmthing monorepo.
 *
 * Props:
 * - name: string — package name (e.g., "@lmthing/state")
 * - path: string — path in the monorepo (e.g., "org/libs/state/")
 * - description: string — what the package does
 * - keyFiles: string[] — important files to look at
 * - dependsOn?: string[] — packages this depends on
 * - dependedBy?: string[] — packages that depend on this
 */

interface PackageCardProps {
  name: string;
  path: string;
  description: string;
  keyFiles: string[];
  dependsOn?: string[];
  dependedBy?: string[];
}

export function PackageCard({ name, path, description, keyFiles, dependsOn, dependedBy }: PackageCardProps) {
  return (
    <div style={{
      border: "1px solid #3498db",
      borderRadius: 8,
      padding: 16,
      maxWidth: 520,
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f0f7ff",
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#2c3e50", marginBottom: 4 }}>
        {name}
      </div>
      <div style={{ fontSize: 13, color: "#7f8c8d", marginBottom: 12, fontFamily: "monospace" }}>
        {path}
      </div>
      <div style={{ fontSize: 14, color: "#34495e", marginBottom: 16 }}>
        {description}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50", marginBottom: 6 }}>
        Key Files
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 12 }}>
        {keyFiles.map((file, i) => (
          <li key={i} style={{ fontSize: 13, color: "#34495e", fontFamily: "monospace", marginBottom: 2 }}>
            {file}
          </li>
        ))}
      </ul>

      {dependsOn && dependsOn.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50", marginBottom: 6 }}>
            Depends On
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 12 }}>
            {dependsOn.map((dep, i) => (
              <li key={i} style={{ fontSize: 13, color: "#7f8c8d", marginBottom: 2 }}>{dep}</li>
            ))}
          </ul>
        </>
      )}

      {dependedBy && dependedBy.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2c3e50", marginBottom: 6 }}>
            Depended By
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {dependedBy.map((dep, i) => (
              <li key={i} style={{ fontSize: 13, color: "#7f8c8d", marginBottom: 2 }}>{dep}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
