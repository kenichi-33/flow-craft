import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const formDef = await prisma.formDefinition.findFirst({
    where: {
      schema: {
        path: ['properties'],
        string_contains: 'options', // Try to find one with options
      },
    },
  });

  if (formDef) {
    console.log('Found FormDefinition:', formDef.id);
    console.log('Schema:', JSON.stringify(formDef.schema, null, 2));
  } else {
    // If not found by query, just get any and check manually or create a mock one structure logic
    const anyDef = await prisma.formDefinition.findFirst();
    if (anyDef) {
      console.log('FormDefinition:', JSON.stringify(anyDef.schema, null, 2));
    } else {
      console.log('No FormDefinition found.');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
