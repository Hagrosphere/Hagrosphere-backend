import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Hagrosphere database...');

  // ── Super Admin ───────────────────────────────────────────
  const superAdminPass = await argon2.hash('Admin@Hagrosphere1!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hagrosphere.com' },
    update: {},
    create: {
      email: 'admin@hagrosphere.com',
      password: superAdminPass,
      firstName: 'Hagrosphere',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
      isEmailVerified: true,
    },
  });

  console.log('✅ Super admin created:', superAdmin.email);

  // ── Equipment Categories ──────────────────────────────────
  const equipmentCategories = [
    { name: 'Tractors', slug: 'tractors', description: 'All types of tractors for farm work' },
    { name: 'Harvesters', slug: 'harvesters', description: 'Combine harvesters and reapers' },
    { name: 'Irrigation Systems', slug: 'irrigation-systems', description: 'Drip, sprinkler, and flood irrigation' },
    { name: 'Planting Equipment', slug: 'planting-equipment', description: 'Seeders and planters' },
    { name: 'Storage & Processing', slug: 'storage-processing', description: 'Silos, dryers, and processing machines' },
    { name: 'Transport', slug: 'transport', description: 'Farm trucks and trailers' },
    { name: 'Hand Tools', slug: 'hand-tools', description: 'Manual and power hand tools' },
    { name: 'Drones', slug: 'drones', description: 'Agricultural drones for spraying and surveillance' },
  ];

  for (const cat of equipmentCategories) {
    await prisma.equipmentCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('✅ Equipment categories seeded');

  // ── Job Categories ────────────────────────────────────────
  const jobCategories = [
    { name: 'Farm Management', slug: 'farm-management' },
    { name: 'Agronomy', slug: 'agronomy' },
    { name: 'Agricultural Engineering', slug: 'agricultural-engineering' },
    { name: 'Supply Chain & Logistics', slug: 'supply-chain' },
    { name: 'Sales & Marketing', slug: 'sales-marketing' },
    { name: 'Finance & Accounting', slug: 'finance-accounting' },
    { name: 'Research & Development', slug: 'research-development' },
    { name: 'Technology & IT', slug: 'technology-it' },
  ];

  for (const cat of jobCategories) {
    await prisma.jobCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('✅ Job categories seeded');

  // ── Article Tags ──────────────────────────────────────────
  const tags = [
    { name: 'Farming Tips', slug: 'farming-tips' },
    { name: 'Technology', slug: 'technology' },
    { name: 'Investment', slug: 'investment' },
    { name: 'Market Trends', slug: 'market-trends' },
    { name: 'Sustainability', slug: 'sustainability' },
    { name: 'Diaspora', slug: 'diaspora' },
    { name: 'Policy', slug: 'policy' },
    { name: 'Success Stories', slug: 'success-stories' },
  ];

  for (const tag of tags) {
    await prisma.articleTag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  console.log('✅ Article tags seeded');

  // ── Site Settings ─────────────────────────────────────────
  const settings = [
    { key: 'site_name', value: 'Hagrosphere', type: 'string', group: 'general' },
    { key: 'site_tagline', value: 'Connecting Africa\'s Agricultural Ecosystem', type: 'string', group: 'general' },
    { key: 'contact_email', value: 'contact@hagrosphere.com', type: 'string', group: 'general' },
    { key: 'contact_phone', value: '+234 800 000 0000', type: 'string', group: 'general' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'general' },
    { key: 'social_twitter', value: 'https://twitter.com/hagrosphere', type: 'string', group: 'social' },
    { key: 'social_linkedin', value: 'https://linkedin.com/company/hagrosphere', type: 'string', group: 'social' },
    { key: 'social_instagram', value: 'https://instagram.com/hagrosphere', type: 'string', group: 'social' },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Site settings seeded');
  console.log('\n🎉 Database seeding complete!');
  console.log('📧 Admin email: admin@hagrosphere.com');
  console.log('🔑 Admin password: Admin@Hagrosphere1!');
  console.log('⚠️  Change the admin password immediately after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
