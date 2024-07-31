import express from "express";
import * as jose from 'jose';
import OracleDB, { Connection } from "oracledb";
import jwt from 'jsonwebtoken';

// import graph from "../util/graph";
import { cca } from "../util/msal";
import { authConfig, WQIMS_DB_CONFIG, BASEURL, PROXY_LISTEN_PORT, FE_FULL_URL} from "../util/secrets";
import { appLogger, actionLogger } from "../util/appLogger";
import { AuthenticationResult } from "@azure/msal-node";

export const authRouter = express.Router();

authRouter.get('/login', (req, res) => {
  cca.getAuthCodeUrl({
    scopes: [`${authConfig.msal.auth.graphEndpoint}/.default`],
    redirectUri: authConfig.msal.auth.redirectUri
  })
  .then((response) => {
    res.redirect(response);
  })
  .catch((error: any) => {
    appLogger.error(error.message)
  })
})

authRouter.get('/callback', async (req, res) => {
  console.log('wqims auth callback');
  const code = req.query.code as string;
  cca.acquireTokenByCode({
    code: code,
    redirectUri: authConfig.msal.auth.redirectUri,
    scopes: [`${authConfig.msal.auth.graphEndpoint}/.default`]
  })
  .then(response => {
    if(validateMSAccessTokenClaims(response)) {
      console.log('process token')
      console.log(response);
    } else {
      console.log('cannot verify token from MS')
    }
  })
  /* const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const code = req.query.code;
  const options: any = {
    code,
    redirect_uri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
    scope: 'https://graph.microsoft.com/.default'
  }

  try {
    const accessToken = await client.getToken(options);
    const user = await graph.getUserDetails(accessToken.token);

    const jwtToken = jwt.sign({ email: user.mail, exp: Math.floor(Date.now()/1000) + 365000000 }, authConfig.jwt_secret_key);

    res.cookie('token', jwtToken, { httpOnly: true, secure: true, sameSite: "none" });
    actionLogger.info('User logged in', { email: user.mail, ip: ip })

    
    res.redirect(`${FE_FULL_URL}/login?success=true`);
  } catch (error) {
    console.debug(error);
    res.status(500).send(error);
    res.redirect(`${FE_FULL_URL}/login?success=false`);
  } */
})

function validateMSAccessTokenClaims(token: AuthenticationResult): boolean {


  const now = Math.round(new Date().getTime() / 1000.0);
  let audience_flg: boolean = false;
  let tenant_flg: boolean = false;
  let issuer_flg: boolean = false;
  let expiry_flg: boolean = false;
  if ("account" in token && token.account) {  
    if("idTokenClaims" in token.account && token.account.idTokenClaims) {
      // validate the audience
      // should match the client id of the app registered in Azure
      if("aud" in token.account.idTokenClaims) {
        audience_flg = token.account.idTokenClaims.aud === authConfig.msal.client.id;
      }
      // validate the tenant
      // should match the tenant id assigned to wssc
      if("tid" in token.account.idTokenClaims) {
        tenant_flg = token.account.idTokenClaims.tid === authConfig.msal.client.tenant
      }
      // validate the issuer
      // similar to checking tenant 
      if("iss" in token.account.idTokenClaims) {
        issuer_flg = token.account.idTokenClaims.iss === `${authConfig.msal.auth.authority}/${authConfig.msal.client.tenant}/v2.0`
      }
      // validate the token expiry
      if('iat' in token.account.idTokenClaims && 'exp' in token.account.idTokenClaims) {
        expiry_flg = (token.account.idTokenClaims.iat && token.account.idTokenClaims.iat <= now) && (token.account.idTokenClaims.exp && token.account.idTokenClaims.exp > now) ? true : false;
      }
    }
  }
  return audience_flg && tenant_flg && issuer_flg && expiry_flg;
}


/* OracleDB.createPool({
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
} */