export function unusual() { const value: { big: bigint; negativeZero: number; self?: unknown } = { big: 2n, negativeZero: -0 }; value.self = value; return value; }
