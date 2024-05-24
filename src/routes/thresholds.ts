import express from 'express';
import OracleDB, { Connection } from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";
import { appLogger } from '../util/appLogger';

const thresholdsRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};
/**
 * @swagger
 * components:
 *  schemas:
 *    ThresholdData:
 *      type: object
 *      properties:
 *        LOCCODE:
 *          type: string
 *        LOCATION_NAME:
 *          type: string
 *        PROJECT_NAME:
 *          type: string
 *        ANALYSIS:
 *          type: string
 *        ANALYTE:
 *          type: string
 *        UPPER_LOWER_SPECS:
 *          type: string
 *        SPECS_VALUE:
 *          type: string
 *        ACKTIMEOUT:
 *          type: number
 *        CLOSEOUTTIMEOUT:
 *          type: number
 *        CHECKLISTID:
 *          type: string
 *        SYSTEM:
 *          type: string
 *        ACTIVE:
 *          type: number
 *        UNIT:
 *          type: string
 */

OracleDB.createPool(dbConf)
.then(pool => {
  appLogger.info('connection pool created for thresholds');

  /**
   * @swagger
   * /thresholds:
   *  get:
   *    summary: Get list of thresholds
   *    description: Gets a list of groups from DSNGIST wqims.thresholds
   *    tags: 
   *      - Thresholds 
   *    responses:
   *      '200':
   *        description: A list of thresholds
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              items:
   *                $ref: '#/components/schemas/ThresholdData'
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  thresholdsRouter.get('/', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();

      const thresholds: any = await getActiveThresholds(connection);

      if(thresholds) {
        thresholds.forEach((threshold: any) => {
          threshold.ACKTIMEOUT = threshold.ACKTIMEOUT ? parseInt(threshold.ACKTIMEOUT) : 0;
          threshold.CLOSEOUTTIMEOUT = threshold.CLOSEOUTTIMEOUT ? parseInt(threshold.CLOSEOUTTIMEOUT) : 0;
          threshold.UPPER_LOWER_SPECS = threshold.UPPER_LOWER_SPECS === 'USPEC' ? 'Upper' : 'Lower';
        });
      }
      
      res.json(thresholds);
    } catch (err) {
      appLogger.error(err);
      res.status(502).send('DB Connection Error');
    } finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error(err);
          }
        });
      }
    }
  });

  /**
   * @swagger
   * /thresholds:
   *  put:
   *    summary: Add a new threshold
   *    description: Adds a new threshold to DSNGIST wqims.limsthresholds
   *    tags: 
   *      - Thresholds 
   *    requestBody:
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/ThresholdData'
   *    responses:
   *      '201':
   *        description: Threshold added successfully
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  thresholdsRouter.put('/', async (req, res) => {
    let connection: Connection | null = null;
    let result;
    try {
      connection = await pool.getConnection();

      const threshold = req.body;
      const inactiveThreshold: any = await findInactiveThreshold(threshold, connection);

      if(inactiveThreshold.length > 0) {
        result = await addInactiveThreshold(inactiveThreshold[0], connection); 
      }
      else {
        result = await addThreshold(threshold, connection);
      }
      connection.commit();
      res.json(result);
    } catch (err) {
      appLogger.error(err);
      connection?.rollback();
      res.status(502).send('DB Connection Error, operation rolled back');
    } finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error(err);
          }
        });
      }
    }
  });

  /**
   * @swagger
   * /thresholds/{id}:
   *  delete:
   *    summary: deactivates threshold from thresholds list
   *    description: deactivates a threshold from DSNGIST wqims.lims_thresholds
   *    tags: 
   *      - Thresholds
   *    parameters:
   *      - in: path
   *        name: id
   *        schema:
   *          type: string
   *        required: true
   *        description: global ID of the threshold
   *    responses:
   *      '200':
   *        description: Threshold deactivated successfully
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  thresholdsRouter.delete('/:id', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();

      const thresholdId = req.params.id;
      const result = await deactivateThreshold(thresholdId, connection);
      await deactivateGroupThresholds(thresholdId, connection);

      connection.commit();
      res.json(result);
    } catch (err) {
      appLogger.error(err);
      connection?.rollback();
      res.status(502).send('DB Connection Error, operation rolled back');
    } finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error(err);
          }
        });
      }
    }
  });

  /**
   * @swagger
   * /thresholds/{id}:
   *  patch:
   *    summary: Update a threshold
   *    description: Updates a threshold in DSNGIST wqims.thresholds
   *    tags: 
   *      - Thresholds 
   *    parameters:
   *      - in: path
   *        name: id
   *        schema:
   *          type: string
   *        required: true
   *        description: Global ID of the threshold
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/ThresholdData'
   *    responses:
   *      '200':
   *        description: Threshold updated successfully
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  thresholdsRouter.patch('/', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();

      const threshold = req.body;
      const result = await updateThreshold(threshold, connection);

      res.json(result);
    } catch (err) {
      appLogger.error(err);
      res.status(502).send('DB Connection Error');
    } finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error(err);
          }
        });
      }
    }
  });
})

function getActiveThresholds(connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.execute(
      `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} where SPECS_VALUE is not null and ACTIVE <> 0`,
      [],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
      (err: any, result: any) => {
        if (err) {
          appLogger.error(err);
          reject(err);
        } else {
          resolve(result.rows);
        }
      }
    );
  });
}

function findInactiveThreshold(threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.execute(
      `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} where SPECS_VALUE is not null and ACTIVE = 0 and LOCCODE=:loccode and ANALYSIS=:analysis`,
      [
        threshold.LOCCODE,
        threshold.ANALYSIS
      ],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
      (err: any, result: any) => {
        if (err) {
          appLogger.error(err);
          reject(err);
        } else {
          resolve(result.rows);
        }
      }
    );
  });
}

function addInactiveThreshold(threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} set ACTIVE=1 where GLOBALID=:globalid`;
    const options = {
      autoCommit: false,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 50}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, 
      { 
        globalid: threshold.GLOBALID
      }, 
      options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        threshold.ACTIVE = 1;
        resolve(threshold);
      }
    })
  });
}

function addThreshold(threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    // taking out project name and checklist ID
    const query = `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} (LOCCODE, LOCATION_NAME, ANALYSIS, ANALYTE, UPPER_LOWER_SPECS, SPECS_VALUE, ACKTIMEOUT, CLOSEOUTTIMEOUT, SYSTEM, ACTIVE) VALUES (:locCode, :locName, :analysis, :analyte, :specs, :specValue, :ackTimeOut, :closeOutTimeOut, :system, :active) returning GLOBALID, OBJECTID into :outGid, :outOid`;
    // const test_query = `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} VALUES (:objectId, :locCode, :locName, :prjName, :analysis, :analyte, :specs, :specValue, :ackTimeOut, :closeOutTimeOut, :checklistId, :globalId)`;
    const bindParams = {
      locCode: threshold.LOCCODE,
      locName: threshold.LOCATION_NAME,
      //prjName: threshold.PROJECT_NAME,
      analysis: threshold.ANALYSIS,
      analyte: threshold.ANALYTE,
      specs: threshold.UPPER_LOWER_SPECS,
      specValue: threshold.SPECS_VALUE,
      ackTimeOut: threshold.ACKTIMEOUT,
      closeOutTimeOut: threshold.CLOSEOUTTIMEOUT,
      //checklistId: threshold.CHECKLISTID,
      system: threshold.SYSTEM,
      active: 1,
      outGid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
      outOid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT}
    }
    /* const test_bindParams = {
      objectId: threshold.objectId,
      locCode: threshold.locCode,
      locName: threshold.locName,
      prjName: threshold.prjName,
      analysis: threshold.analysis,
      analyte: threshold.analyte,
      specs: threshold.specs,
      specValue: threshold.specValue,
      ackTimeOut: threshold.ackTimeOut,
      closeOutTimeOut: threshold.closeOutTimeOut,
      checklistId: threshold.checklistId,
      globalId: threshold.globalId
    } */
    const options = {
      autoCommit: false,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        //{type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.NUMBER, maxSize: 5},
        {type: OracleDB.NUMBER, maxSize: 5},
        //{type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.NUMBER, maxSize: 1}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    /* const test_options = {
      autoCommit: false,
      bindDefs: [
        {type: OracleDB.NUMBER, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.NUMBER, maxSize: 5},
        {type: OracleDB.NUMBER, maxSize: 5},
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ]
    } */
    connection.execute(
      query,
      bindParams,
      options,
      (err: any, result: any) => {
        if (err) {
          appLogger.error(err);
          reject(err);
        } else {
          const ids = result.outBinds as any;
          threshold.GLOBALID = ids.outGid[0];
          threshold.OBJECTID = ids.outOid[0];
          resolve(threshold);
        }
      }
    );
  });
}

