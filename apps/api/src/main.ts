import process from 'node:process';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { EnvService } from './modules/env/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const env = app.get(EnvService);

  app.enableCors({
    origin: env.get('FRONTEND_URL'),
    credentials: true,
  });

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Orchestra API')
    .setVersion('0.0.1')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
