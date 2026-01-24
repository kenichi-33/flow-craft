import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchService } from '../src/modules/search/search.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ReindexScript');
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const searchService = app.get(SearchService);

  const applications = await prisma.application.findMany({
    select: { id: true, applicationNumber: true },
    orderBy: { createdAt: 'desc' },
  });

  logger.log(`Found ${applications.length} applications to reindex.`);

  for (const [index, appData] of applications.entries()) {
    try {
      const fullApp = await prisma.application.findUnique({ where: { id: appData.id } });
      if (fullApp) {
        await searchService.indexApplication(fullApp);
        logger.log(`[${index + 1}/${applications.length}] Indexed app #${appData.applicationNumber} (${appData.id})`);
      }
    } catch (error) {
      logger.error(`Failed to index app #${appData.applicationNumber}: ${error.message}`);
    }
  }

  logger.log('Reindexing complete.');
  await app.close();
}

bootstrap();
