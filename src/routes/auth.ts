import express from "express";
import { AuthorizationCode } from "simple-oauth2";
import OracleDB, { Connection, autoCommit } from "oracledb";
import jwt from 'jsonwebtoken';

import graph from "../util/graph";
import { MS_SECRET, MS_CLIENT_ID, MS_TENANT_ID, WQIMS_DB_CONFIG, JWT_SECRET_KEY, BASEURL, PROXY_LISTEN_PORT, FE_FULL_URL} from "../util/secrets";
import { appLogger, actionLogger } from "../util/appLogger";

export const authRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};

const authConfig = {
  client: {
    id: MS_CLIENT_ID,
    secret: MS_SECRET
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: `${MS_TENANT_ID}/oauth2/v2.0/authorize`,
    tokenPath: `${MS_TENANT_ID}/oauth2/v2.0/token`
  }
}

const client = new AuthorizationCode(authConfig);

authRouter.get('/login', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  actionLogger.debug('User requested login page', { ip });
  const authorizationUri = client.authorizeURL({
    redirect_uri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
    scope: 'https://graph.microsoft.com/.default'
  });
  res.redirect(authorizationUri);
})

authRouter.get('/callback', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const code = req.query.code;
  const options: any = {
    code,
    redirect_uri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
    scope: 'https://graph.microsoft.com/.default'
  }

  try {
    const accessToken = await client.getToken(options);
    const user = await graph.getUserDetails(accessToken.token);

    const jwtToken = jwt.sign({ email: user.mail, exp: Math.floor((accessToken.token.expires_at as Date).getTime() / 1000) }, JWT_SECRET_KEY as string);

    res.cookie('token', jwtToken, { httpOnly: true, secure: true, sameSite: "none" });
    actionLogger.info('User logged in', { email: user.mail, ip: ip })

    res.redirect(`${FE_FULL_URL}/login?success=true`);
  } catch (error) {
    console.debug(error);
    res.status(500).send(error);
    res.redirect(`${FE_FULL_URL}/login?success=false`);
  }
})

OracleDB.createPool(dbConf)
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
  jwt.verify(req.cookies['token'], JWT_SECRET_KEY, (err: any, decoded: any) => {
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
  const status = checkToken(req, res);
  if(status === 'TokenExpiredError') {
    res.status(403).send(status);
  }
  else {
    res.send(status);
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
        if(result?.rows[0].ACTION_VALID === 'true')
          resolve(true);
        else {
          resolve(false);
        }
      }
    )
  })
}

export function checkToken(req: any, res: any): string | any {
  let email: string = '';
  jwt.verify(req.cookies['token'], JWT_SECRET_KEY, (err: any, decoded: any) => {
    if(err) {
      appLogger.error(err);
      return err;
      // res.status(403).json(err);
    }
    else {
      email = decoded.email;
    }
  })
  return email;
}