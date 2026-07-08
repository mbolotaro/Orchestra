import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';
import { AppException } from '../../../common/exceptions/app.exception';
import { AccessTokenScope } from '../tokens/types/access-token.type';

export class ScopeUpgradeNeededException extends AppException {
  constructor(scopes: {
    currentScope: AccessTokenScope;
    requiredScope: AccessTokenScope;
  }) {
    super(
      ErrorCode.ScopeUpgradeNeeded,
      HttpStatus.FORBIDDEN,
      'Sessão precisa ser renovada.',
      scopes,
    );
  }
}
