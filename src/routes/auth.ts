import { AuthenticationResult, AuthError, ConfidentialClientApplication } from "@azure/msal-node";
import { IQueryFeaturesResponse, IQueryResponse, queryFeatures } from "@esri/arcgis-rest-feature-service";
import { ApplicationCredentialsManager } from "@esri/arcgis-rest-request";
import { Client } from "@microsoft/microsoft-graph-client";
import express from "express";
import { EncryptJWT, jwtDecrypt, jwtVerify, JWTVerifyResult, base64url } from "jose";
import jwt from "jsonwebtoken";
import OracleDB, { Connection } from "oracledb";

import { actionLogger, appLogger } from "../util/appLogger";
import { authConfig, BASEURL, FE_FULL_URL, PROXY_LISTEN_PORT, WQIMS_DB_CONFIG } from "../util/secrets";
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
    cca.getAuthCodeUrl({
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

authRouter.get("/callback", async (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    cca.acquireTokenByCode({
        code: req.query.code as string,
        redirectUri: authConfig.msal.redirectUri,
        scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    }).then(async (response: AuthenticationResult) => {
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

OracleDB.createPool({
    user: WQIMS_DB_CONFIG.username,
    password: WQIMS_DB_CONFIG.password,
    connectString: WQIMS_DB_CONFIG.connection_string,
}).then((pool) => {
    authRouter.get("/checkPermissions", async (req, res) => {
        let userEmail;
        let connection: Connection | null = null;
        let error: any;
        const tokenExpired = false;
        const action: string = req.query.action as string;
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        try {
            userEmail = checkToken(req, res);

            if (userEmail === "") {
                res.status(500).send("Internal server error");
            }
            actionLogger.info(`Attempting action ${action}`, {
                email: userEmail,
                ip: ip,
            });
            connection = await pool.getConnection();

            const permissions = await checkActionPermissions(userEmail, action, connection);
            if (permissions) {
                actionLogger.info(`Action ${action} permitted`, {
                    email: userEmail,
                    ip: ip,
                });
                res.send(true);
            } else {
                actionLogger.warn(`Action ${action} denied`, {
                    email: userEmail,
                    ip: ip,
                });
                res.sendStatus(403);
            }
        } catch (err) {
            appLogger.error(err);
            res.status(500).send("Internal server error");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    appLogger.error(err);
                }
            }
        }
    });
});

authRouter.get("/logout", async (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    let userId: string | undefined, homeAccountId: string | undefined;
    jwt.verify(req.cookies["token"], authConfig.jwt_secret_key, (err: any, decoded: any) => {
        if (err) {
            appLogger.error(err);
            res.status(401).send("Unauthorized");
        } else {
            userId = decoded.userId;
            homeAccountId = decoded.homeAccountId;
        }
    });

    try {
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

function getUserId(email: string): Promise<string | null> {
    // should be first request, subsequent refresh token
    return new Promise((resolve, reject) => {
        queryFeatures({
            url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
            where: `EMAIL = '${email}'`,
            outFields: ["GLOBALID"],
            returnGeometry: false,
            authentication: gisCredentialManager,
        })
            .then(async (response: IQueryFeaturesResponse | IQueryResponse) => {
                if ("features" in response && response.features.length !== 0) {
                    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
                    const userId = response.features[0].attributes.GLOBALID;
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

function checkActionPermissions(userId: string, action: string, connection: Connection): Promise<boolean> {
    return new Promise((resolve, reject) => {
        gisCredentialManager.refreshToken()
            .then((manager) => {
                queryFeatures({
                    url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_roles}`,
                    where: `USER_ID = ${userId}`,
                    outFields: ["ROLE_ID"]
                })
            })

        /*const query = `SELECT \
                  CASE WHEN r.${action} = 1 THEN 'true' ELSE 'false' END AS action_valid \
                  FROM users u \
                  JOIN user_roles ur ON u.GLOBALID = ur.USER_ID \
                  JOIN roles r ON ur.ROLE_ID = r.ROLE_ID \
                  WHERE u.EMAIL = :email`;
        connection.execute(query, [email], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
            if (err) {
                appLogger.error(err);
                reject(err);
            }
            if ("rows" in result && result.rows.length !== 0 && result?.rows[0].ACTION_VALID === "true") resolve(true);
            else {
                resolve(false);
            }
        });*/
    });
}

export async function checkToken(req: express.Request): Promise<string | unknown> {
    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
    const decryptedToken: JWTVerifyResult = await jwtDecrypt(req.cookies["token"], encodedSecret, {
        issuer: `${BASEURL}:${PROXY_LISTEN_PORT}/auth`,
    });
    const decryptedPayload = await decryptUserId(decryptedToken.payload?.userId as string);
    return decryptedPayload;
}

async function decryptUserId(encryptedPayload: string): Promise<string> {
    const encodedSecret = base64url.decode(authConfig.jwt_secret_key);
    const { payload } = await jwtDecrypt(encryptedPayload, encodedSecret);
    return payload.userId as string;
}
