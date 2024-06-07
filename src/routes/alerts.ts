import express from 'express';
import OracleDB,  { Connection, outFormat } from 'oracledb';
import jwt from 'jsonwebtoken';

import { JWT_SECRET_KEY, WQIMS_DB_CONFIG } from '../util/secrets';
import { appLogger, actionLogger } from '../util/appLogger';
import cookieParser from 'cookie-parser';
import { checkToken } from './auth';
//import { getIdFromEmail } from './auth';

const alertsRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};
alertsRouter.use(cookieParser());
/**
 * @swagger
 * components:
 *  schemas:
 *    Alert:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        SAMPLENUM:
 *          type: string
 *        LOCATION:
 *          type: string
 *        COLLECTDATE:
 *          type: date
 *        SAMPLECOLLECTOR:
 *          type: string
 *        ACODE:
 *          type: string
 *        ANALYSEDDATE:
 *          type: date
 *        ANALYSEDBY:
 *          type: string
 *        ADDR1:
 *          type: string
 *        ADDR5:
 *          type: string
 *        GEOCODEMATCHEDADDRESS:
 *          type: string
 *        RESULT:
 *          type: string
 *        LOCOCODE:
 *          type: string
 *        WARNING_STATUS:
 *          type: string
 *        ANALYTE:
 *          type: string
 */

OracleDB.createPool(dbConf)
.then(pool => {
  appLogger.info('connection pool created for alerts')
  
  /**
   * @swagger
   * /alerts:
   *  get:
   *    summary: Get alerts assigned to user
   *    description: Get alerts from wqims.limsalerts, will change once other alerts come in
   *    tags:
   *      - Alerts
   *    responses:
   *       '200':
   *         description: JSON array of alerts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               items:
   *                 $ref: '#/components/schemas/Alert'
    *       '500':
    *         description: Error getting alerts
    *         content:
    *           application/json:
    *             schema:
    *               type: string
    *               example: Error getting alerts
   */
  alertsRouter.get('/', async (req, res) => {
    let connection: Connection | null = null;
    let userEmail: string = '';
    let result: any = null;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      connection = await pool.getConnection();
      userEmail = checkToken(req, res)
      actionLogger.info(`Getting alerts for ${userEmail}`, { email: userEmail, ip: ip })
      result = await getAlerts(userEmail, connection);
      if (result.length) {
        res.json(result);
      }
      else {
        res.sendStatus(204);
      }
    } catch (err) {
      appLogger.error(err);
      res.status(500).send('Error getting alerts');
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

  /**
   * @swagger
   * /alerts/all:
   *  get:
   *    summary: Get all alerts
   *    description: Get alerts from wqims.limsalerts, will change once other alerts come in
   *    tags:
   *      - Alerts
   *    responses:
   *       '200':
   *         description: JSON array of alerts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               items:
   *                 $ref: '#/components/schemas/Alert'
    *       '500':
    *         description: Error getting alerts
    *         content:
    *           application/json:
    *             schema:
    *               type: string
    *               example: Error getting alerts
   */
  alertsRouter.get('/all', async (req, res) => {
    pool.getConnection((err, conn) => {
      if(err) {
        appLogger.error('Error getting connection: ', err);
        return res.status(502).send('DB Connection Error');
      }

      conn.execute(`SELECT 
                    OBJECTID, 
                    GLOBALID, 
                    SAMPLENUM, 
                    LOCATION, 
                    COLLECTDATE, 
                    SAMPLECOLLECTOR, 
                    ACODE, 
                    ANALYSEDDATE, 
                    ANALYSEDBY, 
                    ADDR1, 
                    ADDR5, 
                    GEOCODEMATCHEDADDRESS, 
                    RESULT, 
                    LOCOCODE, 
                    WARNING_STATUS, 
                    ANALYTE, 
                    STATUS, 
                    COMMENTS,
                    ACK_TIME,
                    ACK_BY,
                    CLOSED_TIME,
                    CLOSED_BY 
                    FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl}`, [], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result) => {
        if(err) {
          appLogger.error('Error getting alerts: ', err);
          return res.status(500).send('Error getting alerts');
        }
        else {
          res.json(result.rows);
        }
      });
      conn.release((err) => {
        if(err) {
          appLogger.error('Error releasing connection: ', err);
        }  
      });
    });
  })

/** 
  * @swagger
  * /alerts/status/{id}:
  *  post:
  *    summary: Update alert in limsalerts 
  *    description: Updates an alert in wqims.limsalerts based on the provided ID
  *    tags:
  *      - Alerts
  *    requestBody:
  *      required: true  
  *      content:
  *        application/json:
  *          schema: 
  *             type: object
  *             properties:
  *               status:
  *                 type: string
  *               comments:
  *                 type: string
  *    parameters:
  *      - in: path
  *        name: id
  *        required: true
  *        description: The ID of the alert to update
  *        schema:
  *          type: string
  *    responses:
  *      '200':
  *        description: Alert status changed successfully
  *        content:
  *          application/json:
  *            schema:
  *              type: object
  *      '502':
  *        description: Bad Gateway
  *        content:
  *          application/json:
  *            schema:
  *              type: string
  *              example: 'Bad Gateway: DB Connection Error'
  */
  alertsRouter.post('/status/:alertId', async (req, res) => {
    const alertId = req.params.alertId;
    const status = req.body?.STATUS === undefined ? 'ERROR' : req.body.STATUS;
    const comments = req.body?.COMMENTS === undefined ? '' : req.body.COMMENTS;
    let userEmail = '';
    let connection: Connection | null = null;
    let result!: any;
    jwt.verify(req.cookies['token'], JWT_SECRET_KEY, (err: any, decoded: any) => {
      if (err) {
        if(err.status === 403) {
          if(err.hasOwnProperty('error') && err.error.name === 'TokenExpiredError') {
              appLogger.error(err);
              res.status(403).send('Unauthorized');
          }
          else {
            appLogger.error(err);
            res.status(403).send('Forbidden');
          }
        }
        else {
          appLogger.error(err);
          res.status(401).send('Unauthorized');
        }
      }
      else {
        userEmail = decoded.email;
      }
    });
    const userName = userEmail.split('@')[0].replace('.', '_');
    try {
      connection = await pool.getConnection();
      const timestamp = getTimeStamp();

      const queryResult = await updateAlertStatus(userName, alertId, status, comments, connection);

      switch(status) {
        case "NEW":
          result = {
            ACK_BY: '',
            ACK_TIME: '',
            STATUS: 'NEW',
            COMMENTS: comments
          }
          break;
        case "ACKNOWLEDGED":
          result = {
            ACK_BY: userName,
            ACK_TIME: timestamp,
            STATUS: "ACKNOWLEDGED",
            COMMENTS: comments
          }
          break;
        case "CLOSED":
          result = {
            CLOSED_BY: userName,
            CLOSED_TIME: timestamp,
            STATUS: "CLOSED",
            COMMENTS: comments
          }
          break;
        default:
          result = {error: "Invalid status provided. Valid statuses are NEW, ACKNOWLEDGED, and CLOSED"};
      }
      res.json(result);
    }
    catch(err: any) {
      appLogger.error(err);
      res.status(502).send('Bad Gateway: DB Connection Error')
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
  });
})

function getAlerts(email: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `SELECT \
                    u.GLOBALID as user_id,
                    t.GLOBALID as threshold_id,
                    a.OBJECTID, 
                    a.GLOBALID, 
                    a.SAMPLENUM, 
                    a.LOCATION, 
                    a.COLLECTDATE, 
                    a.SAMPLECOLLECTOR, 
                    a.ACODE, 
                    a.ANALYSEDDATE, 
                    a.ANALYSEDBY, 
                    a.ADDR1, 
                    a.ADDR5, 
                    a.GEOCODEMATCHEDADDRESS, 
                    a.RESULT, 
                    a.LOCOCODE, 
                    a.WARNING_STATUS, 
                    a.ANALYTE, 
                    a.STATUS, 
                    a.COMMENTS,
                    a.ACK_TIME,
                    a.ACK_BY,
                    a.CLOSED_TIME,
                    a.CLOSED_BY
                  FROM
                    ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} u
                  JOIN
                    ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} ug ON u.GLOBALID = ug.USER_ID
                  JOIN
                    ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} tg ON ug.GROUP_ID = tg.GROUP_ID
                  JOIN
                    ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} t ON tg.THRSHLD_ID = t.GLOBALID
                  JOIN
                    ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl} a ON t.ANALYSIS = a.ACODE AND t.LOCCODE = a.LOCOCODE
                  WHERE
                    u.EMAIL = :email AND tg.ACTIVE = 1`;
    connection.execute(query, [email], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        if('rows' in result && result.rows.length > 0) {
          resolve(result.rows);
        }
        else {
          resolve([]);
        }
      }
    })
  })
}

