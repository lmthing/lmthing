import React from "react"

interface MacroBreakdownProps {
  title: string
  items: Array<{
    ingredient: string
    grams: number
    calories: number
    protein: number
    carbs: number
    fat: number
  }>
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
}

export function MacroBreakdown({ title, items, totals }: MacroBreakdownProps) {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 520, border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>{title}</h3>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd" }}>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>Ingredient</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>g</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>kcal</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>P</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>C</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>F</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "4px 8px" }}>{item.ingredient}</td>
              <td style={{ textAlign: "right", padding: "4px 8px", color: "#888" }}>{item.grams}</td>
              <td style={{ textAlign: "right", padding: "4px 8px" }}>{item.calories}</td>
              <td style={{ textAlign: "right", padding: "4px 8px", color: "#e74c3c" }}>{item.protein}g</td>
              <td style={{ textAlign: "right", padding: "4px 8px", color: "#3498db" }}>{item.carbs}g</td>
              <td style={{ textAlign: "right", padding: "4px 8px", color: "#f39c12" }}>{item.fat}g</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #333", fontWeight: "bold" }}>
            <td style={{ padding: "6px 8px" }}>Total</td>
            <td style={{ textAlign: "right", padding: "6px 8px" }}></td>
            <td style={{ textAlign: "right", padding: "6px 8px" }}>{totals.calories}</td>
            <td style={{ textAlign: "right", padding: "6px 8px", color: "#e74c3c" }}>{totals.protein}g</td>
            <td style={{ textAlign: "right", padding: "6px 8px", color: "#3498db" }}>{totals.carbs}g</td>
            <td style={{ textAlign: "right", padding: "6px 8px", color: "#f39c12" }}>{totals.fat}g</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
