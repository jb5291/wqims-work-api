import express from 'express';
import OracleDB, { Connection } from 'oracledb';
import axios, { AxiosResponse } from 'axios';
import { ApiKeyManager, ApplicationCredentialsManager, ArcGISIdentityManager, request } from '@esri/arcgis-rest-request';
import { addFeatures, updateFeatures, deleteFeatures, queryFeatures, IQueryFeaturesResponse, IQueryResponse } from '@esri/arcgis-rest-feature-service';

import { BASEURL, EB_CREDS, WQIMS_DB_CONFIG, WQIMS_REST_INFO } from "../util/secrets";
import { appLogger, actionLogger } from '../util/appLogger';
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
 *        position:
 *          type: string
 *        division:
 *          type: string
 *        phoneNumber:
 *          type: string
 *        email:
 *          type: string
 *        role:
 *          type: string
 *        rapidResponseTeam:
 *           type: integer
 *        altPhoneNumber:
 *           type: string
 *           nullable: true
 *        startTime:
 *           type: string
 *           nullable: true
 *        endTime:
 *           type: string
 *           nullable: true
 *    ArcGISAddUserResponse:
 *      type: object
 *      properties:
 *        addResults:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              objectId:
 *                type: number
 *              globalId:
 *                type: string
 *              success:
 *                type: boolean
 *              error:
 *                type: object
 *                properties: 
 *                  code:
 *                    type: number
 *                  description:
 *                    type: string
 *    ArcGISGetUsersResponse:
 *      type: object
 *      properties:
 *        objectIdFieldName: 
 *          type: string
 *        globalIdFieldName: 
 *          type: string
 *        hasZ:
 *          type: boolean
 *        hasM:
 *          type: boolean
 *        fields: 
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              name:
 *                type: string
 *              alias:
 *                type: string
 *              type:
 *                type: string
 *              length:
 *                type: number
 *        features:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              attributes:
 *                type: object
 *                properties:
 *                  name:
 *                    type: string
 *                  department:
 *                    type: string
 *                  position:
 *                    type: string
 *                  division:
 *                    type: string
 *                  phoneNumber:
 *                    type: string
 *                  email:
 *                    type: string
 *                  role:
 *                    type: string
 *                  rapidResponseTeam:
 *                    type: integer
 *                  altPhoneNumber:
 *                    type: string
 *                    nullable: true
 *                  startTime:
 *                    type: string
 *                    nullable: true
 *                  endTime:
 *                    type: string
 *                    nullable: true
 */

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
   *              $ref: '#/components/schemas/ArcGISGetUsersResponse'
   *      '500':
     *        description: Internal Server Error
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Internal Server Error'
   */
usersRouter.get('/', async (req, res) => {
  try {
    const session: ApplicationCredentialsManager = new ApplicationCredentialsManager({
      clientId: WQIMS_REST_INFO.appId,
      clientSecret: WQIMS_REST_INFO.secret,
    })
    /* const token = await getToken();
    const options = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    }; */
    /* request(`${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`, {
      authentication: session
    }).then((response: any) => {
      console.debug(response);
    }) */
    /* const query = 'ACTIVE=1';
    const requestUrl = `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}/query?where=${query}&outFields=*&f=json&token=${token}`
    const response = await axios.get(requestUrl, options) */
    queryFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
      where: '1=1',
      authentication: session
    }).then((response: IQueryFeaturesResponse | IQueryResponse) => {
      console.debug(response);
      if('features' in response) {
        res.json(response.features);
      } else {
        throw new Error('Error getting data');
      }
    }).catch((error: any) => {
      throw new Error(error.message);
    });
    /* if('data' in response) {
      if('error' in response.data) {
        //appLogger.error('User GET error:', response.data.error);
        throw new Error(response.data.error.message);
      }
      res.json(response.data);
    }
    else {
      //appLogger.error('User GET error:', response);
      throw new Error('Error getting data');
    } */
  }
  catch (error: any) {
    appLogger.error('User GET Error:', error.stack)
    res.status(500).send({
      error: error.message,
      message: 'User GET error'
    });
  }
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
   *              $ref: '#/components/schemas/ArcGISAddUserResponse'
   *      '500':
   *        description: Internal Server Error
   *        content:
   *          application/json:
   *            schema:
   *              type: string
   *              example: 'Internal Server Error'
   */   
