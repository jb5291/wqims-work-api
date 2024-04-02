import express from 'express';
import OracleDB from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";
import { appLogger } from '../util/appLogger';

const usersRouter = express.Router();

const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};

/**
 * @swagger
 * components:
 *  schemas:
 *    UserData:
 *      type: array
 *      items:
 *        - type: integer
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: integer
 *        - type: string
 *        - type: string
 *          nullable: true
 *        - type: string
 *          nullable: true
 *      example:
 *        - [1, "{D6C20167-1934-499C-BD60-20AA99C4145F}", "Bob", "Logistics", "Water", "2225554646", "bob@test.com", "Admin", 0, "tmobile", null, null]
 */

OracleDB.createPool(dbConf)
  .then(pool => {
    appLogger.info('Connection pool created');

    /**
     * @swagger
     * /users:
     *  get:
     *    summary: Get list of users
     *    description: Gets a list of groups from DSNGIST wqims.users
     *    tags: 
     *      - User Accounts 
     *    responses:
     *      '200':
     *        description: A list of users
     *        content:
     *          application/json:
     *            schema:
     *              type: array
     *              items:
     *                $ref: '#/components/schemas/UserData'
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    usersRouter.get('/', async (req, res) => {
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        }

        conn.execute(`select * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl}`, [], (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(502).send('DB Connection Error');
          }
          res.json(result.rows);

          conn.release();
        });
      });
    });
  })
  .catch(error => {
    appLogger.error("Error creating connection pool:", error)
  })  
// /users calls
// usersRouter.get('/users', (req, res) => {

// });

export default usersRouter;