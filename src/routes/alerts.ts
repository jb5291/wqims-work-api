import express, { application } from 'express';
import OracleDB,  { Connection } from 'oracledb';
import jwt from 'jsonwebtoken';

import { JWT_SECRET_KEY, WQIMS_DB_CONFIG } from '../util/secrets';
import { appLogger } from '../util/appLogger';
import cookieParser from 'cookie-parser';

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

      if(userEmail !== '') {
        const userIdResult: any = await connection.execute(
          `SELECT globalid from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where email = :email`,
          [userEmail],
          { outFormat: OracleDB.OUT_FORMAT_OBJECT }
        )
        const userId = userIdResult.rows[0].GLOBALID;
        const userGroupIds: any = await getUserGroupIds(connection, userId); 
      }
      const result = await connection.execute(
        `SELECT OBJECTID, GLOBALID, SAMPLENUM, LOCATION, COLLECTDATE, SAMPLECOLLECTOR, ACODE, ANALYSEDDATE, ANALYSEDBY, ADDR1, ADDR5, GEOCODEMATCHEDADDRESS, RESULT, LOCOCODE, WARNING_STATUS, ANALYTE FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.alertsTbl}`,
        [],
        { outFormat: OracleDB.OUT_FORMAT_OBJECT }
      );
      res.json(result.rows);
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
      `SELECT GROUPID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} WHERE USERID = :userId`,
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

export default alertsRouter;