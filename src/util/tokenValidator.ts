import jose from 'jose';
import { CryptoProvider, IdTokenClaims } from '@azure/msal-node';

import { authConfig } from './secrets';

type accessTokenClaims = IdTokenClaims & {
  scp?: string[];
}