import { prisma } from '../src/lib/prisma';
import { demoPetsEnabled, seedAccountPets, seedCredentialAccounts } from './seed-accounts';

try {
  const ids = await seedCredentialAccounts();
  console.log(`Seeded ${ids.size} credential accounts from the test environment.`);
  if (demoPetsEnabled()) {
    const created = await seedAccountPets(ids);
    console.log(`Seeded demo pets (${created} new).`);
  }
} finally {
  await prisma.$disconnect();
}
