import express from "express";
import { AuthorizationCode } from "simple-oauth2";
import OracleDB, { Connection, autoCommit } from "oracledb";
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

import graph from "../util/graph";
import { MS_SECRET, MS_CLIENT_ID, MS_TENANT_ID, WQIMS_DB_CONFIG, JWT_SECRET_KEY, BASEURL} from "../util/secrets";
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
    redirect_uri: 'https://w10-gis05.wssc.ad.root:3001/auth/callback',
    scope: 'https://graph.microsoft.com/.default'
  });
  res.redirect(authorizationUri);
})

authRouter.get('/callback', async (req, res) => {
  const code = req.query.code;

  const options: any = {
    code,
    redirect_uri: `${BASEURL}:3001/auth/callback`,
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
    res.redirect(`${BASEURL}:4200/login?success=true`);
  } catch (error) {
    console.debug(error);
    res.status(500).send(error);
    res.redirect(`${BASEURL}:4200/login?success=false`);
  }
})

authRouter.get('/checkAdmin', async (req, res) => {
  const token = req.cookies.token;
  OracleDB.createPool(dbConf)
  .then(pool => {
    pool.getConnection((err, conn) => {
      if(err) {
        appLogger.error(`Error getting connection from pool: ${err.message}`)
        return;
      }
      conn.execute(`select SESSIONINFO from user_sessions where accessToken = :token`, [token], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
        if(err){
          appLogger.error(`Error getting session info from database: ${err.message}`)
          return;
        }
        if(result.rows) {
          if(result.rows.length > 0) {
            result.rows[0].SESSIONINFO.setEncoding('utf8');
            result.rows[0].SESSIONINFO.on('data', (chunk: any) => {
              const sessionInfo = JSON.parse(chunk);
              if (sessionInfo.tokenExpiresAt < (Date.now() / 1000)) {
                res.status(403).send('Expired token');
              }
              if(sessionInfo.permissions.includes('admin')){
                res.status(200).send(true);
              } else {
                res.status(403).send('Insufficient permissions');
              }
            })
          } else {
            res.status(403).send('User not found');
          }
        }
      })
      conn.release((err) => {
        if(err){
          appLogger.error(`Error releasing connection: ${err.message}`)
          return;
        }
      });
    })
  })
})

authRouter.get('/checkUser', async (req, res) => {
  const token = req.cookies.token;
  OracleDB.createPool(dbConf)
  .then(pool => {
    pool.getConnection((err, conn) => {
      if(err) {
        appLogger.error(`Error getting connection from pool: ${err.message}`)
        return;
      }
      conn.execute(`select sessionInfo from user_sessions where accessToken = :token`, [token], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
        if(err){
          appLogger.error(`Error getting session info from database: ${err.message}`)
          return;
        }
        if(result.rows) {
          if(result.rows.length > 0){
            result.rows[0].SESSIONINFO.setEncoding('utf8');
            result.rows[0].SESSIONINFO.on('data', (chunk: any) => {
              const sessionInfo = JSON.parse(chunk);
              if(sessionInfo.tokenExpiresAt < (Date.now() / 1000)){
                res.status(403).send('Expired token');
              }
              res.status(200).send(sessionInfo.user);
            });
          } else {
            res.status(403).send(false);
          }
        }
      })
      conn.release();
    })
  })
})

authRouter.get('/checkToken', async (req, res) => {
  const token = req.cookies.token;
  OracleDB.createPool(dbConf)
  .then(pool => {
    pool.getConnection((err, conn) => {
      if(err) {
        appLogger.error(`Error getting connection from pool: ${err.message}`)
        return;
      }
      conn.execute(`select sessionInfo from user_sessions where accessToken = :token`, [token], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
        if(err){
          appLogger.error(`Error getting session info from database: ${err.message}`)
          return;
        }
        if(result.rows) {
          if(result.rows.length > 0){
            result.rows[0].SESSIONINFO.setEncoding('utf8');
            result.rows[0].SESSIONINFO.on('data', (chunk: any) => {
              const sessionInfo = JSON.parse(chunk);
              if(sessionInfo.tokenExpiresAt < (Date.now() / 1000)){
                res.status(403).send('Expired token');
              }
              else {
                res.send(true);
              }
            });
          } else {
            res.status(403).send(false);
          }
        }
      })
      conn.release();
    })
  })
})

authRouter.get('/logout', async (req, res) => {
  const token = req.cookies.token;
  OracleDB.createPool(dbConf)
  .then(pool => {
    pool.getConnection((err, conn) => {
      if(err) {
        appLogger.error(`Error getting connection from pool: ${err.message}`)
        return;
      }
      conn.execute(`delete from user_sessions where accessToken = :token`, [token], { autoCommit: true }, (err, result) => {
        if(err){
          appLogger.error(`Error deleting session from database: ${err.message}`)
          return;
        }
        appLogger.info(`User session deleted from database: ${token}`)
      })
      conn.release();
    })
  })
  res.clearCookie('token');
  res.status(200).send('Logged out');
})

//TODO: probably needs to be elaborated upon
// roles: admin, editor, viewer
// need a more comprehensive way to handle permissions
async function updateUserPermissions(user: any): Promise<any> {
  if (user) {
    if(user.jobTitle.includes('Manager') 
      || user.jobTitle.includes('Director') 
      || user.jobTitle.includes('Administrator')
      || user.jobTitle.includes('Developer')) {
      user.permissions = ['admin'];
    }
    else {
      user.permissions = ['viewer'];
    }
  }
  return user;
}