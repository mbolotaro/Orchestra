import { Test, TestingModule } from '@nestjs/testing';
import { AuthLogsService } from '../auth-logs.service';

describe('AuthLogsService', () => {
  let service: AuthLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthLogsService],
    }).compile();

    service = module.get<AuthLogsService>(AuthLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
