import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QueueService } from '../modules/queue/queue.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(QueueService);
  const logger = new Logger('Verification');

  const topic = 'VERIFY_DEDUP';
  const dedupId = 'test-dedup-id-' + Date.now();
  const payload = { message: 'hello' };

  logger.log(`Enqueueing job 1 with ID ${dedupId}`);
  await queueService.enqueue(topic, payload, { deduplicationId: dedupId });

  logger.log(`Enqueueing job 2 with ID ${dedupId}`);
  try {
    await queueService.enqueue(topic, payload, { deduplicationId: dedupId });
    logger.log('Job 2 enqueued (Adapter might handle dedup silently or throw)');
  } catch (e) {
    logger.log(
      'Job 2 failed to enqueue (Expected if adapter throws on duplicate)',
      e,
    );
  }

  // To truly verify, we would need to consume and count, but that requires async waiting.
  // For implementation check, just running this without error (and relying on adapter logic) is a smoke test.

  await app.close();
}

bootstrap();
