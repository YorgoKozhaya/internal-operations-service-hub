import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadEnv } from './load-env';

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configuredOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({
    origin: configuredOrigin || [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });

  const frontendDist = process.env.FRONTEND_DIST?.trim()
    || join(__dirname, '..', '..', 'frontend', 'dist');

  if (existsSync(join(frontendDist, 'index.html'))) {
    app.useStaticAssets(frontendDist);
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
