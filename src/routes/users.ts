import express from 'express';
import OracleDB, { Connection, autoCommit } from 'oracledb';
import jwt from 'jsonwebtoken';

import { JWT_SECRET_KEY, WQIMS_DB_CONFIG } from "../util/secrets";
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
 *        name:
 *          type: string
 *        department:
 *          type: string
 *        division:
 *          type: string
 *        supervisorID:
 *          type: string
 *          nullable: true
 *        phoneNumber:
 *          type: string
 *        email:
 *          type: string
 *        role:
 *          type: string
 *        rapidResponseTeam:
 *           type: integer
 *        mobileCarrier:
 *           type: string
 *           nullable: true
 *        altPhoneNumber:
 *           type: string
 *           nullable: true
 *        altMobileCarrier:
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

      conn.execute(`select * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where ACTIVE <> 0`, [], (err, result) => {
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
    let result: any;
    
    try {
      connection = await pool.getConnection();

      const user = req.body;
      const inactiveUser: any = await findInactiveUser(user.email, connection);

      if(inactiveUser.length > 0) {
        user.GLOBALID = inactiveUser[0].GLOBALID;
        user.OBJECTID = inactiveUser[0].OBJECTID;
        result = await addInactiveUser(user, connection);
        if(inactiveUser[0].ROLE !== user.role.toLowerCase()) {
          const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
          await editAddInactiveUserRole(inactiveUser[0].GLOBALID, roleId, connection);
        }
        else {
          await addInactiveUserRole(inactiveUser[0].GLOBALID, connection);
        }
      } else {
        result = await addUser(user, connection);
        const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
        await addUserRole(result.GLOBALID, roleId, connection);
      }
      res.json(result);

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
   *  post:
   *    summary: Deactivates a user from wqims.users
   *    description: Deactivates a user from wqims.users based on the provided ID
   *    tags:
   *      - Users
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        description: The ID of the user to deactivate
   *        schema:
   *          type: string
   *    responses:
   *      '200':
   *        description: User deactivated successfully
   *      '502':
   *        description: Bad Gateway
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Bad Gateway: DB Connection Error'
   */
  usersRouter.post('/:id', async (req, res) => {
    let connection: Connection | null = null;
    try {
      connection = await pool.getConnection();
      const id = req.params.id;
      const result = await deactivateUser(id, connection);
      await deactivateGroupUser(id, connection);

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
      const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
      await updateUserRole(id, roleId, connection);
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
   * 
   */
  usersRouter.put('/:id/roles')
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
    let query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} (NAME, DEPARTMENT, PHONENUMBER, EMAIL, ROLE, RAPIDRESPONSETEAM, DIVISION, SUPERVISORID, MOBILECARRIER, SECONDARYPHONENUMBER, SECONDARYMOBILECARRIER, ACTIVE) values (:name, :department, :phonenumber, :email, :role, :rapidresponseteam, :division, :supervisorid, :mobilecarrier, :altphonenumber, :altmobilecarrier, 1) returning GLOBALID, OBJECTID into :outGid, :outOid`;
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
      NAME: {type: OracleDB.STRING, maxSize: 128},
      DEPARTMENT: {type: OracleDB.STRING, maxSize: 128},
      DIVISION: {type: OracleDB.STRING, maxSize: 64},
      PHONENUMBER: {type: OracleDB.STRING, maxSize: 12},
      EMAIL: {type: OracleDB.STRING, maxSize: 128},
      ROLE: {type: OracleDB.STRING, maxSize: 64},
      RAPIDRESPONSETEAM: {type: OracleDB.NUMBER, maxSize: 5},
      MOBILECARRIER: {type: OracleDB.STRING, maxSize: 25},
      SUPERVISORID: {type: OracleDB.STRING, maxSize: 38},
      ALTPHONENUMBER: {type: OracleDB.STRING, maxSize: 12},
      ALTMOBILECARRIER: {type: OracleDB.STRING, maxSize: 25},
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
      const ids = result.outBinds as any;
      user.GLOBALID = ids.outGid[0];
      user.OBJECTID = ids.outOid[0];
      resolve(user);
    });
  });
}

function getRoleId(role: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select ROLE_ID from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.rolesTbl} where ROLE = :role`;
    const options = {
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }

    connection.execute(query, {role: role}, options, (err, result: any) => {
      if(err) {
        appLogger.error('Error getting role ID:', err);
        reject(err);
      }
      else {
        if(typeof result !== 'undefined')
          resolve(result.rows[0].ROLE_ID);
      }
    });
  });
}

function addUserRole(userId: string, roleId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} (USER_ID, ROLE_ID) values (:userId, :roleId)`;
    const options = {
      autoCommit: true,
      bindDefs: {
        userId: {type: OracleDB.STRING},
        roleId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId, roleId: roleId}, options, (err, result) => {
      if(err) {
        appLogger.error('Error adding user role:', err);
        reject(err);
      }
      else {
        resolve(result);
      }
    })
  });
}
  

function addInactiveUser(user: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} set ACTIVE = 1, `;
    let bindParams: any = {
      id: user.GLOBALID
    }
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
    query +=  ` where GLOBALID = :id`;
    const options = {
      autoCommit: true,
      bindDefs: bindDefs,
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, bindParams, options, (err, result) => {
      if(err) {
        appLogger.error('Error adding inactive user:', err);
        reject(err);
      }
      else {
        user.ACTIVE = 1;
        resolve(user);
      }
    });
  });
}

function addInactiveUserRole(userId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} set ACTIVE = 1 where USER_ID = :userId`;
    const options = {
      autoCommit: true,
      bindDefs: {
        userId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error('Error adding inactive user role:', err);
        reject(err);
      }
      else {
        resolve(result);
      }
    });
  });
}

function editAddInactiveUserRole(userId: string, newRoleId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} set ACTIVE = 1, ROLE_ID = :newRoleId where USER_ID = :userId`;
    const options = {
      autoCommit: true,
      bindDefs: {
        userId: {type: OracleDB.STRING},
        newRoleId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId, newRoleId: newRoleId}, options, (err, result) => {
      if(err) {
        appLogger.error('Error updating inactive user role:', err);
        reject(err);
      }
      else {
        resolve(result);
      }
    })
  })
}

function deactivateUser(id: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} set ACTIVE = 0 where GLOBALID = :id `;
    const options = {
      autoCommit: true,
      bindDefs: {
        id: {type: OracleDB.NUMBER}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }

    connection.execute(query, {id: id}, options, (err, result) => {
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

function updateUserRole(userId: string, roleId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} set ROLE_ID = :roleId where USER_ID = :userId`;
    const options = {
      autoCommit: true,
      bindDefs: {
        userId: {type: OracleDB.STRING},
        roleId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId, roleId: roleId}, options, (err, result) => {
      if(err) {
        appLogger.error('Error updating user role:', err);
        reject(err);
      }
      else {
        resolve(result);
      }
    })
  });
}

function findInactiveUser(email: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query = `select * from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where EMAIL = :email and ACTIVE = 0`;
    let bindParams = {
      email: email
    }
    let options = {
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }

    connection.execute(query, bindParams, options, (err, result) => {
      if(err) {
        appLogger.error('Error finding inactive user:', err);
        reject(err);
      } else {
        resolve(result.rows);
      }
    });
  });
}

function deactivateGroupUser(userId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} set ACTIVE = 0 where USER_ID = :userId`;
    const options = {
      autoCommit: true,
      bindDefs: {
        userId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error(err)
        reject(err);
      }
      else {
        resolve(result)
      }
    })
  })
}

export default usersRouter;