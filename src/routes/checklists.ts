import express from 'express'
import OracleDB, { Connection} from 'oracledb'

import { WQIMS_DB_CONFIG } from '../util/secrets'
import { appLogger, actionLogger } from '../util/appLogger'

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
 *     
 */
OracleDB.createPool(dbConf)
  .then((pool) => {
    appLogger.info('connection pool created for checklists');

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
    checklistsRouter.get('/', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();
        const result = await connection.execute(
          `SELECT * FROM CHECKLIST_TEMPLATES`
        );
        res.json(result.rows);
      } catch (err) {
        appLogger.error(err);
        res.status(502).send('Bad Gateway: DB Connection Error');
      } finally {
        if (connection) {
          try {
            await connection.close();
          } catch (err) {
            appLogger.error(err);
          }
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
     *               TemplateName:
     *                 type: string
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
    checklistsRouter.put('/', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();
        // going to need logic for adding steps and assigning them to correct template
        const result = await connection.execute(
          `INSERT INTO ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.checklistTemplateTbl} (TEMPLATE_NAME) VALUES (:templateName)`,
          [req.body.TemplateName]
        );
        res.json(result.rows);
      } catch (err) {
        appLogger.error(err);
        res.status(502).send('Bad Gateway: DB Connection Error');
      } finally {
        if (connection) {
          try {
            await connection.close();
          } catch (err) {
            appLogger.error(err);
          }
        }
      }
    })

    /**
     * @swagger
     * /checklists/{globalid}:
     *   delete:
     *     summary: Delete a checklist template
     *     description: Delete a checklist template
     *     tags:
     *       - Checklists
     *     parameters:
     *       - in: path
     *         name: globalid
     *         required: true
     *         description: Global ID of the checklist template to delete
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successfully deleted the checklist template
     *       502:
     *         description: Bad Gateway
     *         content:
     *           application/json:
     *             schema:
     *               type: string
     *               example: 'Bad Gateway: DB Connection Error'
     */
    checklistsRouter.delete('/:globalid', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();
        const result = await connection.execute(
          `DELETE FROM CHECKLIST_TEMPLATES WHERE GLOBALID = :globalid`,
          [req.params.globalid]
        );
        res.json(result.rows);
      } catch (err) {
        appLogger.error(err);
        res.status(502).send('Bad Gateway: DB Connection Error');
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
     * /checklists/{globalid}:
     *   patch:
     *     summary: Update a checklist template
     *     description: Update a checklist template
     *     tags:
     *       - Checklists
     *     parameters:
     *       - in: path
     *         name: globalid
     *         required: true
     *         description: Global ID of the checklist template to update
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *       application/json:
     *         schema:
     *           type: object
     *           properties:
     *             TemplateName:
     *               type: string
     *     responses:
     *       200:
     *         description: Successfully updated the checklist template
     *       502:
     *         description: Bad Gateway
     *         content:
     *           application/json:
     *             schema:
     *               type: string
     *               example: 'Bad Gateway: DB Connection Error'
     */
    checklistsRouter.patch('/:globalid', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();
        const result = await connection.execute(
          `UPDATE CHECKLIST_TEMPLATES SET TEMPLATE_NAME = :templateName WHERE GLOBALID = :globalid`,
          [req.body.TemplateName, req.params.globalid]
        );
        res.json(result.rows);
      } catch (error) {
        appLogger.error(error);
        res.status(502).send('Bad Gateway: DB Connection Error');
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
  });

export default checklistsRouter;