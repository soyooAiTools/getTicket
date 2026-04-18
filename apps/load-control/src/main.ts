import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('control');

  const port = process.env.LOAD_CONTROL_PORT ? Number(process.env.LOAD_CONTROL_PORT) : 3001;
  await app.listen(port);
}

void bootstrap();
