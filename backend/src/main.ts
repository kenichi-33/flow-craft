import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // ENABLE_API=false の場合のみスタンドアロンモード（Worker/Executorのみ）として起動
  const isStandalone = process.env.ENABLE_API === 'false';

  if (isStandalone) {
    await NestFactory.createApplicationContext(AppModule);
    // Standalone context initialized
    // It will automatically run OnModuleInit for imported modules (Worker/Executor)
    console.log('Standalone Mode (Worker/Executor): Started successfully');
    // NestJS ApplicationContext stays alive if there are active listeners (e.g. queue listeners).
  } else {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(process.env.PORT ?? 3000);
  }
}
void bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