function updateAlertStatus(userName: string, alertId: string, status: string, comments: string, connection: Connection): Promise<any> {
  return new Promise((resolve, reject) => {
    let query = '';
    switch(status) {
      case "NEW":
        query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl} SET STATUS =:status, ACK_BY='', ACK_TIME='', CLOSED_BY='', CLOSED_TIME='', COMMENTS=:comments WHERE GLOBALID = :alertId`;
        break;
      case "ACKNOWLEDGED":
        query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl} SET STATUS =:status, ACK_BY=:userName, ACK_TIME=TO_TIMESTAMP(:timestamp, 'YYYY-MM-DD HH:MI:SS.FF AM'), COMMENTS=:comments WHERE GLOBALID = :alertId`;
        break;
      case "CLOSED":
        query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl} SET STATUS =:status, CLOSED_BY=:userName, CLOSED_TIME=TO_TIMESTAMP(:timestamp, 'YYYY-MM-DD HH:MI:SS.FF AM'), COMMENTS=:comments WHERE GLOBALID = :alertId`;
        break;
      default:
        reject({error: "Invalid status provided. Valid statuses are NEW, ACKNOWLEDGED, and CLOSED"});
    } 
    const timestamp = getTimeStamp();
    const options = {
      autoCommit: true,
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    if(status === "NEW") {
      connection.execute(query, {status: status, comments: comments, alertId: alertId}, options, (err, result) => {
        if(err) {
          appLogger.error(err);
          reject(err);
        }
        else {
          resolve(result);
        }
      })
    } else {
      connection.execute(query, {status: status, userName: userName, timestamp: timestamp, comments: comments, alertId: alertId}, options, (err, result) => {
        if(err) {
          appLogger.error(err);
          reject(err);
        }
        else {
          resolve(result);
        }
      })
    }
  })
}

function getTimeStamp(): string {
  const pad = (number: number, digits: any) => String(number).padStart(digits, '0');
  const now = new Date();
  // oracle timestamp format YYYY-MM-DD HH:MM:SS:FF AM/PM

  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1, 2);
  const DD = pad(now.getDate(), 2);
  const hours24 = now.getHours();
  const HH = pad(hours24 % 12 || 12, 2);
  const mm = pad(now.getMinutes(), 2);
  const ss = pad(now.getSeconds(), 2);
  const ff = pad(now.getMilliseconds(), 3);
  const ampm = hours24 < 12 ? 'AM' : 'PM';

  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}.${ff} ${ampm}`
}

export default alertsRouter;