usersRouter.put('/', async (req, res) => {
  try {
    const token: string = await getToken();
    const inactiveUserQuery: string = `EMAIL='${req.body.email}' AND ACTIVE=0`;
    const options: any = {
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }
    const body: string = JSON.stringify(req.body);
    const outFields: string = 'OBJECTID,GLOBALID,ACTIVE,ROLE';
    const getRequest: string = `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}/query?where=${inactiveUserQuery}&outFields=${outFields}&f=json&token=${token}`;
    const inactiveUserResponse: AxiosResponse = await axios.get(getRequest, options);
    if('data' in inactiveUserResponse && 'features' in inactiveUserResponse.data && inactiveUserResponse.data.features.length > 0) {
      if(inactiveUserResponse.data.features[0].attributes.ACTIVE === 0) {
        console.debug('Reactivating user');
        // set Active to one, check if role is different
        const editRequest = `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}/updateFeatures?f=json&token=${token}`;
        const editBody = JSON.stringify({features: [{
            attributes: {
              OBJECTID: inactiveUserResponse.data.features[0].attributes.OBJECTID,
              GLOBALID: inactiveUserResponse.data.features[0].attributes.GLOBALID,
              ACTIVE: 1,
              ...req.body
            }
          }]});
        const editResponse = await axios.post(editRequest, editBody, options);
        if ('data' in editResponse) {
          if ('error' in editResponse.data) {
            throw new Error(editResponse.data.error.message);
          }
          res.json(editResponse.data);
        }
        else {
          throw new Error('Error updating user');
        }
      }
      else {
        res.status(500).send('User already exists');
      }
    }
    else {
      console.debug('Adding new user');
      const addRequest = `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}/addFeatures?f=json&token=${token}`;
      const addResponse = await axios.post(addRequest, body, options);
      res.json(addResponse.data);
      /* fetch(`${WQIMS_REST_INFO.url}/0/addFeatures?f=json&token=${token}`, options)
        .then(response => response.json())
        .then(data => {
          OracleDB.getConnection(dbConf)
          .then(async connection => {
            const roleId: any = await getRoleId(req.body.role.toLowerCase(), connection);
            await addUserRole(data.features[0].attributes.GLOBALID, roleId, connection);
            connection.commit();
            connection.release();
          })
          res.json(data);
        }) */
    }
  }
  catch (error: any) {
    appLogger.error('User PUT error:', error);
    res.status(500).send({
      error: error.message,
      message: 'User GET error'
    })
  }
})

// OracleDB.createPool(dbConf)
// .then(pool => {
//   appLogger.info('Connection pool created for users');

//   /**
//    * @swagger
//    * /users:
//    *  get:
//    *    summary: Get list of users
//    *    description: Gets a list of groups from DSNGIST wqims.users
//    *    tags: 
//    *      - Users
//    *    responses:
//    *      '200':
//    *        description: A list of users
//    *        content:
//    *          application/json:
//    *            schema:
//    *              type: array
//    *              items:
//    *                $ref: '#/components/schemas/UserData'
//    *      '502':
//    *        description: Bad Gateway
//    *        content:
//    *          application/json:
//    *            schema:
//    *              type: string
//    *              example: 'Bad Gateway: DB Connection Error'
//    */
//   /* usersRouter.get('/', async (req, res) => {
//     pool.getConnection((err, conn) => {
//       if(err) {
//         appLogger.error('Error getting connection: ', err);
//         return res.status(502).send('DB Connection Error');
//       }

//       conn.execute(`select * FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where ACTIVE <> 0`, [], (err, result) => {
//         if(err) {
//           appLogger.error("Error executing query:", err);
//         return res.status(502).send('DB Connection Error');
//         }
//         res.json(result.rows);
//         conn.release();
//       });
//     });
//   }); */

