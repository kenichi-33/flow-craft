
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WorkflowEngineService } from '../modules/workflow-engine/workflow-engine.service';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Verification Script for Keyword Search on Labels & Meta
 * 
 * Objectives:
 * 1. Verify searching by "Label" of a Select/Radio/Checkbox field works.
 * 2. Verify searching by "Status Label" (e.g. 進行中) works.
 * 3. Verify searching by "Applicant Name" works (simulated by updating applicantInfo).
 * 4. Verify searching by "Application Number" works.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const prisma = app.get(PrismaService);
    const workflowEngineService = app.get(WorkflowEngineService);
    const searchService = app.get(SearchService);

    console.log('--- Starting Keyword Search Verification ---');

    // 1. Find a form with an options-based field to test labels
    const appDef = await prisma.applicationDefinition.findFirst({
      where: { status: 'ACTIVE' },
      include: { formDefinition: true },
    });
    
    if (!appDef || !appDef.formDefinition) {
      console.error('❌ No active ApplicationDefinition found to test.');
      return;
    }

    const schema = appDef.formDefinition.schema as any;
    let selectField = '';
    let targetOption = { label: '', value: '' };

    // Find the first field that has options
    for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
        if (prop.options && Array.isArray(prop.options) && prop.options.length > 0) {
            selectField = key;
            targetOption = prop.options[0];
            break;
        }
    }

    if (!selectField) {
        console.warn('⚠️ No Select/Radio/Checkbox field found with options. Skipping Label search test part.');
    } else {
        console.log(`ℹ️ Found option field '${selectField}' with label '${targetOption.label}' (value: ${targetOption.value})`);
    }

    // 2. Create Application
    const uniqueId = Date.now();
    const title = `Keyword Test ${uniqueId}`;
    const inputData: any = {};
    if (selectField) {
        inputData[selectField] = targetOption.value;
    }

    console.log(`Creating application '${title}'...`);
    const application = await workflowEngineService.startWorkflow({
      applicationDefinitionId: appDef.id,
      applicantId: 'admin',
      title: title,
      inputData: inputData,
    });
    
    if (!application) throw new Error('Failed to create application');

    console.log(`✅ App Created: ${application.id} (No. ${application.applicationNumber})`);

    // 3. Inject Fake Applicant Info & Re-index to test Name resolution
    // We update the record directly then force re-index.
    const fakeLastName = `Yamada${uniqueId}`;
    const fakeFirstName = 'Taro';
    const fakeFullName = `${fakeLastName} ${fakeFirstName}`;
    
    await prisma.application.update({
        where: { id: application.id },
        data: {
            applicantInfo: {
                username: 'admin',
                firstName: fakeFirstName,
                lastName: fakeLastName,
                email: 'test@example.com',
                department: 'Testing Dept'
            }
        }
    });
    
    // Fetch fresh app to pass to indexer
    const updatedApp = await prisma.application.findUnique({ where: { id: application.id } });
    if (updatedApp) {
        console.log('Forcing Re-index with new Applicant Info...');
        await searchService.indexApplication(updatedApp);
    }

    console.log('Waiting 5s for indexing consistency...');
    await new Promise(r => setTimeout(r, 5000));

    // --- EXECUTE TESTS ---

    // TEST 1: Option Label
    if (selectField) {
        process.stdout.write(`Test 1: Search by Label '${targetOption.label}' ... `);
        const res = await searchService.search({ keyword: targetOption.label });
        const found = res.items.some(a => a.id === application.id);
        if (found) console.log('✅ SUCCESS');
        else console.log(`❌ FAILED (Total results: ${res.total})`);
    }

    // TEST 2: Status Label (IN_PROGRESS -> 進行中)
    // The created app should be IN_PROGRESS (or whatever startWorkflow sets).
    // Usually startWorkflow -> IN_PROGRESS or DRAFT? 
    // WorkflowEngineService.startWorkflow sets status to IN_PROGRESS usually (if autostart).
    if (application.status === 'IN_PROGRESS') {
        process.stdout.write(`Test 2: Search by Status Label '進行中' ... `);
        const res = await searchService.search({ keyword: '進行中' });
        const found = res.items.some(a => a.id === application.id);
        if (found) console.log('✅ SUCCESS');
        else console.log(`❌ FAILED (Total results: ${res.total})`);
    } else {
        console.log(`Skipping Status Test (App status is ${application.status})`);
    }

    // TEST 3: Applicant Name
    process.stdout.write(`Test 3: Search by Applicant Name '${fakeLastName}' ... `);
    const resName = await searchService.search({ keyword: fakeLastName });
    const foundName = resName.items.some(a => a.id === application.id);
    if (foundName) console.log('✅ SUCCESS');
    else console.log(`❌ FAILED (Total results: ${resName.total})`);
    
    // TEST 4: Application Number
    process.stdout.write(`Test 4: Search by App Number '${application.applicationNumber}' ... `);
    const resNum = await searchService.search({ keyword: String(application.applicationNumber) });
    const foundNum = resNum.items.some(a => a.id === application.id);
    if (foundNum) console.log('✅ SUCCESS');
    else console.log(`❌ FAILED (Total results: ${resNum.total})`);

  } catch (err) {
    console.error('Script Error:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
