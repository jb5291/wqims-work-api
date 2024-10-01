import express from 'express'
import OracleDB, { Connection} from 'oracledb'

import { WQIMS_DB_CONFIG } from '../util/secrets'
import { appLogger, actionLogger } from '../util/appLogger'
import { verifyAndRefreshToken, logRequest } from './auth';
import WqimsChecklist from '../models/WqimsChecklist';

const checklistsRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
}

/**
 * @swagger
 * components:
 *  schemas:
 *    checklistTemplate:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        TEMPLATE_NAME:
 *          type: string
 *        CREATED_AT:
 *          type: string
 *        UPDATED_AT:
 *          type: string
 *    checklistItem:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        TEMPLATE_ID:
 *          type: string
 *        DESCRIPTION:
 *          type: string
 *        ORDER_:
 *          type: number
 *        CREATED_AT:
 *          type: string
 *        UPDATED_AT:
 *          type: string
 */

/**
     * @swagger
     * /checklists:
     *  get:
     *    summary: Get all checklist templates
     *    description: Get all checklist templates
     *    tags:
     *      - Checklists
     *    responses:
     *      200:
     *        description: A list of checklist templates
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *              items:
     *                $ref: '#/components/schemas/checklistTemplate'
     *      502:
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
checklistsRouter.get('/', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const getChecklistResult = await WqimsChecklist.getActiveFeatures();
    res.json(getChecklistResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Checklists GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists GET error" });
    }
  }
})

/**
     * @swagger
     * /checklists:
     *   put:
     *     summary: Create a new checklist template
     *     description: Create a new checklist template
     *     tags:
     *       - Checklists
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               checklistTemplate:
     *     responses:
     *       200:
     *         description: Successfully created a new checklist template
     *       502:
     *         description: Bad Gateway
     *         content:
     *           application/json:
     *             schema:
     *               type: string
     *               example: 'Bad Gateway: DB Connection Error'
     */
checklistsRouter.put('/', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const timestamp = new Date();
    const checklist = new WqimsChecklist(req.body, timestamp);
    checklist.CREATED_AT = timestamp;
    checklist.UPDATED_AT = timestamp;

    const result = await checklist.addFeature();
    res.json(result);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Checklists PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists PUT error" });
    }
  }
});
// OracleDB.createPool(dbConf)
//   .then((pool) => {
//     appLogger.info('connection pool created for checklists');

    
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const result = await connection.execute(
//           `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistTemplateTbl}`
//         );
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     })

    
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const createdAt = getTimeStamp();
//         const result = await connection.execute(
//           `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistTemplateTbl} (TEMPLATE_NAME, CREATED_AT, UPDATED_AT) VALUES (:templateName, TO_TIMESTAMP(:createdAt, 'YYYY-MM-DD HH:MI:SS:FF AM'), TO_TIMESTAMP(:createdAt, 'YYYY-MM-DD HH:MI:SS:FF AM'))`,
//           {templateName: req.body.TemplateName, createdAt: createdAt},
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     })

//     /**
//      * @swagger
//      * /checklists/{globalid}:
//      *   delete:
//      *     summary: Delete a checklist template
//      *     description: Delete a checklist template
//      *     tags:
//      *       - Checklists
//      *     parameters:
//      *       - in: path
//      *         name: globalid
//      *         required: true
//      *         description: Global ID of the checklist template to delete
//      *         schema:
//      *           type: string
//      *     responses:
//      *       200:
//      *         description: Successfully deleted the checklist template
//      *       502:
//      *         description: Bad Gateway
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: string
//      *               example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.delete('/:globalid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const result = await connection.execute(
//           `DELETE FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistTemplateTbl} WHERE GLOBALID = :globalid`,
//           [req.params.globalid]
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });

//     /**
//      * @swagger
//      * /checklists/{globalid}:
//      *   patch:
//      *     summary: Update a checklist template
//      *     description: Update a checklist template
//      *     tags:
//      *       - Checklists
//      *     parameters:
//      *       - in: path
//      *         name: globalid
//      *         required: true
//      *         description: Global ID of the checklist template to update
//      *         schema:
//      *           type: string
//      *     requestBody:
//      *       required: true
//      *       content:
//      *         application/json:
//      *           schema:
//      *             type: object
//      *             properties:
//      *               TemplateName:
//      *                 type: string
//      *     responses:
//      *       200:
//      *         description: Successfully updated the checklist template
//      *       502:
//      *         description: Bad Gateway
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: string
//      *               example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.patch('/:globalid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const updatedAt = getTimeStamp();
//         const result = await connection.execute(
//           `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistTemplateTbl} SET TEMPLATE_NAME = :templateName, UPDATED_AT = TO_TIMESTAMP(:updatedAt, 'YYYY-MM-DD HH:MI:SS:FF AM') WHERE GLOBALID = :globalid`,
//           [req.body.TemplateName, updatedAt, req.params.globalid]
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (error) {
//         appLogger.error(error);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });

//     /**
//      * @swagger
//      * /checklists/items/{templateid}:
//      *  get:
//      *    summary: Get all checklist items for a checklist template
//      *    description: Get all checklist items for a checklist template
//      *    tags:
//      *      - Checklists
//      *    parameters:
//      *      - in: path
//      *        name: templateid
//      *        required: true
//      *        description: Global ID of the checklist template
//      *        schema:
//      *          type: string
//      *    responses:
//      *      200:
//      *        description: A list of checklist items
//      *        content:
//      *          application/json:
//      *            schema:
//      *              type: object
//      *              items:
//      *                $ref: '#/components/schemas/checklistItem'
//      *      502:
//      *        description: Bad Gateway
//      *        content:
//      *          application/json:
//      *            schema:
//      *              type: string
//      *              example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.get('/items/:templateid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const result = await connection.execute(
//           `SELECT * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistItemTbl} WHERE TEMPLATE_ID = :globalid`,
//           [req.params.templateid]
//         );
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });

