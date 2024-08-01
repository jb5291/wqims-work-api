/**
 * From https://github.com/AzureAD/microsoft-authentication-library-for-js
 * Making additions to handle token validation for ArcGIS
 */
import {createRemoteJWKSet, jwtVerify, GetKeyFunction, JWSHeaderParameters, FlattenedJWSInput, compactVerify} from 'jose';
import { CryptoProvider, IdTokenClaims } from '@azure/msal-node';
import jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';

import { authConfig } from './secrets';

type accessTokenClaims = IdTokenClaims & {
  scp?: string[];
}

/**
 * Basic validation for the access token
 */
class TokenValidator {
  authConfig: any;

  private cryptoProvider: CryptoProvider;
  private keyClient: JwksClient;// GetKeyFunction<JWSHeaderParameters, FlattenedJWSInput>;

  /**
   * 
   * @constructor
   */
  constructor() {
    this.authConfig = authConfig;
    this.cryptoProvider = new CryptoProvider();

    this.keyClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/common/discovery/v2.0/keys`
    })
    
    /* createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/common/discovery/keys`)
    ); */
  }

  /**
   * Validate the access token returned from MSAL
   * @param {string} rawAccessToken 
   * @returns Promise<boolean>
   */
  async validateMSAccessToken(rawAccessToken: string): Promise<boolean> {
    if (!rawAccessToken) {
      return false;
    }

    let decodedToken; // decode to get kid parameter in header

    try {
        decodedToken = jwt.decode(rawAccessToken, { complete: true });
    } catch (error) {
        console.log(error);
        return false;
    }

    let keys; // obtain signing keys from discovery endpoint

    try {
        keys = decodedToken && await this.getSigningKeys(decodedToken.header);
    } catch (error) {
        console.log(error);
        return false;
    }

    try {
        // verify the signature at header section using keys
        let verifiedToken = keys && jwt.verify(rawAccessToken, keys);
        return !!verifiedToken;
    } catch (error) {
        console.log(error);
        return false;
    }

    try {
      // const decoded = await compactVerify(rawAccessToken, this.keyClient);
      /* const { payload, protectedHeader } = await jwtVerify(rawAccessToken, this.keyClient, {
        algorithms: ['RS256'],
        issuer: `https://sts.windows.net/${this.authConfig.msal.tenant}/`,
        audience: this.authConfig.msal.graphEndpoint,
        clockTolerance: '5s'
      }) */
    } catch (error) {
      console.error('Error decoding token:', error);
      return false;
    }

    return true;
  }

  /**
   * Validate the access token returned from ArcGIS
   * @param {string} rawAccessToken 
   * @returns Promise<boolean>
   */
  async validateArcGISToken(rawAccessToken: string, idTokenClaims: IdTokenClaims): Promise<boolean> {
    return false;
  };

  /**
     * Fetches signing keys from the openid-configuration endpoint
     * @param {Object} header: token header
     * @returns {Promise}
     */
  private async getSigningKeys(header: any): Promise<string> {
    return (await this.keyClient.getSigningKey(header.kid)).getPublicKey();
};

  // async getUserInfo()
}

export default TokenValidator;