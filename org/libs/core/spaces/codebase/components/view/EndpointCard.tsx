/**
 * Displays information about a cloud edge function API endpoint.
 *
 * Props:
 * - name: string — function name (e.g., "generate-ai")
 * - method: string — HTTP method (GET, POST, PATCH, etc.)
 * - purpose: string — what the endpoint does
 * - auth: string — auth requirement (jwt, apikey, none)
 * - category: string — grouping (AI, Billing, Spaces, etc.)
 * - requestBody?: string — description of expected request body
 * - responseFormat?: string — description of response format
 */

interface EndpointCardProps {
  name: string;
  method: string;
  purpose: string;
  auth: string;
  category: string;
  requestBody?: string;
  responseFormat?: string;
}

export function EndpointCard({ name, method, purpose, auth, category, requestBody, responseFormat }: EndpointCardProps) {
  const methodColors: Record<string, string> = {
    GET: "#27ae60",
    POST: "#3498db",
    PATCH: "#f39c12",
    DELETE: "#e74c3c",
  };

  return (
    <div style={{
      border: "1px solid #bdc3c7",
      borderRadius: 8,
      padding: 16,
      maxWidth: 520,
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#fafafa",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <span style={{
          backgroundColor: methodColors[method] || "#95a5a6",
          color: "white",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "monospace",
        }}>
          {method}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#2c3e50", fontFamily: "monospace" }}>
          /functions/v1/{name}
        </span>
      </div>

      <div style={{ fontSize: 14, color: "#34495e", marginBottom: 12 }}>
        {purpose}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#7f8c8d" }}>
        <div>
          <span style={{ fontWeight: 600, color: "#2c3e50" }}>Auth: </span>
          {auth}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "#2c3e50" }}>Category: </span>
          {category}
        </div>
      </div>

      {requestBody && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#34495e" }}>
          <span style={{ fontWeight: 600, color: "#2c3e50" }}>Request: </span>
          {requestBody}
        </div>
      )}

      {responseFormat && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#34495e" }}>
          <span style={{ fontWeight: 600, color: "#2c3e50" }}>Response: </span>
          {responseFormat}
        </div>
      )}
    </div>
  );
}
