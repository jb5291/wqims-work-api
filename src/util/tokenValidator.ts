/**
 * From https://github.com/AzureAD/microsoft-authentication-library-for-js
 * Making additions to handle token validation for ArcGIS
 */
import { CryptoProvider} from "@azure/msal-node";
import jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";

import { authConfig } from "./secrets";
import { JWTPayload} from "jose";
/**
 * Basic validation for the access token
 */
class TokenValidator {
    authConfig: any;

    private keyClient: JwksClient;

    /**
     *
     * @constructor
     */
    constructor() {
        this.authConfig = authConfig;

        this.keyClient = jwksClient({
            jwksUri: authConfig.msal.jwksUri_1,
        });
    }

    /**
     * Validate the access token returned from MSAL
     * @param {string} rawAccessToken
     * @returns Promise<boolean>
     */
    async validateMSAccessTokenClaims(rawAccessToken: string): Promise<boolean> {
        if (!rawAccessToken) {
            return false;
        }

        let issCheck = false;
        let audCheck = false;
        let expCheck = false;
        let scpCheck = false;
        const now = Math.floor(Date.now() / 1000);

        try {
            const decodedToken = jwt.decode(rawAccessToken, { complete: true });

            if (!decodedToken) {
                throw new Error("Invalid token");
            }

            if ("payload" in decodedToken) {
                const tokenPayload: string | JWTPayload = decodedToken.payload;
                if (typeof tokenPayload === "object") {
                    if ("iss" in tokenPayload && tokenPayload.iss) {
                        issCheck = tokenPayload.iss === authConfig.msal.issuer;
                    }

                    if ("aud" in tokenPayload && tokenPayload.aud) {
                        audCheck = tokenPayload.aud === authConfig.msal.graphEndpoint;
                    }

                    if ("scp" in tokenPayload && tokenPayload.scp) {
                        const scpStr = tokenPayload.scp as string;
                        const scpStrArr = scpStr.split(" ");
                        if (
                            scpStrArr.includes("User.Read") &&
                            scpStrArr.includes("User.Read.All") &&
                            scpStrArr.includes("profile") &&
                            scpStrArr.includes("openid") &&
                            scpStrArr.includes("email") &&
                            scpStrArr.length === 5
                        ) {
                            scpCheck = true;
                        } else {
                            scpCheck = false;
                        }
                    }

                    if ("exp" in tokenPayload && tokenPayload.exp && "iat" in tokenPayload && tokenPayload.iat) {
                        expCheck = tokenPayload.exp >= now && tokenPayload.iat <= now;
                    }
                }
            }
        } catch (error) {
            console.log(error);
            return false;
        }

        return issCheck && audCheck && expCheck && scpCheck;
    }

    static async identifyUser(rawAccessToken: string): Promise<string | null> {
        if (!rawAccessToken) {
            return null;
        }
        try {
            const decodedToken = jwt.decode(rawAccessToken, { complete: true });

            if (!decodedToken) {
                throw new Error("Invalid token");
            }
            if("payload" in decodedToken) {
                const tokenPayload: string | JWTPayload = decodedToken.payload;
                if (typeof tokenPayload === "object") {
                    if ("upn" in tokenPayload && tokenPayload.upn) {
                        return tokenPayload.upn as string;
                    }
                }
            } 
            return null
        } catch (error) {
            console.log(error);
            return null;
        }

    }

    /**
     * Fetches signing keys from the openid-configuration endpoint
     * @param {Object} header: token header
     * @returns {Promise}
     */
    private async getSigningKeys(header: any): Promise<string> {
        return (await this.keyClient.getSigningKey(header.kid)).getPublicKey();
    }
}

export default TokenValidator;
