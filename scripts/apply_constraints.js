const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync('prisma/migrations/20260213_add_check_constraints/migration.sql', 'utf8');

  // Split by ALTER TABLE statements
  const blocks = sql.split(/(?=ALTER TABLE)/g)
    .map(s => s.trim())
    .filter(s => s.startsWith('ALTER TABLE'));

  for (const block of blocks) {
    try {
      await prisma.$executeRawUnsafe(block);
      console.log('OK:', block.substring(0, 50) + '...');
    } catch (e) {
      console.log('Error:', e.meta?.message || e.message?.substring(0, 100));
    }
  }

  await prisma.$disconnect();
  console.log('Done');
}

main();