//   /**
//    * @swagger
//    * /users:
//    *  put:
//    *    summary: Add a new user to wqims.users
//    *    description: Adds a new user to wqims.users table
//    *    tags:
//    *      - Users
//    *    requestBody:
//    *      required: true
//    *      content:
//    *        application/json:
//    *          schema:
//    *            $ref: '#/components/schemas/UserData'
//    *    responses:
//    *      '200':
//    *        description: User added successfully
//    *        content:
//    *          application/json:
//    *            schema:
//    *              type: object
//    *      '502':
//    *        description: Bad Gateway
//    *        content:
//    *          application/json:
//    *            schema:
//    *              type: string
//    *              example: 'Bad Gateway: DB Connection Error'
//    */    
//   usersRouter.put('/', async (req, res) => {
//     let connection: Connection | null = null;
//     let result: any;

//     try {
//       connection = await pool.getConnection();

//       const user = req.body;
//       const inactiveUser: any = await findInactiveUser(user.email, connection);

//       if(inactiveUser.length > 0) {
//         user.GLOBALID = inactiveUser[0].GLOBALID;
//         user.OBJECTID = inactiveUser[0].OBJECTID;
//         result = await addInactiveUser(user, connection);
//         if(inactiveUser[0].ROLE.toLowerCase() !== user.role.toLowerCase()) { // re-add with different role
//           const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
//           await editAddInactiveUserRole(inactiveUser[0].GLOBALID, roleId, connection);
//         }
//         else {
//           await addInactiveUserRole(inactiveUser[0].GLOBALID, connection);
//         }
//         const groupCheck: any = await findInactiveGroupMember(inactiveUser[0].GLOBALID, connection);
//         if(groupCheck.length > 0) { // re-add to group(s)
//           await reactivateGroupUser(inactiveUser[0].GLOBALID, connection);
//         }
//       } else {
//         result = await addUser(user, connection);
//         const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
//         await addUserRole(result.GLOBALID, roleId, connection);
//       }
//       // const ebResult = await addMemberToEB(user);
//       connection.commit();
//       actionLogger.info('User added', { email: user.email });
//       res.json(result);
//     }
//     catch (error) {
//       appLogger.error(error);
//       connection?.rollback();
//       res.status(502).send('DB Connection Error, operation rolled back');
//     }
//     finally {
//       if(connection) {
//         connection.release((err: any) => {
//           if(err) {
//             appLogger.error('Error releasing connection:', err);
//           }
//         });
//       }
//     }
//   });

//   /**
//    * @swagger
//    * /users/{id}:
//    *  delete:
//    *    summary: Deactivates a user from wqims.users
//    *    description: Deactivates a user from wqims.users based on the provided ID
//    *    tags:
//    *      - Users
//    *    parameters:
//    *      - in: path
//    *        name: id
//    *        required: true
//    *        description: The ID of the user to deactivate
//    *        schema:
//    *          type: string
//    *    responses:
//    *      '200':
//    *        description: User deactivated successfully
//    *      '502':
//    *        description: Bad Gateway
//    *        content:
//    *          application/json:
//    *            schema:
//    *              type: string
//    *              example: 'Bad Gateway: DB Connection Error'
//    */
//   usersRouter.delete('/:id', async (req, res) => {
//     let connection: Connection | null = null;
//     try {
//       connection = await pool.getConnection();
//       const id = req.params.id;
//       const user: any = await findUser(id, connection);
//       const result = await deactivateUser(id, connection);
//       await deactivateGroupUser(id, connection);
//       await deactivateUserRole(id, connection);

//       connection.commit();
//       await deleteMemberFromEB(id);
//       actionLogger.info('User deactivated', { email: user[0].EMAIL });
//       res.send(result);
//     }
//     catch (error) {
//       appLogger.error(error);
//       connection?.rollback();
//       res.status(502).send('DB Connection Error, operation rolled back');
//     }
//     finally {
//       if(connection) {
//         connection.release((err: any) => {
//           if(err) {
//             appLogger.error('Error releasing connection:', err);
//           }
//         });
//       }
//     }
//   });

