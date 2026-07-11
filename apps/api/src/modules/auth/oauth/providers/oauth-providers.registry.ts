import { OAuthProvider } from '@orchestra/schemas';
import { OAuthProviderClient } from '../types/oauth-provider.interface';
import { GoogleProvider } from './google.provider';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OAuthProvidersRegistry {
  private readonly providers: Record<OAuthProvider, OAuthProviderClient>;

  constructor(private readonly google: GoogleProvider) {
    this.providers = {
      google: this.google,
      github: this.google,
    };
  }

  get(provider: OAuthProvider): OAuthProviderClient {
    return this.providers[provider];
  }
}
