import express from "express";
import * as jose from 'jose';
import OracleDB, { Connection } from "oracledb";
import jwt from 'jsonwebtoken';

import { authConfig, WQIMS_DB_CONFIG, BASEURL, PROXY_LISTEN_PORT, FE_FULL_URL} from "../util/secrets";
import { appLogger, actionLogger } from "../util/appLogger";
import TokenValidator from "../util/tokenValidator";
import { Client } from "@microsoft/microsoft-graph-client";
import { AuthenticationResult, ConfidentialClientApplication } from "@azure/msal-node";
import { ClientSecretCredential } from "@azure/identity";
import * as authProviders from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import axios from "axios";


export const authRouter = express.Router();
const tokenValidator = new TokenValidator();
const cca = new ConfidentialClientApplication({
  auth: {
    clientId: authConfig.msal.id,
    authority: `${authConfig.msal.authority}/${authConfig.msal.tenant}`,
    clientSecret: authConfig.msal.secret,
  },
});

authRouter.get('/login', (req, res) => {
  cca.getAuthCodeUrl({
    scopes: [`${authConfig.msal.graphEndpoint}/.default`],
    redirectUri: authConfig.msal.redirectUri
  })
  .then((response) => {
    res.redirect(response);
  })
  .catch((error: any) => {
    appLogger.error(error.message)
  })
})

authRouter.get('/callback', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  cca.acquireTokenByCode({
    code: req.query.code as string,
    redirectUri: authConfig.msal.redirectUri,
    scopes: [`${authConfig.msal.graphEndpoint}/.default`]
  })
  .then(async (response: AuthenticationResult) => {
    if(await tokenValidator.validateMSAccessToken(response.accessToken)) {
      console.log('token verified')
      try {
        const graphClient = Client.init({
          authProvider: (done) => {
            done(null, response.accessToken);
          }
        })

        const user = await graphClient.api('/me').get();
        //const user = await graph.getUserDetails();
        // const userId = await 

        // const jwtToken = new jose.SignJWT({ })  //({ email: user.mail, exp: Math.floor(Date.now()/1000) + 365000000 }, authConfig.jwt_secret_key);
        // res.cookie('token', jwtToken, { httpOnly: true, secure: true, sameSite: "none" });
        //actionLogger.info('User logged in', { email: user.mail, ip: ip })

        res.redirect(`${FE_FULL_URL}/login?success=true`);
      }
      catch (error) {
        console.debug(error);
        //res.status(500).send(error);
        res.redirect(`${FE_FULL_URL}/login?success=false`);
      }
    } else {
      console.log('cannot verify token from MS');
      //res.status(403).send('Forbidden');
      res.redirect(`${FE_FULL_URL}/login?success=false`);
    }
  })
})

OracleDB.createPool({
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
})
.then(pool => {
  authRouter.get('/checkPermissions', async (req, res) => {
    let userEmail = '';
    let connection: Connection | null = null;
    let error: any;
    let tokenExpired: boolean = false;
    const action: string = req.query.action as string;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      userEmail = checkToken(req, res);

      if(userEmail === '') {
        res.status(500).send('Internal server error');
      }
      actionLogger.info(`Attempting action ${action}`, { email: userEmail, ip: ip })
      connection = await pool.getConnection();

      const permissions = await checkActionPermissions(userEmail, action, connection);
      if(permissions) {
        actionLogger.info(`Action ${action} permitted`, { email: userEmail, ip: ip })
        res.send(true);
      }
      else {
        actionLogger.warn(`Action ${action} denied`, { email: userEmail, ip: ip })
        res.sendStatus(403);
      }
    }
    catch(err) {
      appLogger.error(err);
      res.status(500).send('Internal server error');
    }
    finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          appLogger.error(err);
        }
      }
    }
  })
})

authRouter.get('/logout', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let userEmail: string = '';
  jwt.verify(req.cookies['token'], authConfig.jwt_secret_key, (err: any, decoded: any) => {
    if (err) {
      appLogger.error(err);
      res.status(401).send('Unauthorized');
    }
    else {
      userEmail = decoded.email;
    }
  });
  actionLogger.info('User logged out', { email: userEmail, ip });
  res.clearCookie('token');
  res.json('Logged out');
})

authRouter.get('/proxyCheck', (req, res) => {
  res.send(true);
})

authRouter.get('/checkToken', (req, res) => {
  const status: any = checkToken(req, res);
  if(status === 'JsonWebTokenError' || status === 'TokenExpiredError') {
    res.status(403).send(status);
  }
  else {
    res.send(true);
  }
})

function checkActionPermissions(email: string, action: string, connection: Connection): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const query = `SELECT \
                  CASE WHEN r.${action} = 1 THEN 'true' ELSE 'false' END AS action_valid \
                  FROM users u \
                  JOIN user_roles ur ON u.GLOBALID = ur.USER_ID \
                  JOIN roles r ON ur.ROLE_ID = r.ROLE_ID \
                  WHERE u.EMAIL = :email`;
    connection.execute(
      query,
      [email],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
      (err, result: any) => {
        if(err) {
          appLogger.error(err);
          reject(err);
        }
        if('rows' in result && result.rows.length != 0 && result?.rows[0].ACTION_VALID === 'true')
          resolve(true);
        else {
          resolve(false);
        }
      }
    )
  })
}

export function checkToken(req: any, res: any): string | any {
  let status: string = '';
  jwt.verify(req.cookies['token'], authConfig.jwt_secret_key, (err: any, decoded: any) => {
    if(err) {
      appLogger.error(err);
      status = err.name;
    }
    else {
      status = decoded.email;
    }
  })
  return status;
}