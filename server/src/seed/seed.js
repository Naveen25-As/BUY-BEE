import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/buybee';

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

const categories = [
  { name: 'Smartphones', slug: 'smartphones', description: 'Latest phones and accessories' },
  { name: 'Laptops', slug: 'laptops', description: 'Work and gaming laptops' },
  { name: 'Audio', slug: 'audio', description: 'Headphones and speakers' },
  { name: 'Wearables', slug: 'wearables', description: 'Smart watches and bands' },
  { name: 'Home Tech', slug: 'home-tech', description: 'Smart home devices' },
];

const productsTemplate = [
  {
    name: 'Nova X Pro 5G Smartphone',
    brand: 'Nova',
    category: 'smartphones',
    price: 42999,
    originalPrice: 49999,
    stock: 42,
    sku: 'NOVA-XPRO-128',
    tags: ['5g', 'amoled', 'fast-charging'],
    isFeatured: true,
    images: [img('photo-1511707171634-5f897ff02aa9'), img('photo-1592899677977-9e26a281ab24')],
    description:
      '6.7-inch AMOLED display, 128GB storage, 50MP triple camera, and all-day battery with 67W fast charging.',
    specifications: {
      Display: '6.7" AMOLED 120Hz',
      Processor: 'Octa-core 3.0GHz',
      RAM: '8GB',
      Storage: '128GB',
      Battery: '5000mAh',
    },
    salesCount: 128,
  },
  {
    name: 'PixelBook Air M2',
    brand: 'PixelBook',
    category: 'laptops',
    price: 89999,
    originalPrice: 99999,
    stock: 18,
    sku: 'PB-AIR-M2-512',
    tags: ['ultrabook', 'lightweight'],
    isFeatured: true,
    images: [img('photo-1496181133206-80ce9b88a853')],
    description: 'Ultra-light laptop with 14-inch retina display, 16GB RAM, and 18-hour battery life.',
    specifications: { Display: '14" 2.8K', RAM: '16GB', Storage: '512GB SSD', Weight: '1.2kg' },
    salesCount: 64,
  },
  {
    name: 'SoundHive Studio ANC Headphones',
    brand: 'SoundHive',
    category: 'audio',
    price: 7499,
    originalPrice: 9999,
    stock: 85,
    sku: 'SH-ANC-700',
    tags: ['anc', 'wireless'],
    isFeatured: true,
    images: [img('photo-1505740420928-5e560c06d30e')],
    description: 'Premium over-ear headphones with hybrid ANC, 40h battery, and studio-tuned sound.',
    specifications: { Connectivity: 'Bluetooth 5.3', Battery: '40 hours', ANC: 'Hybrid' },
    salesCount: 210,
  },
  {
    name: 'FitTrack Pulse Smartwatch',
    brand: 'FitTrack',
    category: 'wearables',
    price: 12999,
    originalPrice: 15999,
    stock: 56,
    sku: 'FT-PULSE-01',
    tags: ['fitness', 'gps'],
    isFeatured: true,
    images: [img('photo-1523275335684-37898b6baf30')],
    description: 'GPS fitness watch with SpO2, sleep tracking, and 7-day battery.',
    specifications: { Display: '1.4" AMOLED', WaterResistance: '5ATM', GPS: 'Dual-band' },
    salesCount: 97,
  },
  {
    name: 'HomeLink Smart Hub Gen 3',
    brand: 'HomeLink',
    category: 'home-tech',
    price: 5999,
    originalPrice: 6999,
    stock: 33,
    sku: 'HL-HUB-G3',
    tags: ['smart-home', 'automation'],
    isFeatured: false,
    images: [img('photo-1558002038-1055907df827')],
    description: 'Central smart home hub supporting Matter, Zigbee, and Wi-Fi devices.',
    specifications: { Protocols: 'Matter, Zigbee, Wi-Fi', Voice: 'Built-in assistant' },
    salesCount: 45,
  },
  {
    name: 'Galaxy Edge 256GB',
    brand: 'Galaxy',
    category: 'smartphones',
    price: 68999,
    originalPrice: 74999,
    stock: 24,
    sku: 'GAL-EDGE-256',
    tags: ['flagship', 'camera'],
    isFeatured: false,
    images: [img('photo-1610945265064-0e34e5519bbf')],
    description: 'Flagship smartphone with pro-grade camera system and titanium frame.',
    specifications: { Storage: '256GB', Camera: '200MP main', IP: 'IP68' },
    salesCount: 88,
  },
  {
    name: 'ThunderStrike Gaming Laptop',
    brand: 'ThunderStrike',
    category: 'laptops',
    price: 124999,
    originalPrice: 139999,
    stock: 9,
    sku: 'TS-GAME-RTX',
    tags: ['gaming', 'rtx'],
    isFeatured: false,
    images: [img('photo-1603302576837-375698b9edb0')],
    description: 'RTX-powered gaming laptop with 165Hz display and per-key RGB keyboard.',
    specifications: { GPU: 'RTX 4070', RAM: '32GB', Storage: '1TB NVMe' },
    salesCount: 31,
  },
  {
    name: 'BassWave Mini Speaker',
    brand: 'BassWave',
    category: 'audio',
    price: 3499,
    stock: 120,
    sku: 'BW-MINI-01',
    tags: ['portable', 'waterproof'],
    isFeatured: false,
    images: [img('photo-1608043152269-423dbba4e7e1')],
    description: 'Compact waterproof speaker with punchy bass and 12-hour playtime.',
    specifications: { Battery: '12 hours', IP: 'IP67', Weight: '540g' },
    salesCount: 156,
  },
  {
    name: 'ZenBand Lite Fitness Tracker',
    brand: 'ZenBand',
    category: 'wearables',
    price: 2999,
    originalPrice: 3999,
    stock: 4,
    sku: 'ZB-LITE-02',
    tags: ['budget', 'fitness'],
    isFeatured: false,
    images: [img('photo-1579586337278-3befd40fd17a')],
    description: 'Lightweight fitness band with heart-rate monitoring and sleep insights.',
    specifications: { Battery: '10 days', Display: '1.1" OLED' },
    salesCount: 302,
  },
  {
    name: 'Lumen Smart Bulb Pack (4)',
    brand: 'Lumen',
    category: 'home-tech',
    price: 2199,
    stock: 0,
    sku: 'LM-BULB-4PK',
    tags: ['lighting', 'wifi'],
    isFeatured: false,
    images: [img('photo-1565814636199-ae8133055c1c')],
    description: 'Wi-Fi smart bulbs with millions of colors and scheduling support.',
    specifications: { Wattage: '9W', Connectivity: '2.4GHz Wi-Fi', Pack: '4 bulbs' },
    salesCount: 77,
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Clearing collections...');
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Coupon.deleteMany({}),
  ]);

  const categoryDocs = await Category.insertMany(categories);
  const catMap = Object.fromEntries(categoryDocs.map((c) => [c.slug, c._id]));

  await User.create([
    {
      name: 'Buy Bee Admin',
      email: 'admin@buybee.com',
      phone: '9876543210',
      password: 'Admin@12345',
      role: 'admin',
    },
    {
      name: 'Demo Customer',
      email: 'customer@buybee.com',
      phone: '9123456780',
      password: 'Customer@123',
      role: 'customer',
      addresses: [
        {
          fullName: 'Demo Customer',
          phone: '9123456780',
          addressLine: '42 Tech Park Road, Block B',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
          addressType: 'home',
          isDefault: true,
        },
      ],
    },
  ]);

  const products = productsTemplate.map((p) => {
    const { category, ...rest } = p;
    return {
      ...rest,
      category: catMap[category],
      rating: { rating: 4.2 + Math.random() * 0.7, numReviews: Math.floor(Math.random() * 80) + 5 },
    };
  });
  await Product.insertMany(products);

  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await Coupon.insertMany([
    {
      code: 'WELCOME10',
      description: '10% off for new customers',
      discountType: 'percent',
      discountValue: 10,
      minOrderAmount: 999,
      maxDiscount: 1500,
      expiresAt: in30Days,
      usageLimit: 500,
      isActive: true,
    },
    {
      code: 'FLAT500',
      description: 'Flat ₹500 off on orders above ₹5000',
      discountType: 'fixed',
      discountValue: 500,
      minOrderAmount: 5000,
      expiresAt: in30Days,
      usageLimit: 200,
      isActive: true,
    },
  ]);

  console.log('Seed complete.');
  console.log('Admin: admin@buybee.com / Admin@12345');
  console.log('Customer: customer@buybee.com / Customer@123');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
