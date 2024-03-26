import express from 'express';
import OracleDB from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";

const router = express.Router();

const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};

// /notificationGroups
// gets all notification groups
router.get('/notificationGroups) {

}

// /notificationGroups/:id
// gets group information for specific group
router.get('/notificationGroups/:id') {

}

export default router; 

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