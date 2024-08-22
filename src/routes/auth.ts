import { AuthenticationResult, AuthError, AccountInfo } from "@azure/msal-node";
import {
  queryFeatures,
  queryRelated,
} from "@esri/arcgis-rest-feature-service";
import { ApplicationCredentialsManager } from "@esri/arcgis-rest-request";
import { default as graph } from "../util/graph";
import express, { Router } from "express";
import { base64url, EncryptJWT, jwtDecrypt, JWTDecryptResult, JWTPayload, JWTVerifyResult, errors } from "jose";

import { actionLogger, appLogger } from "../util/appLogger";
import { authConfig, BASEURL, FE_FULL_URL, PROXY_LISTEN_PORT } from "../util/secrets";
import TokenValidator from "../util/tokenValidator";
import cookieParser from "cookie-parser";

export const authRouter: Router = express.Router();
authRouter.use(cookieParser());

const tokenValidator: TokenValidator = new TokenValidator();
export const gisCredentialManager: ApplicationCredentialsManager = new ApplicationCredentialsManager({
  clientId: authConfig.arcgis.id,
  clientSecret: authConfig.arcgis.secret,
});

authRouter.post("/login", (req, res) => {
  graph.cca
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
    const response: AuthenticationResult = await graph.cca.acquireTokenByCode({
      code: req.query.code as string,
      redirectUri: authConfig.msal.redirectUri,
      scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    });

    if (await tokenValidator.validateMSAccessTokenClaims(response.accessToken)) {
      graph.initGraphClient(response.accessToken);

      const user: { mail: string } = await graph.getUserDetails();
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
    const msalAccounts: AccountInfo[] = await graph.cca.getTokenCache().getAllAccounts();
    const accountToRemove: AccountInfo | undefined = msalAccounts.find(
      (account: AccountInfo) => account.homeAccountId === homeAccountId
    );

    if (accountToRemove) {
      await graph.cca.getTokenCache().removeAccount(accountToRemove);
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
    const status = await checkToken(req, res);
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

authRouter.post("/checkPermissions", verifyAndRefreshToken, checkActionPermissions());

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
      const { newAccessToken, newRefreshToken } = await refreshToken(req);

      res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });

      req.cookies["token"] = newAccessToken;
      req.cookies["refreshToken"] = newRefreshToken;
    }


    next();
  } catch (error) {
    if(error instanceof errors.JWTExpired) {
      try {
        const { newAccessToken, newRefreshToken } = await refreshToken(req);

        res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
        res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });

        req.cookies["token"] = newAccessToken;
        req.cookies["refreshToken"] = newRefreshToken;
        next();
      } catch (error) {
        appLogger.error(error);
        if (!res.headersSent) {
          res.status(403).send("Unauthorized");
        }
      }
    } else {
      appLogger.error(error);
      if (!res.headersSent) {
        res.status(403).send("Unauthorized");
      }
    }
  }
}

async function refreshToken(req: express.Request): Promise<{ newAccessToken: string; newRefreshToken: string }> {
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

  appLogger.info("Token refreshed");
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
        const encodedSecret = base64url.decode(authConfig.payload_secret_key);
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
      const userId = await checkToken(req, res) as string;
      if(!userId) {
        if (!res.headersSent) {
          res.status(403).send("Unauthorized");
        }
        return;
      }

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
          if (!res.headersSent) {
            res.send(true);
          }
        } else {
          if (!res.headersSent) {
            res.status(403).send("Forbidden");
          }
        }
      } else {
        appLogger.warn("Action not found in related records");
        if (!res.headersSent) {
          res.status(403).send("Forbidden");
        }
      }
    } catch (error) {
      appLogger.error(error);
      if (!res.headersSent) {
        res.status(403).send("Unauthorized");
      }
    }
  };
}

export async function checkToken(req: express.Request, res: express.Response): Promise<string | unknown> {
  const encodedSecret: Uint8Array = base64url.decode(authConfig.jwt_secret_key);
  try {
    const decryptedToken: JWTVerifyResult = await jwtDecrypt(req.cookies["token"], encodedSecret, {
      issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
    });

    const userId = await decryptUserId(decryptedToken.payload?.userId as string);
    return userId;
  } catch (error) {
    appLogger.error(error);
    return null;
  }
}

export async function logRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = await checkToken(req, res);
  actionLogger.info(`${req.method} ${req.baseUrl}`, {
    id: userId || "no-token-cookie",
    ip: req.ip,
  });
  next();
}

async function decryptUserId(encryptedPayload: string): Promise<string> {
  const encodedSecret = base64url.decode(authConfig.payload_secret_key);
  try {
    const { payload } = await jwtDecrypt(encryptedPayload, encodedSecret);
    return payload.userId as string;
  } catch (error) {
    if (error instanceof errors.JWTExpired) { // the payload is allowed to expire
      //console.log("decrypting payload...");
      return error.payload.userId as string;
    }
    return "error";
  }
}
