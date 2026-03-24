import React from "react"

interface NutritionReportProps {
  title: string
  score: number
  perServing: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  recommendations: string[]
  swaps?: Array<{ from: string; to: string; reason: string }>
}

export function NutritionReport({
  title,
  score,
  perServing,
  recommendations,
  swaps,
}: NutritionReportProps) {
  const scoreColor = score >= 80 ? "#27ae60" : score >= 60 ? "#f39c12" : "#e74c3c"

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 520, border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <span style={{ fontSize: 24, fontWeight: "bold", color: scoreColor }}>{score}/100</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12, textAlign: "center" }}>
        <div><div style={{ fontSize: 18, fontWeight: "bold" }}>{perServing.calories}</div><div style={{ fontSize: 11, color: "#888" }}>kcal</div></div>
        <div><div style={{ fontSize: 18, fontWeight: "bold" }}>{perServing.protein}g</div><div style={{ fontSize: 11, color: "#888" }}>protein</div></div>
        <div><div style={{ fontSize: 18, fontWeight: "bold" }}>{perServing.carbs}g</div><div style={{ fontSize: 11, color: "#888" }}>carbs</div></div>
        <div><div style={{ fontSize: 18, fontWeight: "bold" }}>{perServing.fat}g</div><div style={{ fontSize: 11, color: "#888" }}>fat</div></div>
        <div><div style={{ fontSize: 18, fontWeight: "bold" }}>{perServing.fiber}g</div><div style={{ fontSize: 11, color: "#888" }}>fiber</div></div>
      </div>

      {recommendations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#555" }}>
            {recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {swaps && swaps.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>Suggested Swaps</div>
          {swaps.map((s, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #eee" }}>
              <span style={{ color: "#e74c3c" }}>{s.from}</span>
              {" → "}
              <span style={{ color: "#27ae60" }}>{s.to}</span>
              <span style={{ color: "#888", marginLeft: 8 }}>({s.reason})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
