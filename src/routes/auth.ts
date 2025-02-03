import express, { Router, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import {base64url, EncryptJWT, jwtDecrypt, errors, JWTPayload} from "jose";
import { AuthenticationResult, AuthError } from "@azure/msal-node";
import { appLogger, actionLogger } from "../util/appLogger";
import { authConfig, BASEURL, FE_FULL_URL, PROXY_LISTEN_PORT } from "../util/secrets";
import TokenValidator from "../util/tokenValidator";
import { default as graph } from "../util/graph";
import session from "express-session";
import { WqimsUser } from "../models/WqimsUser";
import { ArcGISService } from '../services/ArcGISService';
import { IQueryRelatedResponse } from '../models/Wqims.interface';

/**
 * Express router for authentication-related routes.
 */
const authRouter: Router = express.Router();
authRouter.use(cookieParser());

const tokenValidator = new TokenValidator();
// export const gisCredentialManager = new ApplicationCredentialsManager({
//   clientId: authConfig.arcgis.username,
//   clientSecret: authConfig.arcgis.password,
// });

/**
 * Route to initiate login process.
 * @route POST /login
 */
authRouter.post("/login", (req: Request, res: Response) => {
  graph.cca.getAuthCodeUrl({
    scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    redirectUri: authConfig.msal.redirectUri,
  })
      .then(url => res.json({ redirectUrl: url }))
      .catch((error: AuthError) => appLogger.error(error.message));
});

/**
 * Callback route for handling authentication response.
 * @route GET /callback
 */
authRouter.get("/callback", async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  try {
    const accounts = await graph.cca.getTokenCache().getAllAccounts();
    
    // Only try to get user session if token exists
    let userHomeAcctId = null;
    if (req.cookies["token"]) {
      userHomeAcctId = await getUserSessionFromToken(req.cookies["token"]);
    }

    let response!: AuthenticationResult;
    // check if user token is in MSAL cache
    if(accounts.length > 0 && userHomeAcctId && accounts.some(account => account.homeAccountId === userHomeAcctId)) {
      
      const account = accounts.find(account => account.homeAccountId === userHomeAcctId);
      if (account) {
        const silentRequest = {
          account: account,
          scopes: [`${authConfig.msal.graphEndpoint}/.default`]
        }

        response = await graph.cca.acquireTokenSilent(silentRequest);

        if (response && "accessToken" in response && response.accessToken) {
          console.log("Token acquired silently");
        }
      }
    } else {
      response = await graph.cca.acquireTokenByCode({
        code: req.query.code as string,
        redirectUri: authConfig.msal.redirectUri,
        scopes: [`${authConfig.msal.graphEndpoint}/.default`],
      });

    }
    if (await tokenValidator.validateMSAccessTokenClaims(response.accessToken)) {
      graph.initGraphClient(response.accessToken);
      const user = await graph.getUserDetails();
      const userId = await getUserId(user.mail);
      const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
      const userSession = {
        [response.account?.homeAccountId as string]: {
          upn: user.userPrincipalName,
        }
      }

      const jwtToken = await createJWT({ userId, homeAccountId: response.account?.homeAccountId }, encodedSecret, "15m");
      const refreshToken = await createJWT({ userId, homeAccountId: response.account?.homeAccountId }, encodedSecret, "7d");
      
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

/**
 * Route to handle user logout.
 * @route POST /logout
 */
authRouter.post("/logout", async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  try {
    const { userId, homeAccountId } = await getTokenPayload(req.cookies["token"]);
    const accountToRemove = (await graph.cca.getTokenCache().getAllAccounts())
        .find(account => account.homeAccountId === homeAccountId);

    if (accountToRemove) await graph.cca.getTokenCache().removeAccount(accountToRemove);
    actionLogger.info("User logged out", { email: userId, ip });
    res.clearCookie("token");
    res.json("Logged out");
  } catch (error) {
    appLogger.error(error);
  }
});

/**
 * Route to check proxy status.
 * @route POST /proxyCheck
 */
authRouter.post("/proxyCheck", (req: Request, res: Response) => res.send(true));

/**
 * Route to check the validity of a token.
 * @route POST /checkToken
 */
authRouter.post("/checkToken", async (req: Request, res: Response) => {
  try {
    const userId = await checkToken(req, res);
    if (userId && userId !== "error") {
      res.status(200).send(true);
    } else {
      res.status(401).send({ error: "Invalid token" });
    }
  } catch (error) {
    appLogger.error(error);
    res.status(401).send({ error: "Unauthorized" });
  }
});

/**
 * Route to check user action permissions.
 * @route POST /checkPermissions
 * @param {string} req.query.action - The action to check permissions for.
 * @returns {boolean|string} - Returns true if the user has permission, otherwise returns "Forbidden".
 * @throws {Error} - Throws an error if the user is unauthorized or if there is an internal server error.
 */
authRouter.post("/checkPermissions", checkActionPermissions());

/**
 * Middleware to verify and refresh token if necessary.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
async function verifyAndRefreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies["token"];
    if (!token) return res.status(401).send("Access token not found");

    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
    const { payload } = await jwtDecrypt(token, encodedSecret, { issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth` });

    if (payload.exp && payload.exp - Math.floor(Date.now() / 1000) < 90) {
      const { newAccessToken, newRefreshToken } = await refreshToken(req);
      res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });
      req.cookies["token"] = newAccessToken;
      req.cookies["refreshToken"] = newRefreshToken;
    }
    next();
  } catch (error) {
    handleTokenError(error, req, res, next);
  }
}

/**
 * Refreshes the access and refresh tokens.
 * @param req - Express request object
 * @returns New access and refresh tokens
 */
async function refreshToken(req: Request): Promise<{ newAccessToken: string, newRefreshToken: string }> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  const refreshToken = req.cookies["refreshToken"];
  if (!refreshToken) throw new Error("Refresh token not found");

  const { payload } = await jwtDecrypt(refreshToken, encodedSecret, { issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth` });
  const { userId, homeAccountId } = payload;

  const newAccessToken = await createJWT({ userId, homeAccountId }, encodedSecret, "15m");
  const newRefreshToken = await createJWT({ userId, homeAccountId }, encodedSecret, "7d");

  appLogger.info("Token refreshed");
  return { newAccessToken, newRefreshToken };
}

/**
 * Retrieves the user ID based on the provided email.
 * @param email - User's email address
 * @returns User ID
 */
async function getUserId(email: string): Promise<string> {
  try {
    const user = await WqimsUser.getFeatureByEmail(email);
    if (!user) throw new Error("User not found");

    const encodedSecret = base64url.decode(authConfig.payload_secret_key);
    return new EncryptJWT({ userId: user.OBJECTID })
      .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .encrypt(encodedSecret);
  } catch (error) {
    appLogger.error(error);
    throw error;
  }
}

/**
 * Middleware to check action permissions.
 * @returns Middleware function
 */
function checkActionPermissions() {
  return async function (req: Request, res: Response) {
    try {
      const action = req.query.action as string;
      const userId = await checkToken(req, res);
      if (!userId) return res.status(403).send("Unauthorized");

      // Use ArcGIS service to query related records
      const response = await ArcGISService.request<IQueryRelatedResponse>(
        `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}/queryRelatedRecords`,
        'GET',
        {
          objectIds: [parseInt(userId)],
          outFields: ["*"],
          relationshipId: parseInt(authConfig.arcgis.layers.userroles_rel_id),
          returnGeometry: false
        }
      );

      const relatedRecord = response.relatedRecordGroups?.[0]?.relatedRecords?.[0];
      if (relatedRecord && action in relatedRecord.attributes) {
        res.status(relatedRecord.attributes[action] ? 200 : 403)
          .send(relatedRecord.attributes[action] ? true : "Forbidden");
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

/**
 * Checks the validity of the token.
 * @param req - Express request object
 * @param res - Express response object
 * @returns User ID or null
 */
async function checkToken(req: Request, res: Response): Promise<string | null> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  try {
    const { payload } = await jwtDecrypt(req.cookies["token"], encodedSecret, { issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth` });
    return await decryptUserId(payload.userId as string);
  } catch (error) {
    appLogger.error(error);
    return null;
  }
}