function deactivateThreshold(thresholdId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} set ACTIVE=0 where GLOBALID=:thresholdId`
    const options = {
      autoCommit: false,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, { thresholdId: thresholdId }, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function updateThreshold(threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query: string = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} set `;
    const bindParams: any = {};

    if (threshold.LOCCODE) {
      query += `LOCCODE=:LOCCODE, `;
      bindParams.LOCCODE = threshold.LOCCODE;
    }
    if(threshold.SYSTEM) {
      query += `SYSTEM=:SYSTEM, `;
      bindParams.SYSTEM = threshold.SYSTEM;
    }
    if (threshold.LOCATION_NAME) {
      query += `LOCATION_NAME=:LOCATION_NAME, `;
      bindParams.LOCATION_NAME = threshold.LOCATION_NAME;
    }
    if (threshold.PROJECT_NAME) {
      query += `PROJECT_NAME=:PROJECT_NAME, `;
      bindParams.PROJECT_NAME = threshold.PROJECT_NAME;
    }
    if (threshold.ANALYSIS) {
      query += `ANALYSIS=:ANALYSIS, `;
      bindParams.ANALYSIS = threshold.ANALYSIS;
    }
    if (threshold.ANALYTE) {
      query += `ANALYTE=:ANALYTE, `;
      bindParams.ANALYTE = threshold.ANALYTE;
    }
    if (threshold.UPPER_LOWER_SPECS) {
      query += `UPPER_LOWER_SPECS=:UPPER_LOWER_SPECS, `;
      bindParams.UPPER_LOWER_SPECS = threshold.UPPER_LOWER_SPECS;
    }
    if (threshold.SPECS_VALUE) {
      query += `SPECS_VALUE=:SPECS_VALUE, `;
      bindParams.SPECS_VALUE = threshold.SPECS_VALUE;
    }
    if (threshold.ACKTIMEOUT) {
      query += `ACKTIMEOUT=:ACKTIMEOUT, `;
      bindParams.ACKTIMEOUT = threshold.ACKTIMEOUT;
    }
    if (threshold.CLOSEOUTTIMEOUT) {
      query += `CLOSEOUTTIMEOUT=:CLOSEOUTTIMEOUT, `;
      bindParams.CLOSEOUTTIMEOUT = threshold.CLOSEOUTTIMEOUT;
    }
    if (threshold.CHECKLISTID) {
      query += `CHECKLISTID=:CHECKLISTID, `;
      bindParams.CHECKLISTID = threshold.CHECKLISTID;
    }
    if(threshold.UNIT) {
      query += `UNIT=:UNIT, `;
      bindParams.UNIT = threshold.UNIT;
    }

    query = query.slice(0, -2);

    query += ` where GLOBALID=:globalId`; // remove trailing comma

    connection.execute(query, { ...bindParams, globalId: threshold.GLOBALID }, { autoCommit: true }, (err: any, result: any) => {
      if (err) {
        appLogger.error("Error executing query:", err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
}

function deactivateGroupThresholds(thresholdId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} set ACTIVE=0 where THRSHLD_ID=:thresholdId`
    const options = {
      autoCommit: false,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, { thresholdId: thresholdId }, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result)
      }
    });
  })
}

export default thresholdsRouter;