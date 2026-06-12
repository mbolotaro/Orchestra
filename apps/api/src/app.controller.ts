import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor() {}

  @Public()
  @Get()
  getPing(): string {
    return 'pong';
  }
}
