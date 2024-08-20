import { AuthenticationResult, AuthError, ConfidentialClientApplication, AccountInfo } from "@azure/msal-node";
import {
  IFeature,
  IQueryFeaturesResponse,
  IQueryRelatedResponse,
  IQueryResponse,
  queryFeatures,
  queryRelated,
} from "@esri/arcgis-rest-feature-service";
import { ApplicationCredentialsManager } from "@esri/arcgis-rest-request";
import { Client } from "@microsoft/microsoft-graph-client";
import express, { Router } from "express";
import { base64url, EncryptJWT, jwtDecrypt, JWTDecryptResult, JWTPayload, JWTVerifyResult, errors } from "jose";

import { actionLogger, appLogger } from "../util/appLogger";
import { authConfig, BASEURL, FE_FULL_URL, PROXY_LISTEN_PORT } from "../util/secrets";
import TokenValidator from "../util/tokenValidator";
import cookieParser from "cookie-parser";

export const authRouter: Router = express.Router();
authRouter.use(cookieParser());

const tokenValidator: TokenValidator = new TokenValidator();
const cca: ConfidentialClientApplication = new ConfidentialClientApplication({
  auth: {
    clientId: authConfig.msal.id,
    authority: `${authConfig.msal.authority}/${authConfig.msal.tenant}`,
    clientSecret: authConfig.msal.secret,
  },
});
export const gisCredentialManager: ApplicationCredentialsManager = new ApplicationCredentialsManager({
  clientId: authConfig.arcgis.id,
  clientSecret: authConfig.arcgis.secret,
});

authRouter.post("/login", (req, res) => {
  cca
    .getAuthCodeUrl({
      scopes: [`${authConfig.msal.graphEndpoint}/.default`],
      redirectUri: authConfig.msal.redirectUri,
    })
    .then((url: string) => {
      res.json({ redirectUrl: url});
    })
    .catch((error: AuthError) => appLogger.error(error.message));
});

authRouter.get("/callback", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    const response: AuthenticationResult = await cca.acquireTokenByCode({
      code: req.query.code as string,
      redirectUri: authConfig.msal.redirectUri,
      scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    });

    if (await tokenValidator.validateMSAccessTokenClaims(response.accessToken)) {
      const graphClient: Client = Client.init({
        authProvider: (done) => done(null, response.accessToken),
      });

      const user: { mail: string } = await graphClient.api("/me").get();
      const userId = await getUserId(user.mail);
      const encodedSecret = base64url.decode(authConfig.jwt_secret_key);

      const jwtToken = await new EncryptJWT({ userId, homeAccountId: response.account?.homeAccountId })
        .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
        .setIssuedAt()
        .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
        .setExpirationTime("15m")
        .encrypt(encodedSecret);

      const refreshToken = await new EncryptJWT({ userId, homeAccountId: response.account?.homeAccountId })
        .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
        .setIssuedAt()
        .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
        .setExpirationTime("7d")
        .encrypt(encodedSecret);

      res.cookie("token", jwtToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: "none" });
      actionLogger.info("User logged in", { id: user.mail, ip });
      res.redirect(`${FE_FULL_URL}/login?success=true`);
    } else {
      res.redirect(`${FE_FULL_URL}/login?success=false`);
    }
  } catch (error) {
    console.debug(error);
    res.redirect(`${FE_FULL_URL}/login?success=false`);
  }
});

authRouter.post("/logout", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  let userId, homeAccountId: string | undefined;

  try {
    jwtDecrypt(req.cookies["token"], base64url.decode(authConfig.jwt_secret_key)).then(
      (result: JWTDecryptResult<JWTPayload>) => {
        const decoded = result.payload;
        if (typeof decoded === "object" && decoded !== null) {
          userId = decoded.userId as string;
          homeAccountId = decoded.homeAccountId as string;
        }
      }
    );
    const msalAccounts: AccountInfo[] = await cca.getTokenCache().getAllAccounts();
    const accountToRemove: AccountInfo | undefined = msalAccounts.find(
      (account: AccountInfo) => account.homeAccountId === homeAccountId
    );

    if (accountToRemove) {
      await cca.getTokenCache().removeAccount(accountToRemove);
    } else {
      appLogger.warn("Account not found in MSAL cache");
    }
  } catch (error) {
    appLogger.error(error);
  }

  actionLogger.info("User logged out", { email: userId, ip });
  res.clearCookie("token");
  res.json("Logged out");
});

authRouter.post("/proxyCheck", (req, res) => {
  res.send(true);
});

