import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { sql } from 'drizzle-orm';

const SEED_PRODUCTS = [
  {
    id: 'prod_001',
    name: 'Running Shoes - UltraBoost X',
    category: 'sports',
    priceInr: 249900, // ₹2,499.00
    stock: 12,
    description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper. Ideal for daily runs and marathons.',
  },
  {
    id: 'prod_002',
    name: 'Yoga Mat - Premium Cork',
    category: 'fitness',
    priceInr: 149900, // ₹1,499.00
    stock: 25,
    description: 'Eco-friendly cork yoga mat with natural rubber base. Non-slip surface, 6mm thick for joint comfort.',
  },
  {
    id: 'prod_003',
    name: 'Wireless Earbuds - SoundPro 500',
    category: 'electronics',
    priceInr: 399900, // ₹3,999.00
    stock: 8,
    description: 'Active noise cancelling wireless earbuds with 30-hour battery life. IPX5 water resistant.',
  },
  {
    id: 'prod_004',
    name: 'Resistance Bands Set (5-Pack)',
    category: 'fitness',
    priceInr: 79900, // ₹799.00
    stock: 50,
    description: 'Set of 5 resistance bands with varying tension levels. Includes carry bag and exercise guide.',
  },
  {
    id: 'prod_005',
    name: 'Cricket Bat - Kashmir Willow',
    category: 'sports',
    priceInr: 349900, // ₹3,499.00
    stock: 6,
    description: 'Professional grade Kashmir willow cricket bat. Full size, pre-knocked and ready to play.',
  },
  {
    id: 'prod_006',
    name: 'Protein Powder - Whey Isolate 1kg',
    category: 'nutrition',
    priceInr: 189900, // ₹1,899.00
    stock: 30,
    description: '100% whey protein isolate. 25g protein per serving. Chocolate flavour. No added sugar.',
  },
  {
    id: 'prod_007',
    name: 'Smart Watch - FitTrack Pro',
    category: 'electronics',
    priceInr: 599900, // ₹5,999.00
    stock: 15,
    description: 'Fitness smartwatch with heart rate monitor, GPS, SpO2 sensor. 7-day battery life. AMOLED display.',
  },
  {
    id: 'prod_008',
    name: 'Dumbbells - Adjustable 20kg Set',
    category: 'fitness',
    priceInr: 449900, // ₹4,499.00
    stock: 10,
    description: 'Adjustable dumbbell set from 2.5kg to 20kg. Compact design, chrome plated steel.',
  },
  {
    id: 'prod_009',
    name: 'Football - FIFA Match Ball',
    category: 'sports',
    priceInr: 199900, // ₹1,999.00
    stock: 20,
    description: 'Official size and weight match football. Thermal bonded panels. Professional grade.',
  },
  {
    id: 'prod_010',
    name: 'Cycling Jersey - Aero Fit',
    category: 'sports',
    priceInr: 129900, // ₹1,299.00
    stock: 18,
    description: 'Aerodynamic cycling jersey with 3 rear pockets. UPF 50+ sun protection. Moisture wicking.',
  },
  {
    id: 'prod_011',
    name: 'Bluetooth Speaker - BassBox 360',
    category: 'electronics',
    priceInr: 299900, // ₹2,999.00
    stock: 22,
    description: '360-degree sound bluetooth speaker. 20W output, 12-hour battery. IP67 waterproof.',
  },
  {
    id: 'prod_012',
    name: 'Jump Rope - Speed Pro',
    category: 'fitness',
    priceInr: 49900, // ₹499.00
    stock: 40,
    description: 'Ball-bearing speed jump rope with adjustable steel cable. Ergonomic handles.',
  },
  {
    id: 'prod_013',
    name: 'Badminton Racket - Titanium Pro',
    category: 'sports',
    priceInr: 279900, // ₹2,799.00
    stock: 14,
    description: 'Titanium frame badminton racket. Ultra-light 85g. Includes full cover.',
  },
  {
    id: 'prod_014',
    name: 'Multivitamin Tablets - 90 Pack',
    category: 'nutrition',
    priceInr: 69900, // ₹699.00
    stock: 60,
    description: 'Complete multivitamin with 23 essential vitamins and minerals. 90-day supply.',
  },
  {
    id: 'prod_015',
    name: 'Trail Running Shoes - Mountain Grip',
    category: 'sports',
    priceInr: 549900, // ₹5,499.00
    stock: 0, // OUT OF STOCK — for testing the rejection scenario
    description: 'Technical trail running shoes with Vibram outsole. Waterproof GORE-TEX membrane.',
  },
  {
    id: 'prod_999',
    name: 'Rogue AI Gaming Laptop',
    category: 'electronics',
    priceInr: 10000000, // ₹1,00,000.00
    stock: 5,
    description: 'High end laptop used to test the failure constraints.',
  },
];

export async function seedProducts(): Promise<void> {
  logger.info('Seeding products...');

  // Clear existing products
  await db.delete(products);

  // Insert seed data
  await db.insert(products).values(SEED_PRODUCTS);

  logger.info(`✅ Seeded ${SEED_PRODUCTS.length} products (1 out-of-stock for testing)`);
}

// Run directly if executed as a script
const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seedProducts()
    .then(() => {
      logger.info('Seed complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}
