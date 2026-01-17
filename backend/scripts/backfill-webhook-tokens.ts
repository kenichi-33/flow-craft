
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of webhook tokens...');

  const appDefs = await prisma.applicationDefinition.findMany({
    where: {
      webhookToken: null,
    },
  });

  console.log(`Found ${appDefs.length} application definitions without webhook tokens.`);

  for (const app of appDefs) {
    const token = uuidv4();
    await prisma.applicationDefinition.update({
      where: { id: app.id },
      data: { webhookToken: token },
    });
    console.log(`Updated AppDef ${app.id} (${app.name}) with token: ${token}`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
