import express from 'express';
import OracleDB, { Connection } from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";
import { appLogger } from '../util/appLogger';
import graphHelper from '../util/graph';

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
 *      type: object
 *      properties:
 *        Name:
 *          type: string
 *        Department:
 *          type: string
 *        Division:
 *          type: string
 *        SupervisorID:
 *          type: string
 *          nullable: true
 *        PhoneNumber:
 *          type: string
 *        Email:
 *          type: string
 *        Role:
 *          type: string
 *        RapidResponseTeam:
 *           type: integer
 *        MobileCarrier:
 *           type: string
 *           nullable: true
 *        AltPhoneNumber:
 *           type: string
 *           nullable: true
 *        AltMobileCarrier:
 *           type: string
 *           nullable: true
 */

OracleDB.createPool(dbConf)
.then(pool => {
  appLogger.info('Connection pool created for users');

  /**
   * @swagger
   * /users:
   *  get:
   *    summary: Get list of users
   *    description: Gets a list of groups from DSNGIST wqims.users
   *    tags: 
   *      - Users
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

  /**
   * @swagger
   * /users:
   *  put:
   *    summary: Add a new user to wqims.users
   *    description: Adds a new user to wqims.users table
   *    tags:
   *      - Users
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/UserData'
   *    responses:
   *      '200':
   *        description: User added successfully
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */    
  usersRouter.put('/', async (req, res) => {
    let connection: Connection | null = null;
    let userResult: any = {};
    try {
      connection = await pool.getConnection();

      const user = req.body;
      const result: any = await addUser(user, connection);

      userResult = {
        name: user.name,
        department: user.department,
        phonenumber: user.phonenumber,
        email: user.email,
        role: user.role,
        rapidresponseteam: user.rapidresponseteam,
        division: user.division,
        supervisorid: user.supervisorid,
        mobilecarrier: user.mobilecarrier,
        altphonenumber: user.altphonenumber,
        altmobilecarrier: user.altmobilecarrier
      }

      if(result.hasOwnProperty('outBinds')) {
        if(result.outBinds.hasOwnProperty('outGid') && result.outBinds.hasOwnProperty('outOid')) {
          userResult['objectid'] = result.outBinds.outOid[0];
          userResult['globalid'] = result.outBinds.outGid[0];
        }
      }

      res.json(userResult);
    }
    catch (error) {
      appLogger.error(error);
      res.status(502).send('DB Connection Error');
    }
    finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error('Error releasing connection:', err);
          }
        });
      }
    }
  });

  /**
   * @swagger
   * /users/{id}:
   *  delete:
   *    summary: Delete a user from wqims.users
   *    description: Deletes a user from wqims.users based on the provided ID
   *    tags:
   *      - Users
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        description: The ID of the user to delete
   *        schema:
   *          type: string
   *    responses:
   *      '200':
   *        description: User deleted successfully
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  usersRouter.delete('/:id', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();
      const id = req.params.id;
      const result = await deleteUser(id, connection);

      res.send(result);
    }
    catch (error) {
      appLogger.error(error);
      res.status(502).send('DB Connection Error');
    }
    finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error('Error releasing connection:', err);
          }
        });
      }
    }
  });

  /** 
   * @swagger
  * /users/{id}:
  *  patch:
  *    summary: Update a user in wqims.users
  *    description: Updates a user in wqims.users based on the provided ID
  *    tags:
  *      - Users
  *    parameters:
  *      - in: path
  *        name: id
  *        required: true
  *        description: The ID of the user to update
  *        schema:
  *          type: string
  *    requestBody:
  *      required: true
  *      content:
  *        application/json:
  *          schema:
  *            $ref: '#/components/schemas/UserData'
  *    responses:
  *      '200':
  *        description: User updated successfully
  *        content:
  *          application/json:
  *            schema:
  *              type: object
  *      '502':
  *        description: Bad Gateway
  *        content:
  *          application/json:
  *            schema:
  *              type: string
  *              example: 'Bad Gateway: DB Connection Error'
  */
  usersRouter.patch('/:id', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();
      const id = req.params.id;
      const user = req.body;
      const result = await updateUser(id, user, connection);

      res.send(result);
    }
    catch (error) {
      appLogger.error(error);
      res.status(502).send('DB Connection Error');
    }
    finally {
      if(connection) {
        connection.release((err: any) => {
          if(err) {
            appLogger.error('Error releasing connection:', err);
          }
        });
      }
    }
  });
})
.catch(error => {
  appLogger.error("Error creating connection pool:", error)
})

usersRouter.use('/search', async (req, res) => {
  try {
    const searchQuery= req.query.filter as string;
    const users = await graphHelper.getADUsers(searchQuery, 1, 20);
    res.send(users);
  } catch (error) {
    appLogger.error(error);
    res.status(500).send(error);
  }
});

