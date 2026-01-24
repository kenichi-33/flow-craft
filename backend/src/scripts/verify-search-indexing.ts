
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WorkflowEngineService } from '../modules/workflow-engine/workflow-engine.service';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from '../modules/search/dto/search-application.dto';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const prisma = app.get(PrismaService);
    const workflowEngineService = app.get(WorkflowEngineService);
    const searchService = app.get(SearchService);

    // Use 'admin' as a fallback test user
    const testUsername = 'admin'; 
    console.log(`Using test user: ${testUsername}`);

    console.log('Finding an active application definition...');
    const appDef = await prisma.applicationDefinition.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (!appDef) {
      throw new Error('No active application definition found. Please publish an application first.');
    }
    console.log(`Using application definition: ${appDef.name} (${appDef.id})`);

    const title = `E2E Search Test ${Date.now()}`;
    console.log(`Starting workflow with title: "${title}"...`);

    // Start a new workflow (creates application in IN_PROGRESS state)
    const application = await workflowEngineService.startWorkflow({
      applicationDefinitionId: appDef.id,
      applicantId: testUsername,
      title: title,
      inputData: {},
    });

    if (!application) {
        throw new Error('Failed to create application');
    }

    console.log(`Application created and workflow started. ID: ${application.id}`);

    // Wait for indexing (Elasticsearch might take a moment + Kafka consumer latency)
    console.log('Waiting for indexing (10 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Verify search
    console.log('Searching for the application...');

    // Debug ES content
    console.log('--- Debugging Elasticsearch ---');
    try {
        const indices = await fetch('http://elasticsearch:9200/_cat/indices?v');
        console.log('Indices:\n', await indices.text());
        
        const allDocs = await fetch('http://elasticsearch:9200/_search?q=*&size=20&pretty');
        console.log('All Documents:\n', await allDocs.text());
    } catch (e) {
        console.error('ES Debug failed:', e);
    }
    console.log('-----------------------------');

    const query: SearchQueryDto = {
      keyword: title,
      page: 1,
      limit: 10,
      sort: {
        field: 'createdAt',
        order: 'desc',
      },
    };

    const result = await searchService.search(query);

    console.log(`Search result total: ${result.total}`);
    
    // Check if our application is in the results
    const found = result.items.some((a) => a.id === application.id);

    if (found) {
      console.log('✅ SUCCESS: Application found in search index!');
      const foundItem = result.items.find((a) => a.id === application.id);
      console.log('Found item:', foundItem?.title);
    } else {
      console.error('❌ FAILURE: Application NOT found in search index.');
      console.log('Returned items:', result.items.map(i => `${i.id}: ${i.title}`));
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
