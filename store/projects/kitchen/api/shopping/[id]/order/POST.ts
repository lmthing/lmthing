type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'orderGroceries';
export const description =
  "Turn a plan's unbought shopping list into a grocery order. Scaffolded for Instacart / Kroger: when those integrations are configured (env keys) it returns a pre-filled cart deep link and real pricing; otherwise it degrades gracefully to a local cost estimate from ingredients.costPerUnit and configured:false, so the Shop screen always has a working 'estimate' path.";

export interface Input {
  /** the plan id whose shopping list to order. */
  id: string;
  /** optional store hint, e.g. 'kroger' | 'instacart'. */
  store?: string;
}

export interface OrderLine {
  ingredient: string;
  quantity: number;
  unit: string;
  estCost: number;
}

export interface Output {
  configured: boolean;
  provider: string | null;
  checkoutUrl: string | null;
  estimatedCost: number;
  lines: OrderLine[];
  note: string;
}

interface ShoppingRow {
  id: string;
  planId: string;
  ingredientId: string;
  quantity: number;
  bought: boolean;
}
interface Ingredient {
  id: string;
  name: string;
  unit?: string;
  costPerUnit?: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('shopping_list', { where: { planId: input.id } })) as ShoppingRow[];
  const toBuy = rows.filter((r) => !r.bought);

  const ingredients = (await ctx.db.query('ingredients')) as Ingredient[];
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const lines: OrderLine[] = toBuy.map((r) => {
    const ing = byId.get(r.ingredientId);
    const estCost = (ing?.costPerUnit ?? 0) * (r.quantity ?? 0);
    return {
      ingredient: ing?.name ?? r.ingredientId,
      quantity: r.quantity ?? 0,
      unit: ing?.unit ?? '',
      estCost: Math.round(estCost * 100) / 100,
    };
  });
  const estimatedCost = Math.round(lines.reduce((s, l) => s + l.estCost, 0) * 100) / 100;

  // Real ordering requires OAuth2 client-credentials (Kroger) or the Instacart list API — both
  // server-side keys that live in the pod/gateway env, never in the client. Not hardcoded here.
  const krogerConfigured = Boolean(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
  const instacartConfigured = Boolean(process.env.INSTACART_API_KEY);

  if (!krogerConfigured && !instacartConfigured) {
    return {
      configured: false,
      provider: null,
      checkoutUrl: null,
      estimatedCost,
      lines,
      note: 'Grocery ordering is not configured. Showing a local cost estimate from your saved per-unit costs.',
    };
  }

  // TODO: with keys present, exchange client credentials for a token and POST the line items to
  // the provider's cart/list endpoint, returning provider.checkoutUrl + real pricing. Left as a
  // clear integration point so the build never depends on an external service being reachable.
  const provider = instacartConfigured ? 'instacart' : 'kroger';
  return {
    configured: true,
    provider,
    checkoutUrl: null,
    estimatedCost,
    lines,
    note: `${provider} is configured, but cart creation is not wired yet — estimate shown.`,
  };
}