function addUser(user: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} (NAME, DEPARTMENT, PHONENUMBER, EMAIL, ROLE, RAPIDRESPONSETEAM, DIVISION, SUPERVISORID, MOBILECARRIER, SECONDARYPHONENUMBER, SECONDARYMOBILECARRIER) values (:name, :department, :phonenumber, :email, :role, :rapidresponseteam, :division, :supervisorid, :mobilecarrier, :altphonenumber, :altmobilecarrier) returning GLOBALID, OBJECTID into :outGid, :outOid`;
    let bindParams: any = {
      name: user.name ? user.name : 'none',
      department: user.department ? user.department : 'none',
      phonenumber: user.phonenumber ? user.phonenumber : 'none',
      email: user.email ? user.email : 'none',
      role: user.role ? user.role : 'none',
      rapidresponseteam: user.rapidresponseteam ? user.rapidresponseteam : 0,
      division: user.division ? user.division : 'none',
      supervisorid: user.supervisorid ? user.supervisorid : 'none',
      mobilecarrier: user.mobilecarrier ? user.mobilecarrier : 'none',
      altphonenumber: user.altphonenumber ? user.altphonenumber : 'none',
      altmobilecarrier: user.altmobilecarrier ? user.altmobilecarrier : 'none',
      outGid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
      outOid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT}
    }
    let bindDefs: any = {
      name: {type: OracleDB.STRING, maxSize: 128},
      department: {type: OracleDB.STRING, maxSize: 128},
      division: {type: OracleDB.STRING, maxSize: 64},
      phonenumber: {type: OracleDB.STRING, maxSize: 12},
      email: {type: OracleDB.STRING, maxSize: 128},
      role: {type: OracleDB.STRING, maxSize: 64},
      rapidresponseteam: {type: OracleDB.NUMBER, maxSize: 5},
      mobilecarrier: {type: OracleDB.STRING, maxSize: 25},
      supervisorid: {type: OracleDB.STRING, maxSize: 38},
      altphonenumber: {type: OracleDB.STRING, maxSize: 12},
      altmobilecarrier: {type: OracleDB.STRING, maxSize: 25},
      outGid: {type: OracleDB.STRING},
      outOid: {type: OracleDB.NUMBER}
    }
    const options = {
      autoCommit: true,
      bindDefs: bindDefs,
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
  
    connection.execute(query, bindParams, options, (err, result) => {
      if(err) {
        appLogger.error('Error adding user:', err);
        reject(err);
      }
      resolve(result);
    });
  });
}

function deleteUser(user:any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where GLOBALID = :id`;
    const options = {
      autoCommit: true,
      bindDefs: {
        id: {type: OracleDB.NUMBER}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }

    connection.execute(query, {id: user}, options, (err, result) => {
      if(err) {
        appLogger.error('Error deleting user:', err);
        reject(err);
      }
      resolve(result);
    });
  });
}

function updateUser(id: string, user: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} set `
    let bindParams: any = {}
    let bindDefs: any = {}

    if(user.name) {
      query += 'NAME = :name, ';
      bindParams['name'] = user.name;
      bindDefs['name'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.department) {
      query += 'DEPARTMENT = :department, ';
      bindParams['department'] = user.department;
      bindDefs['department'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.division) {
      query += 'DIVISION = :division, ';
      bindParams['division'] = user.division;
      bindDefs['division'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.phonenumber) {
      query += 'PHONENUMBER = :phonenumber, ';
      bindParams['phonenumber'] = user.phonenumber;
      bindDefs['phonenumber'] = {type: OracleDB.STRING, maxSize: 12};
    }
    if(user.email) {
      query += 'EMAIL = :email, ';
      bindParams['email'] = user.email;
      bindDefs['email'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.role) {
      query += 'ROLE = :role, ';
      bindParams['role'] = user.role;
      bindDefs['role'] = {type: OracleDB.STRING, maxSize: 64};
    }
    if(user.mobilecarrier) {
      query += 'MOBILECARRIER = :mobilecarrier, ';
      bindParams['mobilecarrier'] = user.mobilecarrier;
      bindDefs['mobilecarrier'] = {type: OracleDB.STRING, maxSize: 25};
    }
    if(user.altphonenumber) {
      query += 'SECONDARYPHONENUMBER = :altphonenumber, ';
      bindParams['altphonenumber'] = user.altphonenumber;
      bindDefs['altphonenumber'] = {type: OracleDB.STRING, maxSize: 12};
    }
    if(user.altmobilecarrier) {
      query += 'SECONDARYMOBILECARRIER = :altmobilecarrier, ';
      bindParams['altmobilecarrier'] = user.altmobilecarrier;
      bindDefs['altmobilecarrier'] = {type: OracleDB.STRING, maxSize: 25};
    }
    if(user.rapidresponseteam) {
      query += 'RAPIDRESPONSETEAM = :rapidresponseteam, ';
      bindParams['rapidresponseteam'] = user.rapidresponseteam;
      bindDefs['rapidresponseteam'] = {type: OracleDB.NUMBER, maxSize: 5};
    }

    query = query.slice(0, -2); // remove trailing comma

    query += ` where GLOBALID = :id`;

    const options = {
      autoCommit: true,
      bindDefs: bindDefs,
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }

    connection.execute(query, { ...bindParams, id: id }, options, (err, result) => {
      if(err) {
        appLogger.error('Error updating user:', err);
        reject(err);
      }
      resolve(result);
    });
  });
}

export default usersRouter;