//   /** 
//    * @swagger
//   * /users/{id}:
//   *  patch:
//   *    summary: Update a user in wqims.users
//   *    description: Updates a user in wqims.users based on the provided ID
//   *    tags:
//   *      - Users
//   *    parameters:
//   *      - in: path
//   *        name: id
//   *        required: true
//   *        description: The ID of the user to update
//   *        schema:
//   *          type: string
//   *    requestBody:
//   *      required: true
//   *      content:
//   *        application/json:
//   *          schema:
//   *            $ref: '#/components/schemas/UserData'
//   *    responses:
//   *      '200':
//   *        description: User updated successfully
//   *        content:
//   *          application/json:
//   *            schema:
//   *              type: object
//   *      '502':
//   *        description: Bad Gateway
//   *        content:
//   *          application/json:
//   *            schema:
//   *              type: string
//   *              example: 'Bad Gateway: DB Connection Error'
//   */
//   usersRouter.patch('/:id', async (req, res) => {
//     let connection: Connection | null = null;
//     try {
//       connection = await pool.getConnection();
//       const id = req.params.id;
//       const user = req.body;
//       const result = await updateUser(id, user, connection);
//       const roleId: any = await getRoleId(user.role.toLowerCase(), connection);
//       await updateUserRole(id, roleId, connection);

//       connection.commit();
//       actionLogger.info('User updated', { email: user.email });
//       res.send(result);
//     }
//     catch (error) {
//       appLogger.error(error);
//       connection?.rollback();
//       res.status(502).send('DB Connection Error, operation rolled back');
//     }
//     finally {
//       if(connection) {
//         connection.release((err: any) => {
//           if(err) {
//             appLogger.error('Error releasing connection:', err);
//           }
//         });
//       }
//     }
//   });
// })
// .catch(error => {
//   appLogger.error("Error creating connection pool:", error)
// })

usersRouter.use('/search', async (req, res) => {
  try {
    const searchQuery= req.query.filter as string;
    const users = await graphHelper.getADUsers(searchQuery);
    res.send(users);
  } catch (error) {
    appLogger.error(error);
    res.status(500).send(error);
  }
});

