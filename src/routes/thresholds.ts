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
 *        locCode:
 *          type: string
 *        locName:
 *          type: string
 *        prjName:
 *          type: string
 *        analysis:
 *          type: string
 *        analyte:
 *          type: string
 *        specs:
 *          type: string
 *        specValue:
 *          type: string
 *        ackTimeOut:
 *          type: number
 *        closeOutTimeOut:
 *          type: number
 *        checklistId:
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

      const thresholds = await getThresholds(connection);
      
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
   *    description: Adds a new threshold to DSNGIST wqims.thresholds
   *    tags: 
   *      - Thresholds 
   *    requestBody:
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/ThresholdData'
   *    responses:
   *      '200':
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
    try {
      connection = await pool.getConnection();

      const threshold = req.body;
      const result = await addThreshold(threshold, connection);

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

  /**
   * @swagger
   * /thresholds/{id}:
   *  delete:
   *    summary: deletes threshold from thresholds list
   *    description: deletes a threshold from DSNGIST wqims.lims_thresholds
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
   *        description: Threshold deleted successfully
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
      const result = await deleteThreshold(thresholdId, connection);

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
  thresholdsRouter.patch('/:id', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();

      const globalId = req.params.id;
      const threshold = req.body;
      const result = await updateThreshold(globalId, threshold, connection);

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

function getThresholds(connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.execute(
      `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl}`,
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

function addThreshold(threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} (LOCCODE, LOCATION_NAME, PROJECT_NAME, ANALYSIS, ANALYTE, UPPER_LOWER_SPECS, SPECS_VALUE, ACKTIMEOUT, CLOSEOUTTIMEOUT, CHECKLISTID) VALUES (:locCode, :locName, :prjName, :analysis, :analyte, :specs, :specValue, :ackTimeOut, :closeOutTimeOut, :checklistId)`;
    // const test_query = `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} VALUES (:objectId, :locCode, :locName, :prjName, :analysis, :analyte, :specs, :specValue, :ackTimeOut, :closeOutTimeOut, :checklistId, :globalId)`;
    const bindParams = {
      locCode: threshold.locCode,
      locName: threshold.locName,
      prjName: threshold.prjName,
      analysis: threshold.analysis,
      analyte: threshold.analyte,
      specs: threshold.specs,
      specValue: threshold.specValue,
      ackTimeOut: threshold.ackTimeOut,
      closeOutTimeOut: threshold.closeOutTimeOut,
      checklistId: threshold.checklistId
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
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.STRING, maxSize: 50},
        {type: OracleDB.NUMBER, maxSize: 5},
        {type: OracleDB.NUMBER, maxSize: 5},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    /* const test_options = {
      autoCommit: true,
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
          resolve(result.rows);
        }
      }
    );
  });
}

function deleteThreshold(thresholdId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} where GLOBALID=:thresholdId`
    const options = {
      autoCommit: true,
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

function updateThreshold(id: string, threshold: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query: string = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} set `;
    const bindParams: any = {};

    if (threshold.locCode) {
      query += `LOCCODE=:locCode, `;
      bindParams.locCode = threshold.locCode;
    }
    if (threshold.locName) {
      query += `LOCATION_NAME=:locName, `;
      bindParams.locName = threshold.locName;
    }
    if (threshold.prjName) {
      query += `PROJECT_NAME=:prjName, `;
      bindParams.prjName = threshold.prjName;
    }
    if (threshold.analysis) {
      query += `ANALYSIS=:analysis, `;
      bindParams.analysis = threshold.analysis;
    }
    if (threshold.analyte) {
      query += `ANALYTE=:analyte, `;
      bindParams.analyte = threshold.analyte;
    }
    if (threshold.specs) {
      query += `UPPER_LOWER_SPECS=:specs, `;
      bindParams.specs = threshold.specs;
    }
    if (threshold.specValue) {
      query += `SPECS_VALUE=:specValue, `;
      bindParams.specValue = threshold.specValue;
    }
    if (threshold.ackTimeOut) {
      query += `ACKTIMEOUT=:ackTimeOut, `;
      bindParams.ackTimeOut = threshold.ackTimeOut;
    }
    if (threshold.closeOutTimeOut) {
      query += `CLOSEOUTTIMEOUT=:closeOutTimeOut, `;
      bindParams.closeOutTimeOut = threshold.closeOutTimeOut;
    }
    if (threshold.checklistId) {
      query += `CHECKLISTID=:checklistId, `;
      bindParams.checklistId = threshold.checklistId;
    }

    query = query.slice(0, -2);

    query += ` where GLOBALID=:globalId`; // remove trailing comma

    connection.execute(query, { ...bindParams, globalId: threshold.globalId }, { autoCommit: true }, (err: any, result: any) => {
      if (err) {
        appLogger.error("Error executing query:", err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
}

export default thresholdsRouter;