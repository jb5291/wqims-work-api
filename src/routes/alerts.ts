import express, { application } from 'express';
import OracleDB,  { Connection } from 'oracledb';
import jwt from 'jsonwebtoken';

import { JWT_SECRET_KEY, WQIMS_DB_CONFIG } from '../util/secrets';
import { appLogger } from '../util/appLogger';
import cookieParser from 'cookie-parser';
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
  alertsRouter.get('/', async (req, res) => {
    let connection: Connection | null = null;
    let userEmail: string = '';
    let result: any = null;
    try {
      connection = await pool.getConnection();
      jwt.verify(req.cookies['token'], JWT_SECRET_KEY, (err: any, decoded: any) => {
        if (err) {
          appLogger.error(err);
          res.status(401).send('Unauthorized');
        }
        else {
          userEmail = decoded.email;
        }
      });
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
})

function getAlerts(email: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `SELECT \
                    u.GLOBALID,
                    ug.GROUP_ID, ug.USER_ID,
                    tg.GROUP_ID, tg.THRSHLD_ID,
                    t.GLOBALID, t.ANALYSIS, t.LOCCODE,
                    a.OBJECTID, a.GLOBALID, a.SAMPLENUM, a.LOCATION, a.COLLECTDATE, a.SAMPLECOLLECTOR, a.ACODE, a.ANALYSEDDATE, a.ANALYSEDBY, a.ADDR1, a.ADDR5, a.GEOCODEMATCHEDADDRESS, a.RESULT, a.LOCOCODE, a.WARNING_STATUS, a.ANALYTE
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
                    u.EMAIL = :email AND t.ACTIVE = 1`;
    connection.execute(query, [email], { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result: any) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        if(result.hasOwnProperty('rows') && result.rows.length > 0) {
          resolve(result.rows);
        }
        else {
          resolve([]);
        }
      }
    })
  })
}

export default alertsRouter;