function addUser(user: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    let query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} (NAME, DEPARTMENT, PHONENUMBER, EMAIL, ROLE, RAPIDRESPONSETEAM, DIVISION, SECONDARYPHONENUMBER, ACTIVE, STARTTIME, ENDTIME) values (:name, :department, :phonenumber, :email, :role, :rapidresponseteam, :division, :altphonenumber, 1, :starttime, :endtime) returning GLOBALID, OBJECTID into :outGid, :outOid`;
    let bindParams: any = {
      name: user.name ? user.name : 'none',
      department: user.department ? user.department : 'none',
      phonenumber: user.phonenumber ? user.phonenumber : 'none',
      email: user.email ? user.email : 'none',
      role: user.role ? user.role : 'none',
      rapidresponseteam: user.rapidresponseteam ? user.rapidresponseteam : 0,
      division: user.division ? user.division : 'none',
      altphonenumber: user.altphonenumber ? user.altphonenumber : 'none',
      startTime: user.startTime ? user.startTime : 'none',
      endTime: user.endTime ? user.endTime : 'none',
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
      ALTPHONENUMBER: {type: OracleDB.STRING, maxSize: 12},
      STARTTIME: {type: OracleDB.STRING, maxSize: 24},
      ENDTIME: {type: OracleDB.STRING, maxSize: 24},
      outGid: {type: OracleDB.STRING},
      outOid: {type: OracleDB.NUMBER}
    }
    const options = {
      autoCommit: false,
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
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} (USER_ID, ROLE_ID, ACTIVE) values (:userId, :roleId, 1)`;
    const options = {
      autoCommit: false,
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
    if(user.altphonenumber) {
      query += 'SECONDARYPHONENUMBER = :altphonenumber, ';
      bindParams['altphonenumber'] = user.altphonenumber;
      bindDefs['altphonenumber'] = {type: OracleDB.STRING, maxSize: 12};
    }
    if(user.rapidresponseteam) {
      query += 'RAPIDRESPONSETEAM = :rapidresponseteam, ';
      bindParams['rapidresponseteam'] = user.rapidresponseteam;
      bindDefs['rapidresponseteam'] = {type: OracleDB.NUMBER, maxSize: 5};
    }
    if(user.starttime) {
      query += 'STARTTIME = :starttime, ';
      bindParams['starttime'] = user.starttime;
      bindDefs['starttime'] = {type: OracleDB.STRING, maxSize: 24};
    }
    if(user.endtime) {
      query += 'ENDTIME = :endtime, ';
      bindParams['endtime'] = user.endtime;
      bindDefs['endtime'] = {type: OracleDB.STRING, maxSize: 24};
    }
    query = query.slice(0, -2); // remove trailing comma
    query +=  ` where GLOBALID = :id`;
    const options = {
      autoCommit: false,
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
      autoCommit: false,
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
      autoCommit: false,
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
      autoCommit: false,
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

    if(user.name !== null && typeof user.name !== 'undefined') {
      query += 'NAME = :name, ';
      bindParams['name'] = user.name;
      bindDefs['name'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.department !== null && typeof user.department !== 'undefined') {
      query += 'DEPARTMENT = :department, ';
      bindParams['department'] = user.department === '' ? 'none' : user.department;
      bindDefs['department'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.position !== null && typeof user.position !== 'undefined') {
      query += 'POSITION = :position, ';
      bindParams['position'] = user.position === '' ? 'none' : user.position;
      bindDefs['position'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.division !== null && typeof user.division !== 'undefined') {
      query += 'DIVISION = :division, ';
      bindParams['division'] = user.division === '' ? 'none' : user.division;
      bindDefs['division'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.phoneNumber !== null && typeof user.phoneNumber !== 'undefined') {
      query += 'PHONENUMBER = :phoneNumber, ';
      bindParams['phoneNumber'] = user.phoneNumber;
      bindDefs['phoneNumber'] = {type: OracleDB.STRING, maxSize: 12};
    }
    if(user.email !== null && typeof user.email !== 'undefined') {
      query += 'EMAIL = :email, ';
      bindParams['email'] = user.email;
      bindDefs['email'] = {type: OracleDB.STRING, maxSize: 128};
    }
    if(user.role !== null && typeof user.role !== 'undefined') {
      query += 'ROLE = :role, ';
      bindParams['role'] = user.role;
      bindDefs['role'] = {type: OracleDB.STRING, maxSize: 64};
    }
    if(user.rapidResponseTeam !== null && typeof user.rapidResponseTeam !== 'undefined') {
      query += 'RAPIDRESPONSETEAM = :rapidResponseTeam, ';
      bindParams['rapidResponseTeam'] = user.rapidResponseTeam;
      bindDefs['rapidResponseTeam'] = {type: OracleDB.NUMBER, maxSize: 5};
    }
    if(user.altPhoneNumber !== null && typeof user.altPhoneNumber !== 'undefined') {
      query += 'SECONDARYPHONENUMBER = :altPhoneNumber, ';
      bindParams['altPhoneNumber'] = user.altPhoneNumber;
      bindDefs['altPhoneNumber'] = {type: OracleDB.STRING, maxSize: 12};
    }
    if(user.startTime !== null && typeof user.startTime !== 'undefined') {
      query += 'STARTTIME = :startTime, ';
      bindParams['startTime'] = user.startTime;
      bindDefs['startTime'] = {type: OracleDB.STRING, maxSize: 24};
    }
    if(user.endTime !== null && typeof user.endTime !== 'undefined') {
      query += 'ENDTIME = :endTime, ';
      bindParams['endTime'] = user.endTime;
      bindDefs['endTime'] = {type: OracleDB.STRING, maxSize: 24};
    }

    query = query.slice(0, -2); // remove trailing comma

    query += ` where GLOBALID = :id`;

    const options = {
      autoCommit: false,
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
      autoCommit: false,
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
      autoCommit: false,
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

function deactivateUserRole(userId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.userRolesTbl} set ACTIVE = 0 where USER_ID = :userId`;
    const options = {
      autoCommit: false,
      bindDefs: {
        userId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result);
      }
    });
  })
}

function findInactiveGroupMember(userId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select * from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where USER_ID = :userId and ACTIVE = 0`;
    const options = {
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result.rows);
      }
    })
  })
}

function reactivateGroupUser(userId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} set ACTIVE = 1 where USER_ID = :userId`;
    const options = {
      autoCommit: false,
      bindDefs: {
        userId: {type: OracleDB.STRING}
      },
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result);
      }
    })
  });
}

function findUser(userId: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select NAME, EMAIL from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} where GLOBALID = :userId`;
    const options = {
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, {userId: userId}, options, (err, result) => {
      if(err) {
        appLogger.error(err);
        reject(err);
      }
      else {
        resolve(result.rows);
      }
    });
  })
}

