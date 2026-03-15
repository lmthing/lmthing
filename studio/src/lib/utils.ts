import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalises runtimeFields from either:
 *   - nested object { curriculum: ["unit-focus"] }  →  ["curriculum/unit-focus"]
 *   - legacy flat array ["curriculum/unit-focus"]   →  unchanged
 *   - anything else                                  →  []
 */
export function flattenruntimeFields(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([category, fields]) =>
    Array.isArray(fields) ? (fields as string[]).map((f) => `${category}/${f}`) : [],
  );
}
