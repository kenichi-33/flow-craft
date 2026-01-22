import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ReindexScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const prisma = app.get(PrismaService);
    const searchService = app.get(SearchService);

    logger.log('Starting re-indexing of all applications...');

    const applications = await prisma.application.findMany({
      select: { id: true },
    });

    logger.log(`Found ${applications.length} applications to index.`);

    let count = 0;
    for (const { id } of applications) {
      const fullApp = await prisma.application.findUnique({ where: { id } });
      if (fullApp) {
        await searchService.indexApplication(fullApp);
        count++;
        if (count % 10 === 0) {
          logger.log(`Indexed ${count}/${applications.length} applications...`);
        }
      }
    }

    logger.log(`Re-indexing completed. Processed ${count} applications.`);
  } catch (error) {
    logger.error('Re-indexing failed', error);
  } finally {
    await app.close();
  }
}

bootstrap();
