
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to resolve labels from schema and data
function resolveSearchMeta(schema: any, data: any): Record<string, string> {
  const meta: Record<string, string> = {};
  if (!schema?.properties || !data) return meta;

  for (const [key, value] of Object.entries(data)) {
    const prop = schema.properties[key];
    if (!prop) continue;

    // Handle Select/Radio with 'oneOf' or 'enum'
    if (prop.oneOf) {
      const option = prop.oneOf.find((o: any) => o.const === value);
      if (option && option.title) {
        meta[`${key}_label`] = option.title;
      }
    } else if (prop.enum && prop.enumNames) {
      const index = prop.enum.indexOf(value);
      if (index !== -1 && prop.enumNames[index]) {
        meta[`${key}_label`] = prop.enumNames[index];
      }
    }
    // Handle Checkbox (array)
    else if (prop.type === 'array' && Array.isArray(value)) {
        // Implementation for array provided later if needed
    }
  }
  return meta;
}

// Helper to generate fullText
function generateFullText(data: any, meta: any): string {
    const parts: string[] = [];
    
    // Add raw values (excluding some types if needed)
    const addValues = (obj: any) => {
        if (!obj) return;
        if (typeof obj === 'object') {
            Object.values(obj).forEach(v => addValues(v));
        } else if (typeof obj === 'string' || typeof obj === 'number') {
            parts.push(String(obj));
        }
    };

    addValues(data);
    addValues(meta);

    return parts.join(' ');
}

async function main() {
  console.log('Starting migration of search data...');
  const apps = await prisma.application.findMany({
    include: {
      formDefinition: true,
    },
  });

  console.log(`Found ${apps.length} applications.`);

  for (const app of apps) {
    try {
      const schema = app.formDefinition.schema as any;
      const data = app.inputData as any;

      if (!data) continue;

      const searchMeta = resolveSearchMeta(schema, data);
      const fullText = generateFullText(data, searchMeta);

      await prisma.application.update({
        where: { id: app.id },
        data: {
          searchMeta,
          fullText,
        },
      });
      console.log(`Updated app ${app.applicationNumber}`);
    } catch (e) {
      console.error(`Failed to update app ${app.id}:`, e);
    }
  }

  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
