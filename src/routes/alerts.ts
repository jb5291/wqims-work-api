import express, { application } from 'express';
import OracleDB,  { Connection } from 'oracledb';
import jwt from 'jsonwebtoken';

import { JWT_SECRET_KEY, WQIMS_DB_CONFIG } from '../util/secrets';
import { appLogger } from '../util/appLogger';
import cookieParser from 'cookie-parser';
import { getIdFromEmail } from './auth';

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
      const userId = await getIdFromEmail(userEmail, connection);
      if(userId === undefined) {
        res.sendStatus(401);
      }
      const groupIds: any = await getUserGroupIds(connection, userId);
      if(groupIds.length > 0) {
        const thresholdIds: any = await getThresholdIdsFromGroupIds(groupIds.map((g:any) => g.GROUP_ID), connection);
        const thresholds: any = await getThresholdsFromThresholdIds(thresholdIds.map((t:any) => t.THRSHLD_ID), connection);

        const threshold_acode_loccode = thresholds.map((t:any) => [t.ANALYSIS, t.LOCCODE]);
        result = await getAlertsFromThresholds(threshold_acode_loccode, connection);
        res.json(result.rows);
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

  /* alertsRouter.put('/alerts', async(req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();
      const alert = req.body.alert;

      const addResults = await addAlerts(connection, alert);

      res.json(addResults);
    } catch (err) {
      appLogger.error(err);
      res.status(500).send('Error updating alert');
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          appLogger.error(err);
        }
      }
    }
  }); */
})

// might not need functionality to add alerts
/* function addAlerts(conn: Connection, alert: any) {
  return new Promise((resolve, reject) => {
    const query = 
  });
} */

function getUserGroupIds(connection: Connection, userId: string) {
  return new Promise((resolve, reject) => {
    connection.execute(
      `SELECT GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} WHERE USER_ID = :userId`,
      [userId],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
      (err, result) => {
        if(err) {
          appLogger.error(err);
          reject(err);
        }
        else {
          resolve(result.rows);
        }
      }
    )
  });
}

function getThresholdIdsFromGroupIds(groupIds: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const binds: any = {}
    const placeholder: any = groupIds.map((_:any,i:number) => `:id${i}`).join(',');
    groupIds.forEach((g: any, i: number) => {
      binds[`id${i}`] = g;
    })
    const query = `SELECT THRSHLD_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} WHERE GROUP_ID IN (${placeholder}) AND ACTIVE = 1`
    connection.execute(query, binds, { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result.rows);
      }
    })
  });
}

function getThresholdsFromThresholdIds(thresholdIds: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const binds: any = {}
    const placeholder: any = thresholdIds.map((_:any,i:number) => `:id${i}`).join(',');
    thresholdIds.forEach((t: any, i: number) => {
      binds[`id${i}`] = t;
    })
    const query = `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} WHERE GLOBALID IN (${placeholder}) AND ACTIVE = 1`;
    connection.execute(query, binds, { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result) => {
        if(err) {
          appLogger.error(err);
          reject(err);
        }
        else {
          resolve(result.rows);
        }
      }
    )
  });
}

function getAlertsFromThresholds(thresholds: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const placeholders = thresholds.map((t: any, i: number) => `(:acode${i}, :loccode${i})`).join(',');
    const binds: any = {}
    thresholds.forEach(([acode, loccode]: string[] , i: number) => {
      binds[`acode${i}`] = acode;
      binds[`loccode${i}`] = loccode;
    })
    const query = `SELECT OBJECTID, GLOBALID, SAMPLENUM, LOCATION, COLLECTDATE, SAMPLECOLLECTOR, ACODE, ANALYSEDDATE, ANALYSEDBY, ADDR1, ADDR5, GEOCODEMATCHEDADDRESS, RESULT, LOCOCODE, WARNING_STATUS, ANALYTE FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl} WHERE (ACODE, LOCOCODE) in (${placeholders})`;
    connection.execute(query, binds, { outFormat: OracleDB.OUT_FORMAT_OBJECT }, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result);
      }
    })
  })
}

export default alertsRouter;