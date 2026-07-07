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

export const name = 'seedStarterRecipes';
export const description =
  "First-run onboarding: seed a handful of simple starter recipes (and the pantry ingredients they need) so generatePlan isn't dead on arrival. Idempotent — a no-op returning seeded:0 once the recipe box already has recipes.";

export interface Input {}

export interface Output {
  seeded: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}
interface Recipe {
  id: string;
}

interface StarterLine {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}
interface Starter {
  title: string;
  description: string;
  instructions: string;
  prepMinutes: number;
  tags: string[];
  cuisine: string;
  lines: StarterLine[];
}

const STARTERS: Starter[] = [
  {
    title: 'One-pan chickpea shakshuka',
    description: 'Eggs poached in a spiced tomato and chickpea sauce.',
    instructions:
      '1. Sauté onion and garlic in olive oil until soft.\n2. Add cumin and paprika, then tomatoes and chickpeas; simmer 10 min.\n3. Make wells, crack in the eggs, cover and cook until just set.\n4. Finish with herbs and serve with bread.',
    prepMinutes: 20,
    tags: ['vegetarian', 'quick'],
    cuisine: 'middle-eastern',
    lines: [
      { name: 'onion', quantity: 1, unit: 'count', category: 'produce' },
      { name: 'garlic', quantity: 2, unit: 'count', category: 'produce' },
      { name: 'olive oil', quantity: 15, unit: 'ml', category: 'pantry' },
      { name: 'canned tomatoes', quantity: 400, unit: 'g', category: 'pantry' },
      { name: 'chickpeas', quantity: 240, unit: 'g', category: 'pantry' },
      { name: 'eggs', quantity: 4, unit: 'count', category: 'dairy' },
    ],
  },
  {
    title: 'Weeknight pasta aglio e olio',
    description: 'Spaghetti with garlic, olive oil, and chilli.',
    instructions:
      '1. Cook spaghetti in well-salted water.\n2. Gently fry sliced garlic and chilli in olive oil.\n3. Toss the drained pasta with the oil and a splash of pasta water.\n4. Season and serve.',
    prepMinutes: 15,
    tags: ['vegetarian', 'quick'],
    cuisine: 'italian',
    lines: [
      { name: 'spaghetti', quantity: 200, unit: 'g', category: 'pantry' },
      { name: 'garlic', quantity: 3, unit: 'count', category: 'produce' },
      { name: 'olive oil', quantity: 30, unit: 'ml', category: 'pantry' },
      { name: 'chilli flakes', quantity: 2, unit: 'g', category: 'pantry' },
    ],
  },
  {
    title: 'Sheet-pan chicken and vegetables',
    description: 'Roasted chicken thighs with seasonal vegetables.',
    instructions:
      '1. Toss chicken thighs and chopped vegetables with olive oil, salt, and pepper.\n2. Spread on a sheet pan.\n3. Roast at 200°C for 35–40 min until cooked through.\n4. Rest a few minutes and serve.',
    prepMinutes: 45,
    tags: ['high-protein'],
    cuisine: 'american',
    lines: [
      { name: 'chicken thighs', quantity: 600, unit: 'g', category: 'meat' },
      { name: 'potato', quantity: 400, unit: 'g', category: 'produce' },
      { name: 'carrot', quantity: 200, unit: 'g', category: 'produce' },
      { name: 'olive oil', quantity: 20, unit: 'ml', category: 'pantry' },
    ],
  },
  {
    title: 'Coconut red lentil dal',
    description: 'Creamy spiced red lentils with coconut milk.',
    instructions:
      '1. Sauté onion, garlic, and ginger.\n2. Add curry spices, then rinsed red lentils, coconut milk, and water.\n3. Simmer 20 min until the lentils break down.\n4. Season with lime and serve with rice.',
    prepMinutes: 30,
    tags: ['vegan', 'vegetarian'],
    cuisine: 'indian',
    lines: [
      { name: 'red lentils', quantity: 200, unit: 'g', category: 'pantry' },
      { name: 'coconut milk', quantity: 400, unit: 'ml', category: 'pantry' },
      { name: 'onion', quantity: 1, unit: 'count', category: 'produce' },
      { name: 'garlic', quantity: 2, unit: 'count', category: 'produce' },
      { name: 'ginger', quantity: 15, unit: 'g', category: 'produce' },
    ],
  },
];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const existing = (await ctx.db.query('recipes')) as Recipe[];
  const real = existing.filter((r) => {
    const t = (r as unknown as { title?: string }).title;
    return t && t !== 'Importing…' && t !== 'Import failed';
  });
  if (real.length > 0) return { seeded: 0 };

  let seeded = 0;
  for (const starter of STARTERS) {
    const recipe = (await ctx.db.insert('recipes', {
      title: starter.title,
      description: starter.description,
      instructions: starter.instructions,
      servings: 2,
      prepMinutes: starter.prepMinutes,
      tags: starter.tags,
      cuisine: starter.cuisine,
      source: 'chef',
    })) as Recipe;

    for (const line of starter.lines) {
      const found = (await ctx.db.query('ingredients', { where: { name: line.name } })) as Ingredient[];
      let ingredient = found[0];
      if (!ingredient) {
        ingredient = (await ctx.db.insert('ingredients', {
          name: line.name,
          unit: line.unit,
          quantity: 0,
          category: line.category,
        })) as Ingredient;
      }
      await ctx.db.insert('recipe_ingredients', {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: line.quantity,
        optional: false,
      });
    }
    seeded += 1;
  }

  return { seeded };
}