/**
 * Middleware to log requests.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
async function logRequest(req: Request, res: Response, next: NextFunction) {
  const userId = await checkToken(req, res);
  actionLogger.info(`${req.method} ${req.baseUrl}`, { id: userId || "no-token-cookie", ip: req.ip });
  next();
}

/**
 * Decrypts the user ID from the encrypted payload.
 * @param encryptedPayload - Encrypted payload containing the user ID
 * @returns Decrypted user ID
 */
async function decryptUserId(encryptedPayload: string): Promise<string> {
  const encodedSecret = base64url.decode(authConfig.payload_secret_key);
  try {
    const { payload } = await jwtDecrypt(encryptedPayload, encodedSecret);
    return payload.userId as string;
  } catch (error) {
    if (error instanceof errors.JWTExpired) return error.payload.userId as string;
    return "error";
  }
}

/**
 * Creates a JWT token.
 * @param payload - Payload to be included in the JWT
 * @param secret - Secret key for encryption
 * @param expiration - Expiration time for the token
 * @returns JWT token
 */
async function createJWT(payload: JWTPayload, secret: Uint8Array, expiration: string): Promise<string> {
  return new EncryptJWT(payload)
      .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
      .setIssuedAt()
      .setIssuer(`${BASEURL}:${PROXY_LISTEN_PORT}/auth`)
      .setExpirationTime(expiration)
      .encrypt(secret);
}

/**
 * Retrieves the payload from the token.
 * @param token - JWT token
 * @returns Payload from the token
 */
async function getTokenPayload(token: string): Promise<any> {
  const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
  const { payload } = await jwtDecrypt(token, encodedSecret);
  return payload;
}

/**
 * Handles token errors.
 * @param error - Error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
function handleTokenError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error instanceof errors.JWTExpired) {
    refreshToken(req).then(({ newAccessToken, newRefreshToken }) => {
      res.cookie("token", newAccessToken, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: true, sameSite: "none" });
      req.cookies["token"] = newAccessToken;
      req.cookies["refreshToken"] = newRefreshToken;
      next();
    }).catch(err => {
      appLogger.error(err);
      res.status(403).send("Unauthorized");
    });
  } else {
    appLogger.error(error);
    res.status(403).send("Unauthorized");
  }
}

async function getUserSessionFromToken(token: string): Promise<unknown> {
  try {
    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
    const { payload } = await jwtDecrypt(token, encodedSecret);
    return payload.homeAccountId;
  } catch (error) {
    appLogger.error(error);
    return null;
  }
}

export { authRouter, verifyAndRefreshToken, checkToken, logRequest };