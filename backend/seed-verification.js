
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding failed task...');

    // Find or Create App Definition
    let appDef = await prisma.applicationDefinition.findFirst();
    if (!appDef) {
        // Ideally we need seed data. If no app def, we skip or create minimal.
        console.log('No App Definition found, skipping.');
        return;
    }

    // Create Application
    const app = await prisma.application.create({
        data: {
            applicationDefinitionId: appDef.id,
            formDefinitionId: appDef.formDefinitionId,
            flowDefinitionId: appDef.flowDefinitionId,
            applicantId: 'user1',
            status: 'IN_PROGRESS',
            inputData: { title: 'Test Application' },
            applicationNumber: 9999,
        }
    });

    // Create Failed Service Task
    await prisma.serviceTask.create({
        data: {
            applicationId: app.id,
            stepId: 'node_test_fail',
            type: 'apiCall',
            status: 'FAILED',
            error: 'Simulated API Error for Testing',
            retries: 0
        }
    });

    console.log(`Created Application ID: ${app.id}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
