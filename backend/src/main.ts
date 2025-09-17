import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { envConfig } from './config/env.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const serverConfig = envConfig.server;
  const appConfig = envConfig.app;

  app.enableCors({
    origin: serverConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(serverConfig.port);

  logger.log(`Application started in ${appConfig.nodeEnv} mode`);
  logger.log(`Server listening on port ${serverConfig.port}`);
  logger.log(`CORS enabled for origins: ${serverConfig.corsOrigins.join(', ')}`);
}

bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
