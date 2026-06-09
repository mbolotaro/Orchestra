import { Test, TestingModule } from '@nestjs/testing';
import { AuthCookieService } from '../auth-cookie.service';

describe('AuthCookieService', () => {
  let service: AuthCookieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthCookieService],
    }).compile();

    service = module.get<AuthCookieService>(AuthCookieService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