authRouter.post("/checkToken", async (req, res) => {
  try {
    const status = await checkToken(req);
    if (status === "JsonWebTokenError" || status === "TokenExpiredError") {
      res.status(403).send(status);
    } else {
      res.send(true);
    }
  } catch (error) {
    appLogger.error(error);
    res.status(403).send("Unauthorized");
  }
});

authRouter.post("/checkPermissions", checkActionPermissions());

export async function verifyAndRefreshToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = req.cookies["token"];
    if (!token) {
      return res.status(401).send("Access token not found");
    }

    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
    const { payload } = await jwtDecrypt(token, encodedSecret, {
      issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
    });

    const expTime = payload.exp as number;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeLeft = expTime - currentTime;

    // 90 secs until token expires
    if (timeLeft < 90) {
      const { newAccessToken, newRefreshToken } = await refreshToken(req, res);

      res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });
    }

    next();
  } catch (error) {
    if(error instanceof errors.JWTExpired) {
      try {
        const { newAccessToken, newRefreshToken } = await refreshToken(req, res);

        appLogger.info("Token refreshed");
        res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
        res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });
        next();
      } catch (error) {
        appLogger.error(error);
        res.status(403).send("Unauthorized");
      }
    }
    appLogger.error(error);
    res.status(403).send("Unauthorized");
  }
}

async function refreshToken(req: express.Request, res: express.Response): Promise<{ newAccessToken: string; newRefreshToken: string }> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  const refreshToken = req.cookies["refreshToken"];
  if (!refreshToken) {
    throw new Error("Refresh token not found");
  }

  const { payload: refreshPayload } = await jwtDecrypt(refreshToken, encodedSecret, {
    issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
  });

  const userId = refreshPayload.userId as string;
  const homeAccountId = refreshPayload.homeAccountId as string;

  const newAccessToken = await new EncryptJWT({ userId, homeAccountId })
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
    .setIssuedAt()
    .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
    .setExpirationTime("15m")
    .encrypt(encodedSecret);

  const newRefreshToken = await new EncryptJWT({ userId, homeAccountId })
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
    .setIssuedAt()
    .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
    .setExpirationTime("7d")
    .encrypt(encodedSecret);

  return { newAccessToken, newRefreshToken }
}

async function getUserId(email: string): Promise<string | undefined> {
  try {
    const response = await queryFeatures({
      url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
      where: `EMAIL = '${email}'`,
      outFields: ["OBJECTID", "GLOBALID"],
      returnGeometry: false,
      authentication: gisCredentialManager,
    });

    if ("features" in response) {
      const user = response.features?.[0]?.attributes;
      if (user) {
        const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
        return new EncryptJWT({ userId: user.OBJECTID })
          .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
          .setIssuedAt()
          .setExpirationTime("15m")
          .encrypt(encodedSecret);
      } else {
        throw new Error("User not found");
      }
    }
  } catch (error) {
    appLogger.error(error);
    throw error;
  }
}

function checkActionPermissions() {
  return async function(req: express.Request, res: express.Response) {
    try {
      const action = req.query.action as string;
      const userId = await checkToken(req) as string;
      const response = await queryRelated({
        url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
        objectIds: [parseInt(userId)],
        outFields: ["*"],
        relationshipId: 0,
        authentication: gisCredentialManager,
      });
  
      const relatedRecord = response.relatedRecordGroups?.[0]?.relatedRecords?.[0];
  
      if (relatedRecord && action in relatedRecord.attributes) {
        if(relatedRecord.attributes[action]) {
          res.send(true);
          // next();
        } else {
          res.status(403).send("Forbidden");
        }
      } else {
        appLogger.warn("Action not found in related records");
        res.status(403).send("Forbidden");
      }
    } catch (error) {
      appLogger.error(error);
      res.status(403).send("Unauthorized");
    }
  };
}

export async function checkToken(req: express.Request): Promise<string | unknown> {
  const encodedSecret: Uint8Array = base64url.decode(authConfig.jwt_secret_key);
  try {
    const decryptedToken: JWTVerifyResult = await jwtDecrypt(req.cookies["token"], encodedSecret, {
      issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
    });

    return await decryptUserId(decryptedToken.payload?.userId as string);
  } catch (error) {
    appLogger.error(error);
    return null;
  }
}

export async function logRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = await checkToken(req);
  actionLogger.info(`${req.method} ${req.baseUrl}`, {
    id: userId || "no-token-cookie",
    ip: req.ip,
  });
  next();
}

async function decryptUserId(encryptedPayload: string): Promise<string> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  const { payload } = await jwtDecrypt(encryptedPayload, encodedSecret);
  return payload.userId as string;
}
