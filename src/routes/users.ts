import express from 'express';

import { WQIMS_DB_CONFIG } from "../util/secrets";

const router = express.Router();

const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};

// /users calls
router.get('/users', (req, res) => {

});

app.get('/api/users', async (req, res) => {
  pool.getConnection((err, conn) => {
    if(err) {
      appLogger.error('Error getting connection: ', err);
      return res.status(500).send('Internal Server Error');
    }

    conn.execute(`select * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl}`, [], (err, result) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        return res.status(500).send('Internal Server Error');
      }
      res.json(result.rows);

      conn.release();
    });
  });
});

export default router;