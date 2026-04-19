import type { FoodListing } from '@/src/types';

/** Maps each retail “section” to the existing FoodListing.category used across the app */
export type DonationSectionId =
  | 'dairy_refrigerated'
  | 'meat_seafood'
  | 'bakery'
  | 'produce'
  | 'prepared_rte'
  | 'juices_nondairy'
  | 'deli'
  | 'baby_formula'
  | 'eggs'
  | 'tofu_alternatives';

export interface DonationSection {
  id: DonationSectionId;
  label: string;
  /** Short context from retail surplus guidance */
  blurb: string;
  category: FoodListing['category'];
  items: string[];
}

/**
 * Populated from retail surplus categories: short shelf life, safety, and donation suitability.
 */
export const DONATION_SECTIONS: DonationSection[] = [
  {
    id: 'dairy_refrigerated',
    label: 'Dairy & refrigerated products',
    blurb: 'Very short shelf lives (often 1–3 weeks) and strict expiration enforcement.',
    category: 'dairy',
    items: [
      'Fresh milk (dairy & plant-based)',
      'Yogurt (individual cups & large tubs)',
      'Cream (whipping, heavy, half-and-half)',
      'Fresh cheese (mozzarella, ricotta, cottage cheese, feta)',
      'Sour cream & crème fraîche',
      'Butter & margarine',
      'Refrigerated dough (biscuits, croissants, pizza dough)',
      'Fresh pasta & tortellini',
      'Refrigerated juices & smoothies',
    ],
  },
  {
    id: 'meat_seafood',
    label: 'Meat, poultry & seafood (fresh/chilled)',
    blurb: 'Safety-driven expiration; typically 1–7 days shelf life.',
    category: 'meat',
    items: [
      'Ground beef, turkey, chicken',
      'Fresh steaks, chops, roasts',
      'Whole or cut chicken/turkey',
      'Fresh sausages & brats',
      'Raw bacon (unfrozen)',
      'Fresh fish fillets & whole fish',
      'Shellfish (shrimp, scallops, oysters, clams)',
      'Deli-sliced meats (ham, turkey, roast beef)',
    ],
  },
  {
    id: 'bakery',
    label: 'Bakery & bread products',
    blurb: 'Stale quickly; “best by” or “sell by” dates are aggressively enforced.',
    category: 'bakery',
    items: [
      'Fresh bread & rolls',
      'Bagels, croissants, English muffins',
      'Cakes, cupcakes, pastries (fresh bakery case)',
      'Donuts & Danishes',
      'Tortillas & flatbreads',
      'Artisan breads (no preservatives)',
      'Bakery cookies & brownies',
    ],
  },
  {
    id: 'produce',
    label: 'Fresh produce',
    blurb: 'High waste due to visual spoilage and short ripeness windows.',
    category: 'produce',
    items: [
      'Berries (strawberries, blueberries, raspberries)',
      'Leafy greens (bagged salads, spinach, lettuce)',
      'Avocados',
      'Bananas (once heavily spotted)',
      'Tomatoes',
      'Mushrooms',
      'Fresh herbs (cilantro, parsley, basil)',
      'Cut fruit & vegetable trays',
      'Bell peppers & cucumbers',
    ],
  },
  {
    id: 'prepared_rte',
    label: 'Prepared & ready-to-eat foods',
    blurb: 'Very short shelf life (usually 1–5 days) after production.',
    category: 'prepared',
    items: [
      'Deli salads (potato, macaroni, coleslaw, chicken/tuna salad)',
      'Sushi',
      'Sandwiches & wraps (pre-packaged)',
      'Fresh soups & sauces (refrigerated)',
      'Salad kits & bowl meals',
      'Rotisserie chicken & heat-and-eat entrees',
      'Fresh pizza (refrigerated, unbaked)',
    ],
  },
  {
    id: 'juices_nondairy',
    label: 'Refrigerated juices & non-dairy alternatives',
    blurb: 'Cold-pressed juices (3–5 day shelf life); refrigerated alternatives expire fast.',
    category: 'pantry',
    items: [
      'Cold-pressed juices',
      'Fresh smoothies',
      'Refrigerated kombucha',
      'Non-dairy milks (refrigerated / fast-expiring)',
    ],
  },
  {
    id: 'deli',
    label: 'Deli counter items',
    blurb: 'Sliced to order or pre-packaged; date-sensitive once packaged.',
    category: 'prepared',
    items: [
      'Sliced meats & cheeses (date reached)',
      'Hummus & dips (refrigerated)',
      'Pimento cheese, olive spreads',
      'Prepared guacamole',
    ],
  },
  {
    id: 'baby_formula',
    label: 'Baby & infant formula',
    blurb: 'Extremely strict — never sold past expiration, even if unopened.',
    category: 'pantry',
    items: [
      'Liquid ready-to-feed formula',
      'Powdered formula (by expiration)',
    ],
  },
  {
    id: 'eggs',
    label: 'Fresh eggs',
    blurb: 'Shell eggs — expiration dates enforced.',
    category: 'produce',
    items: ['Shell eggs'],
  },
  {
    id: 'tofu_alternatives',
    label: 'Fresh tofu & meat alternatives',
    blurb: 'Refrigerated plant-based fresh packs.',
    category: 'prepared',
    items: [
      'Fresh tofu (water-packed)',
      'Tempeh',
      'Refrigerated seitan',
      'Fresh plant-based burgers/sausages (refrigerated packs)',
    ],
  },
];

export function getSectionById(id: DonationSectionId | ''): DonationSection | undefined {
  return DONATION_SECTIONS.find((s) => s.id === id);
}

/** Educational copy: why these products often become surplus at retail */
export const DONATION_WASTE_CONTEXT = {
  intro: 'Why these products often go to waste at retail',
  rows: [
    { reason: 'Short shelf life (1–14 days)', example: 'Milk, fresh meat, sushi' },
    { reason: 'Strict safety / liability rules', example: 'Baby formula, seafood' },
    { reason: 'Visual quality decline before date', example: 'Berries, bagged lettuce' },
    { reason: 'No “second life” (donation restricted)', example: 'Opened deli items, prepared foods' },
    { reason: 'Low demand near expiration', example: 'Fresh dough, high-end cheese' },
  ],
} as const;
