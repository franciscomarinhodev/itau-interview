import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { runInCluster } from './cluster';
import { setupSwagger } from './config/swagger.config';
import { validationConfig } from './config/validation.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const apiPrefix = 'api/v1';
  app.use(helmet({ strictTransportSecurity: false }));
  app.setGlobalPrefix(apiPrefix);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe(validationConfig));
  setupSwagger(app, apiPrefix);

  await app.listen(process.env.PORT ?? 3000);
}

if (process.env.CLUSTER_MODE === 'true') {
  runInCluster(bootstrap);
} else {
  bootstrap();
}
