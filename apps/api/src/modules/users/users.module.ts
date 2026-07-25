import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MyUserController } from './my-user.controller';
import { TokensModule } from '../auth/tokens/tokens.module';
import { AuditLogModule } from '../auth/audit-log/audit-log.module';
import { AuthCookieModule } from '../auth/cookie/auth-cookie.module';
import { UsersCleanupModule } from './cleanup/users-cleanup.module';

@Module({
  imports: [TokensModule, AuditLogModule, AuthCookieModule, UsersCleanupModule],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [MyUserController],
})
export class UsersModule {}
