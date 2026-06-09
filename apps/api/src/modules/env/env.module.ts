import path from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppEnv, EnvSchema } from './env.schema';
import { EnvService } from './env.service';

function validate(raw: Record<string, unknown>): AppEnv {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../../../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
      validate,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}