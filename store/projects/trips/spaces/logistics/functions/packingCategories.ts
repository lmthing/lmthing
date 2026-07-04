/**
 * Map a packing item's free-text label to one of the `packing_items.category` enum values, using
 * keyword heuristics. Falls back to `'other'` when nothing matches — callers should still prefer
 * setting an explicit category when they already know it (e.g. from an activity/gear mapping) and
 * only use this as a backfill.
 */
export function packingCategory(
  label: string,
): 'clothing' | 'gear' | 'documents' | 'toiletries' | 'electronics' | 'other' {
  const l = label.toLowerCase();

  const documentsKeywords = [
    'passport', 'visa', 'e-visa', 'eta', 'insurance', 'ticket', 'boarding pass',
    'confirmation', 'itinerary', 'id card', 'license', 'permit',
  ];
  if (documentsKeywords.some(k => l.includes(k))) return 'documents';

  const electronicsKeywords = [
    'adapter', 'charger', 'power bank', 'battery', 'camera', 'phone', 'laptop',
    'headphone', 'earbud', 'converter', 'cable', 'kindle', 'e-reader',
  ];
  if (electronicsKeywords.some(k => l.includes(k))) return 'electronics';

  const toiletriesKeywords = [
    'toothbrush', 'toothpaste', 'sunscreen', 'shampoo', 'conditioner', 'soap',
    'deodorant', 'razor', 'moisturizer', 'lotion', 'toiletry', 'medication', 'first aid',
  ];
  if (toiletriesKeywords.some(k => l.includes(k))) return 'toiletries';

  const gearKeywords = [
    'boots', 'daypack', 'backpack', 'umbrella', 'water bottle', 'binoculars', 'towel',
    'snorkel', 'trekking pole', 'headlamp', 'dry bag', 'compression sock', 'neck pillow',
    'map', 'gear',
  ];
  if (gearKeywords.some(k => l.includes(k))) return 'gear';

  const clothingKeywords = [
    'jacket', 'shirt', 'pants', 'trousers', 'dress', 'shoes', 'sock', 'sweater',
    'shorts', 'swimwear', 'swimsuit', 'coat', 'hat', 'scarf', 'glove', 'layer', 'shell',
    'sandals', 'sneakers',
  ];
  if (clothingKeywords.some(k => l.includes(k))) return 'clothing';

  return 'other';
}
