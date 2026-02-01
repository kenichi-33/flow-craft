import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WorkflowEngineService } from '../modules/workflow-engine/workflow-engine.service';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchOperator } from '../modules/search/dto/search-application.dto';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const prisma = app.get(PrismaService);
    const workflowEngineService = app.get(WorkflowEngineService);
    const searchService = app.get(SearchService);

    const testUsername = 'admin';

    const appDef = await prisma.applicationDefinition.findFirst({
      where: { status: 'ACTIVE' },
    });
    if (!appDef) throw new Error('No active application definition found.');
    if (!appDef.formDefinitionId)
      throw new Error('App definition has no form definition.');

    // Get the form definition to find real field IDs
    const formDef = await prisma.formDefinition.findUnique({
      where: { id: appDef.formDefinitionId },
    });
    const schema = formDef?.schema as any;
    const props = schema?.properties || {};

    // Find a number field and a text field
    let amountField = 'amount';
    let reasonField = 'reason';

    console.log('Available form fields:', Object.keys(props).join(', '));

    for (const [key, conf] of Object.entries(props)) {
      const c = conf as any;
      console.log(`Checking field ${key}: type=${c.type}`);
      // "number" component has type "number". "text" component has type "text".
      if (c.type === 'number') amountField = key;
      if (['text', 'textarea', 'email', 'url'].includes(c.type))
        reasonField = key;

      if (c.options) {
        console.log(`Field ${key} has options:`, JSON.stringify(c.options));
      }
    }

    console.log(
      `Using fields - Amount: ${amountField}, Reason: ${reasonField}`,
    );

    const title = `Filter Test ${Date.now()}`;
    // Using simple types to ensure correct mapping
    const inputData: any = {};
    if (amountField === 'amount') inputData.amount = 5000;
    else inputData[amountField] = 5000;

    if (reasonField === 'reason') inputData.reason = 'Verification';
    else inputData[reasonField] = 'Verification';

    console.log(
      `Creating application with inputData: ${JSON.stringify(inputData)}...`,
    );

    const application = await workflowEngineService.startWorkflow({
      applicationDefinitionId: appDef.id,
      applicantId: testUsername,
      title: title,
      inputData: inputData,
    });

    if (!application) throw new Error('Failed to create application');

    console.log(`Application created. ID: ${application.id}`);
    console.log('Waiting for indexing (5 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 1: GT Range
    console.log(`\nTest 1: Filter InputData.${amountField} > 4000`);
    const result1 = await searchService.search({
      filters: [
        {
          field: `inputData.${amountField}`,
          operator: SearchOperator.GT,
          value: 4000,
        },
      ],
    });
    const found1 = result1.items.some((a) => a.id === application.id);
    console.log(found1 ? '✅ SUCCESS' : '❌ FAILURE');
    if (!found1) console.log('Result total:', result1.total);

    // Test 2: Contains String
    console.log(`\nTest 2: Filter InputData.${reasonField} contains "Verif"`);
    const result2 = await searchService.search({
      filters: [
        {
          field: `inputData.${reasonField}`,
          operator: SearchOperator.CONTAINS,
          value: 'Verif',
        },
      ],
    });
    const found2 = result2.items.some((a) => a.id === application.id);
    console.log(found2 ? '✅ SUCCESS' : '❌ FAILURE');
    if (!found2) console.log('Result total:', result2.total);

    // Test 3: EQUALS (Exact match on text field)
    console.log(
      `\nTest 3: Filter InputData.${reasonField} equals "Verification"`,
    );
    const result3 = await searchService.search({
      filters: [
        {
          field: `inputData.${reasonField}`,
          operator: SearchOperator.EQUALS,
          value: 'Verification',
        },
      ],
    });
    const found3 = result3.items.some((a) => a.id === application.id);
    console.log(found3 ? '✅ SUCCESS' : '❌ FAILURE');
    if (!found3) console.log('Result total:', result3.total);

    // Test 4: Not matched
    console.log(
      `\nTest 4: Filter InputData.${amountField} < 1000 (Should NOT find)`,
    );
    const result4 = await searchService.search({
      filters: [
        {
          field: `inputData.${amountField}`,
          operator: SearchOperator.LT,
          value: 1000,
        },
      ],
    });
    const found4 = result4.items.some((a) => a.id === application.id);
    console.log(
      !found4 ? '✅ SUCCESS (Not found)' : '❌ FAILURE (Found unexpectedly)',
    );
    if (found4) console.log('Result total:', result4.total);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