//     /**
//      * @swagger
//      * /checklists/items/{templateid}:
//      *   put:
//      *     summary: Create a new checklist item
//      *     description: Create a new checklist item
//      *     tags:
//      *       - Checklists
//      *     parameters:
//      *      - in: path
//      *        name: templateid
//      *        required: true
//      *        description: Global ID of the checklist template
//      *        schema:
//      *          type: string
//      *     requestBody:
//      *       required: true
//      *       content:
//      *         application/json:
//      *           schema:
//      *             type: object
//      *             properties:
//      *               Description:
//      *                 type: string
//      *               Order:
//      *                 type: number
//      *     responses:
//      *       200:
//      *         description: Successfully created a new checklist template
//      *       502:
//      *         description: Bad Gateway
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: string
//      *               example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.put('/items/:templateid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const templateId = req.params.templateid;
//         const description = req.body.Description || '';
//         const order = req.body.Order || 0;
//         const createdAt = getTimeStamp();
//         const result = await connection.execute(
//           `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistItemTbl} (TEMPLATE_ID, DESCRIPTION, ORDER_, CREATED_AT, UPDATED_AT) VALUES (:templateid, :description, :order_, TO_TIMESTAMP(:createdAt, 'YYYY-MM-DD HH:MI:SS:FF AM'), TO_TIMESTAMP(:createdAt, 'YYYY-MM-DD HH:MI:SS:FF AM'))`,
//           {templateid: templateId, description: description, order_: order, createdAt: createdAt}
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });

//     /**
//      * @swagger
//      * /checklists/items/{templateid}/{globalid}:
//      *   delete:
//      *     summary: Delete a checklist item from a checklist template
//      *     description: Delete a checklist item from a checklist template
//      *     tags:
//      *       - Checklists
//      *     parameters:
//      *       - in: path
//      *         name: templateid
//      *         required: true
//      *         description: Global ID of the checklist template
//      *         schema:
//      *           type: string
//      *       - in: path
//      *         name: globalid
//      *         required: true
//      *         description: Global ID of the checklist item to delete
//      *         schema:
//      *           type: string
//      *     responses:
//      *       200:
//      *         description: Successfully deleted the checklist item from the checklist template
//      *       502:
//      *         description: Bad Gateway
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: string
//      *               example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.delete('/items/:templateid/:globalid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const result = await connection.execute(
//           `DELETE FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistItemTbl} WHERE GLOBALID = :globalid`,
//           [req.params.globalid]
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (err) {
//         appLogger.error(err);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });

//     /**
//      * @swagger
//      * /checklists/items/{templateid}/{globalid}:
//      *   patch:
//      *     summary: Update a checklist item
//      *     description: Update a checklist item
//      *     tags:
//      *       - Checklists
//      *     parameters:
//      *       - in: path
//      *         name: globalid
//      *         required: true
//      *         description: Global ID of the checklist item to update
//      *         schema:
//      *           type: string
//      *       - in: path
//      *         name: templateid
//      *         required: true
//      *         description: Global ID of the checklist template
//      *         schema:
//      *           type: string
//      *     requestBody:
//      *       required: true
//      *       content:
//      *         application/json:
//      *           schema:
//      *             type: object
//      *             properties:
//      *               Description:
//      *                 type: string
//      *               Order:
//      *                 type: number
//      *     responses:
//      *       200:
//      *         description: Successfully updated the checklist item
//      *       502:
//      *         description: Bad Gateway
//      *         content:
//      *           application/json:
//      *             schema:
//      *               type: string
//      *               example: 'Bad Gateway: DB Connection Error'
//      */
//     checklistsRouter.patch('/items/:templateid/:globalid', async (req, res) => {
//       let connection: Connection | null = null;
//       try {
//         connection = await pool.getConnection();
//         const updatedAt = getTimeStamp();
//         const result = await connection.execute(
//           `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistItemTbl} SET DESCRIPTION = :description, ORDER_ = :order_, UPDATED_AT = TO_TIMESTAMP(:updatedAt, 'YYYY-MM-DD HH:MI:SS:FF AM') WHERE GLOBALID = :globalid`,
//           [req.body.Description, req.body.Order, updatedAt, req.params.globalid]
//         );
//         connection.commit();
//         res.json(result.rows);
//       } catch (error) {
//         appLogger.error(error);
//         res.status(502).send('Bad Gateway: DB Connection Error');
//       } finally {
//         if (connection) {
//           try {
//             await connection.close();
//           } catch (err) {
//             appLogger.error(err);
//           }
//         }
//       }
//     });
//   });

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
export default checklistsRouter;