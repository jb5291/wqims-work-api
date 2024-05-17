import express from "express";
import { AuthorizationCode } from "simple-oauth2";
import OracleDB, { Connection, autoCommit } from "oracledb";
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

import graph from "../util/graph";
import { MS_SECRET, MS_CLIENT_ID, MS_TENANT_ID, WQIMS_DB_CONFIG, JWT_SECRET_KEY, BASEURL, PROXY_LISTEN_PORT, FE_LISTEN_PORT} from "../util/secrets";
import { appLogger } from "../util/appLogger";

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

function generateSessionId() {
  return uuidv4();
}

authRouter.get('/login', (req, res) => {
  const authorizationUri = client.authorizeURL({
    redirect_uri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
    scope: 'https://graph.microsoft.com/.default'
  });
  res.redirect(authorizationUri);
})

authRouter.get('/callback', async (req, res) => {
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

    res.cookie('token', jwtToken, { httpOnly: true, secure: true, sameSite: 'none' });
    /* OracleDB.createPool(dbConf)
    .then(pool => {
      const userSession = generateSessionId();
      pool.getConnection((err, conn) => {
        if(err){
          appLogger.error(`Error getting connection from pool: ${err.message}`)
          return;
        }
        const sessionInfo = JSON.stringify({user: user.givenName + ' ' + user.surname, permissions: user.permissions, tokenExpiresAt: accessToken.token.expires_at});
        conn.execute(`insert into user_sessions (sessionId, accessToken, sessionInfo) values (:userSession, :accessToken, :sessionInfo)`, [userSession, accessToken.token.access_token, sessionInfo], { autoCommit: true }, (err, result) => {
          if(err){
            appLogger.error(`Error inserting user session into database: ${err.message}`)
            return;
          }
          appLogger.info(`User session inserted into database: ${userSession}`)
        });
        conn.release((err) => {
          if(err){
            appLogger.error(`Error releasing connection: ${err.message}`)
            return;
          }
        });
      })
    }) */
    res.redirect(`${BASEURL}:${FE_LISTEN_PORT}/login?success=true`);
  } catch (error) {
    console.debug(error);
    res.status(500).send(error);
    res.redirect(`${BASEURL}:${FE_LISTEN_PORT}/login?success=false`);
  }
})

OracleDB.createPool(dbConf)
.then(pool => {
  appLogger.info('Connection pool created for checking role permissions');

  authRouter.get('/checkPermissions', async (req, res) => {
    let userEmail = '';
    let connection: Connection | null = null;
    const action: string = req.query.action as string;
    try {
      jwt.verify(req.cookies['token'], JWT_SECRET_KEY, (err: any, decoded: any) => {
        if(err) {
          appLogger.error(err);
          res.status(401).send('Unauthorized');
        }
        else {
          userEmail = decoded.email;
        }
      })
      connection = await pool.getConnection();

      const permissions = await checkActionPermissions(userEmail, action, connection);
      if(permissions) {
        res.send(true);
      }
      else {
        res.sendStatus(403);
      }
    }
    catch(err) {
      appLogger.error(err);
      res.status
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

authRouter.get('/checkToken', async (req, res) => {
  const token = req.cookies.token;
})

authRouter.get('/logout', async (req, res) => {
  const token = req.cookies.token;
  res.clearCookie('token');
  res.status(200).send('Logged out');
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