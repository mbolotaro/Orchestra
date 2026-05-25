import { Injectable } from '@nestjs/common';
import { testFun } from '@orchestra/schemas';

@Injectable()
export class AppService {
  getHello(): string {
    testFun();
    return 'Hello World!';
  }
}
