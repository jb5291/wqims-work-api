import express, { query } from "express";
import { createPool } from 'oracledb';
import cors from 'cors';

import { WQIMS_DB_CONFIG } from "./util/secrets";
import { appLogger } from "./util/appLogger";

const app = express();
app.use(cors());

const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};

createPool(dbConf)
  .then(pool => {
    appLogger.info('Connection pool created');
    app.get('/api/notificationGroups', async (req, res) => {
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(500).send('Internal Server Error');
        }

        conn.execute(`select groupName, groupid, objectid FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl}`, [], (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(500).send('Internal Server Error');
          }
          res.json(result.rows);

          conn.release();
        });
      });
    });

    app.get('/api/notificationGroups/:id', async (req, res) => {
      try {
        const conn = await pool.getConnection();
        const group_id = req.params.id;

        const queryGrpUsers = `select user_id FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where group_id = '${group_id.toUpperCase()}'`
        const queryGrpUsersResult = await conn.execute(queryGrpUsers)
        const user_ids = queryGrpUsersResult.rows
        
        const queryUserNames = `select name, globalid FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where globalid in ('${user_ids?.join(',')}')`
        const result = await conn.execute(queryUserNames)

        res.json(result.rows)

        conn.release()
      } catch (err) {
        appLogger.error('Error getting connection: ', err);
        return res.status(500).send('Internal Server Error');
      }        
    });
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      appLogger.info('Proxy server running http://localhost:3001');
    });
  })
  .catch(err => {
    appLogger.error("Error creating connection pool:", err);
  })

  
