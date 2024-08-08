import { AuthenticationResult, AuthError, ConfidentialClientApplication } from "@azure/msal-node";
import {
  IQueryFeaturesResponse,
  IQueryRelatedResponse,
  IQueryResponse,
  IRelatedRecordGroup,
  queryFeatures,
  queryRelated,
} from "@esri/arcgis-rest-feature-service";
import { ApplicationCredentialsManager, IAuthenticationManager } from "@esri/arcgis-rest-request";
import { Client } from "@microsoft/microsoft-graph-client";
import express from "express";
import { EncryptJWT, jwtDecrypt, JWTVerifyResult, base64url, JWTPayload, JWTDecryptResult } from "jose";

import { actionLogger, appLogger } from "../util/appLogger";
import { authConfig, BASEURL, FE_FULL_URL, PROXY_LISTEN_PORT } from "../util/secrets";
import TokenValidator from "../util/tokenValidator";

export const authRouter = express.Router();

const tokenValidator = new TokenValidator();
const cca = new ConfidentialClientApplication({
  auth: {
    clientId: authConfig.msal.id,
    authority: `${authConfig.msal.authority}/${authConfig.msal.tenant}`,
    clientSecret: authConfig.msal.secret,
  },
});
const gisCredentialManager: ApplicationCredentialsManager = new ApplicationCredentialsManager({
  clientId: authConfig.arcgis.id,
  clientSecret: authConfig.arcgis.secret,
});

authRouter.get("/login", (req, res) => {
  cca
    .getAuthCodeUrl({
      scopes: [`${authConfig.msal.graphEndpoint}/.default`],
      redirectUri: authConfig.msal.redirectUri,
    })
    .then((response: string) => {
      res.redirect(response);
    })
    .catch((error: AuthError) => {
      appLogger.error(error.message);
    });
});

authRouter.post("/callback", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  cca
    .acquireTokenByCode({
      code: req.query.code as string,
      redirectUri: authConfig.msal.redirectUri,
      scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    })
    .then(async (response: AuthenticationResult) => {
      if (await tokenValidator.validateMSAccessTokenClaims(response.accessToken)) {
        console.log("token verified");
        try {
          const graphClient = Client.init({
            authProvider: (done) => {
              done(null, response.accessToken);
            },
          });

          const user = await graphClient.api("/me").get();

          const userId = await getUserId(user.mail);
          const encodedSecret = base64url.decode(authConfig.jwt_secret_key);

          const jwtToken = await new EncryptJWT({
            userId: userId,
            homeAccountId: response.account?.homeAccountId,
          })
            .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
            .setIssuedAt()
            .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
            .setExpirationTime("15m")
            .encrypt(encodedSecret);

          const refreshToken = await new EncryptJWT({
            userId: userId,
            homeAccountId: response.account?.homeAccountId,
          })
            .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
            .setIssuedAt()
            .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
            .setExpirationTime("7d")
            .encrypt(encodedSecret);

          res.cookie("token", jwtToken, { httpOnly: true, secure: true, sameSite: "none" });
          res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: "none" });
          actionLogger.info("User logged in", { email: user.mail, ip: ip });
          res.redirect(`${FE_FULL_URL}/login?success=true`);
        } catch (error) {
          console.debug(error);
          res.redirect(`${FE_FULL_URL}/login?success=false`);
        }
      } else {
        console.log("cannot verify token from MS");
        res.redirect(`${FE_FULL_URL}/login?success=false`);
      }
    });
});

authRouter.post("/logout", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  let userId: string | undefined, homeAccountId: string | undefined;

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
    const msalAccounts = await cca.getTokenCache().getAllAccounts();
    const accountToRemove = msalAccounts.find((account) => account.homeAccountId === homeAccountId);

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

authRouter.get("/proxyCheck", (req, res) => {
  res.send(true);
});

authRouter.get("/checkToken", async (req, res) => {
  try {
    const status: string | unknown = await checkToken(req);
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
      const refreshToken = req.cookies["refreshToken"];
      if (!refreshToken) {
        return res.status(401).send("Refresh token not found");
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

      res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });
    }

    next();
  } catch (error) {
    appLogger.error(error);
    res.status(403).send("Unauthorized");
  }
}

function getUserId(email: string): Promise<string | null> {
  // should be first request, subsequent refresh token
  return new Promise((resolve, reject) => {
    queryFeatures({
      url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
      where: `EMAIL = '${email}'`,
      outFields: ["OBJECTID", "GLOBALID"],
      returnGeometry: false,
      authentication: gisCredentialManager,
    })
      .then(async (response: IQueryFeaturesResponse | IQueryResponse) => {
        if ("features" in response && response.features.length !== 0) {
          const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
          const userId = response.features[0].attributes.OBJECTID;
          try {
            const encryptedUserId = await new EncryptJWT({ userId })
              .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
              .setIssuedAt()
              .setExpirationTime("15m")
              .encrypt(encodedSecret);
            resolve(encryptedUserId);
          } catch (error) {
            appLogger.error(error);
            reject(error);
          }
        }
      })
      .catch((error) => {
        appLogger.error(error);
        reject(error);
      });
  });
}

export async function checkPermissions(action: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const userId = await decryptUserId(req.cookies["token"]);
      const hasPermission = await checkActionPermissions(Number(userId), action);

      if (hasPermission) {
        next();
      } else {
        res.status(403).send("Forbidden");
      }
    } catch (error) {
      appLogger.error(error);
      res.status(403).send("Unauthorized");
    }
  };
}
async function checkActionPermissions(userId: number, action: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    gisCredentialManager.refreshToken().then((manager: IAuthenticationManager | string) => {
      queryRelated({
        url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_roles}`,
        objectIds: [userId],
        outFields: ["ROLE_ID"],
        relationshipId: 0,
        authentication: manager,
      }).then(async (response: IQueryRelatedResponse) => {
        if ("relatedRecordGroups" in response) {
          const relatedRecordGroup: IRelatedRecordGroup = response.relatedRecordGroups[0];
          if (
            "relatedRecords" in relatedRecordGroup &&
            relatedRecordGroup.relatedRecords &&
            relatedRecordGroup.relatedRecords.length > 0
          ) {
            const relatedRecord = relatedRecordGroup.relatedRecords[0];
            if (action in relatedRecord.attributes) {
              if (relatedRecord.attributes?.[`${action}`]) {
                resolve(true);
              } else {
                reject(false);
              }
            } else {
              appLogger.warn("Action not found in related records");
              reject(false);
            }
          }
        }
      });
    });
  });
}

async function checkToken(req: express.Request): Promise<string | unknown> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  const decryptedToken: JWTVerifyResult = await jwtDecrypt(req.cookies["token"], encodedSecret, {
    issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
  });
  const decryptedPayload = await decryptUserId(decryptedToken.payload?.userId as string);
  return decryptedPayload;
}

export function logRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = checkToken(req);
  actionLogger.info(`${req.method} ${req.path}`, {
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