function addMemberToEB(user: any) {
  return new Promise((resolve, reject) => {
    const postOptions = {
      method: 'POST',
      headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: 'Basic ' + Buffer.from(`${EB_CREDS.username}:${EB_CREDS.password}`).toString('base64')
      },
      body: JSON.stringify({
          firstName: user.name.split(' ')[0],
          lastName: user.name.split(' ')[1],
          recordTypeId: EB_CREDS.record_id,
          groupsName: [
              'GIS-TEST-Water-Quality-Alerts'
          ],
          externalId: user.globalid,
          paths: [
              {
                  waitTime: 0,
                  pathId: EB_CREDS.sms_id,
                  countryCode: 'US',
                  value: user.phonenumber === '' ? user.altphonenumber.replace('-', '') : user.phonenumber.replace('-',''),
                  quietTimeFrames: [ // would depend on hours of operation
                      {name: 'M-F 6-6', days: [2, 3, 4, 5, 6], fromHour: 18, fromMin: 0, toHour: 6, toMin: 0},
                  ]
              },
              {
                  waitTime: 0,
                  pathId: EB_CREDS.email_id,
                  countryCode: 'US',
                  value: user.email,
              }
          ],
          timezoneId: 'America/New_York'
      })
    }

    fetch(`https://api.everbridge.net/rest/contacts/${EB_CREDS.organization_id}`, postOptions)
        .then(response => response.json())
        .then(data => {
            console.log('Success:')
            console.dir(data)
            resolve(data);
            console.log('end')
        })
        .catch(err => reject(err));
  });
}

function deleteMemberFromEB(userId: string) {
  return new Promise((resolve, reject) => {
    const deleteOptions = {
      method: 'DELETE',
      headers: {
          accept: 'application/json',
          authorization: 'Basic ' + Buffer.from(`${EB_CREDS.username}:${EB_CREDS.password}`).toString('base64')
      }
    }

    fetch(`https://api.everbridge.net/rest/contacts/${EB_CREDS.organization_id}/${userId}?idType=externalId`, deleteOptions)
        .then(response => response.json())
        .then(data => {
            console.log('Success:')
            console.dir(data)
            resolve(data);
            console.log('end')
        })
        .catch(err => reject(err));
  });
}

function getToken(): Promise<any> {
  return new Promise((resolve, reject) => {
    // const agsTokenUrl = WQIMS_REST_INFO.token_url;
    /* const session: ApplicationCredentialsManager = new ApplicationCredentialsManager({
      clientId: WQIMS_REST_INFO.appId,
      clientSecret: WQIMS_REST_INFO.secret,
      duration: 100000,
      portal: 'https://www.wssc.maps.arcgis.com/sharing/rest'
    })
    session.getToken(agsTokenUrl)
    .then(function(response) {
      resolve({
        access_token: response,
        expires_in: 100000 * 60
      })
    }) */
    const options = {
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded'
      },
    }
    const body: URLSearchParams = new URLSearchParams();
    body.append('client_id', WQIMS_REST_INFO.appId);
    body.append('client_secret', WQIMS_REST_INFO.secret);
    body.append('grant_type', 'client_credentials');
    axios.post(WQIMS_REST_INFO.token_url, body, options)
      .then(response => {
        resolve(response.data.access_token);
      })
      .catch(err => {
        console.error(err);
        reject(err);
      })
  })
}

function checkAppPrivileges(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded'
      },
    }
    const body: URLSearchParams = new URLSearchParams();
    body.append('client_id', WQIMS_REST_INFO.appId);
    body.append('client_secret', WQIMS_REST_INFO.secret);
    body.append('grant_type', 'client_credentials');
    const url= `https://gisdev.wsscwater.com/portal/sharing/rest/oauth2/apps/${WQIMS_REST_INFO.appId}?f=json&token=${token}`;
    axios.post(WQIMS_REST_INFO.token_url, body, options)
      .then(response => {
        resolve(response.data.access_token);
      })
      .catch(err => {
        console.error(err);
        reject(err);
      })
  });
}

// need to determine if name, phone, or email change
function updateMemberEBInfo(user: any) {

}

export default usersRouter;