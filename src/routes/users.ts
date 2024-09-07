import express from 'express';
import OracleDB, { Connection } from 'oracledb';
import axios, { AxiosResponse } from 'axios';
import { ApiKeyManager, ApplicationCredentialsManager, ArcGISIdentityManager, ErrorTypes, IFeature, request } from '@esri/arcgis-rest-request';
import { addFeatures, updateFeatures, deleteFeatures, queryFeatures, IQueryFeaturesResponse, IQueryResponse, IEditFeatureResult } from '@esri/arcgis-rest-feature-service';
import { v4 as uuidv4 } from 'uuid';

import { BASEURL, EB_CREDS, WQIMS_DB_CONFIG, WQIMS_REST_INFO } from "../util/secrets";
import { appLogger, actionLogger } from '../util/appLogger';
import { IWQIMSRole } from '../models/IRole';
import graphHelper from '../util/graph';
import { IWQIMSUser } from '../models/IUser';
import { AGSsession } from '../api';

const usersRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};
interface arcgisError {
  code: number,
  description: string
}

/**
 * @swagger
 * components:
 *  schemas:
 *    AddUserData:
 *      type: object
 *      properties:
 *        NAME:
 *          type: string
 *        DEPARTMENT:
 *          type: string
 *        POSITION:
 *          type: string
 *        DIVISION:
 *          type: string
 *        PHONENUMBER:
 *          type: string
 *        EMAIL:
 *          type: string
 *        ROLE:
 *          type: string
 *        RAPIDRESPONSETEAM:
 *           type: integer
 *        ALTPHONENUMBER:
 *           type: string
 *           nullable: true
 *        STARTTIME:
 *           type: string
 *           nullable: true
 *        ENDTIME:
 *           type: string
 *           nullable: true
 *        ACTIVE:
 *           type: integer
 *           nullable: true
 *    UserData:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        NAME:
 *          type: string
 *        DEPARTMENT:
 *          type: string
 *        POSITION:
 *          type: string
 *        DIVISION:
 *          type: string
 *        PHONENUMBER:
 *          type: string
 *        EMAIL:
 *          type: string
 *        ROLE:
 *          type: string
 *        RAPIDRESPONSETEAM:
 *           type: integer
 *        ALTPHONENUMBER:
 *           type: string
 *           nullable: true
 *        STARTTIME:
 *           type: string
 *           nullable: true
 *        ENDTIME:
 *           type: string
 *           nullable: true
 *        ACTIVE:
 *           type: integer
 *           nullable: true
 *    ArcGISEditFeatureResponse:
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
 *                  OBJECTID:
 *                    type: number
 *                  GLOBALID:
 *                    type: string
 *                  NAME:
 *                    type: string
 *                  DEPARTMENT:
 *                    type: string
 *                  POSITION:
 *                    type: string
 *                  DIVISION:
 *                    type: string
 *                  PHONENUMBER:
 *                    type: string
 *                  EMAIL:
 *                    type: string
 *                  ROLE:
 *                    type: string
 *                  RAPIDRESPONSETEAM:
 *                    type: integer
 *                  ALTPHONENUMBER:
 *                    type: string
 *                    nullable: true
 *                  STARTTIME:
 *                    type: string
 *                    nullable: true
 *                  ENDTIME:
 *                    type: string
 *                    nullable: true
 */

  /**
   * @swagger
   * /users:
   *  get:
   *    summary: Get list of active users
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
    AGSsession.refreshToken()
    .then((manager: string) => {
      queryFeatures({
        url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
        where: 'ACTIVE=1',
        authentication: manager
      }).then((response: IQueryFeaturesResponse | IQueryResponse) => {
        if('features' in response) {
          res.json(response.features);
        } else {
          throw new Error('Error getting data');
        }
      }).catch((error: any) => {
        throw new Error(error.message);
      });
    })
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
   *            $ref: '#/components/schemas/AddUserData'
   *    responses:
   *      '200':
   *        description: User added successfully
   *        content:
   *          application/json:
   *            schema:
   *              $ref: '#/components/schemas/ArcGISEditFeatureResponse'
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
    let getUserResult: IQueryFeaturesResponse | IQueryResponse;
    const session: ApplicationCredentialsManager = new ApplicationCredentialsManager({
      clientId: WQIMS_REST_INFO.appId,
      clientSecret: WQIMS_REST_INFO.secret,
    });
    const user: IWQIMSUser = req.body;
    const roleIds: IWQIMSRole[] = await getRoleIds(session);

    if(!user) {
      throw new Error('User data not provided');
    } 

    // query user table to see if user already exists and is inactive
    // DOES NOT CHECK IF THE USER EXISTS ALREADY, ONLY IF THEY ARE INACTIVE
    // NEED TO CHECK FOR DUPLICATE USERS ON THE FRONT END
    await queryFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
      where: `ACTIVE=0 AND EMAIL='${user.EMAIL}'`,
      authentication: session
    })
    .then(async (response: IQueryFeaturesResponse | IQueryResponse) => {
      getUserResult = response;
      // if user exists and is inactive, update the user
      if('features' in getUserResult && getUserResult.features.length > 0) {
        //
        // REACTIVATE USER
        //
        await updateFeatures({
          url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
          features: [{
            attributes: {
              OBJECTID: getUserResult.features[0].attributes.OBJECTID,
              GLOBALID: getUserResult.features[0].attributes.GLOBALID,
              ACTIVE: 1,
              ...req.body
            }
          }],
          authentication: session
        })
        .then(async (response: { updateResults: IEditFeatureResult[] }) => { 
          const updateResult: IEditFeatureResult = response.updateResults[0];
          // if the user was inactive, find their previous role, and compare it to the new role
          if('features' in getUserResult) {
            //
            //  FETCH USER ROLE
            //
            await updateUserRole(session, getUserResult.features[0].attributes, roleIds)
            .then((response: IEditFeatureResult) => {
              if('error' in response) {
                throw new Error(response.error?.description);
              }
            })
            .catch((error: any) => {
              throw new Error(error.message);
            })
          } else {
            throw new Error('Error getting user data');
          }
          res.json(updateResult);
        })
        .catch((error: any) => {
          throw new Error(error.message);
        });
      } else { // create a new user
        const new_guid = `{${uuidv4().toUpperCase()}}`;
        user.GLOBALID = new_guid;
        user.ACTIVE = 1;
        addFeatures({
          url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
          features: [{
            attributes: {
              ...user,
            }
          }],
          authentication: session
        })
        .then(async (response: { addResults: IEditFeatureResult[] }) => {
          await updateUserRole(session, user, roleIds)
          .then((response: IEditFeatureResult) => {
            if('error' in response) {
              throw new Error(response.error?.description);
            }
          })
          .catch((error: any) => {
            throw new Error(error.message);
          })
          res.json(response.addResults[0]);
        })
        .catch((error: any) => {
          throw new Error(error.message);
        })
      }
    })
    .catch((error: any) => {
      throw new Error(error.message);
    });

  }
  catch (error: any) {
    appLogger.error('User PUT error:', error);
    res.status(500).send({
      error: error.message,
      message: 'User GET error'
    })
  }
})

/**
 * @swagger
 * /users:
 *  post:
 *    summary: Deactivates a user from wqims.users
 *    description: Deactivates a user from wqims.users based on ID provided in body
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
 *        description: User deactivated successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
usersRouter.post('/', async (req, res) => {
  try {
    const session: ApplicationCredentialsManager = new ApplicationCredentialsManager({
      clientId: WQIMS_REST_INFO.appId,
      clientSecret: WQIMS_REST_INFO.secret,
    });
    const user = req.body;
    let updateResult: IEditFeatureResult;
    if(!user) {
      throw new Error('User data not provided');
    }
    // assuming this is only run on active users
    // soft delete
    await updateFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
      features: [{
        attributes: {
          OBJECTID: user.OBJECTID,
          GLOBALID: user.GLOBALID,
          ACTIVE: 0
        }
      }],
      authentication: session
    })
    .then(async (response: { updateResults: IEditFeatureResult[] }) => {
      updateResult = response.updateResults[0];
      if('success' in updateResult && updateResult.success) {
        // need to delete from roles and groups rel classes
        // or else those records get orphaned
        await deleteFeatures({
          url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_roles_lyr_id}`,
          objectIds: [],
          where: `USER_ID='${user.GLOBALID}'`,
          authentication: session,
        })
        .then(async (response: { deleteResults: IEditFeatureResult[] }) => {
          const deleteResult: IEditFeatureResult = response.deleteResults[0];
          if( !deleteResult || 'success' in deleteResult && deleteResult.success) {
            await deleteFeatures({
              url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_groups_lyr_id}`,
              objectIds: [],
              where: `USER_ID='${user.GLOBALID}'`,
              authentication: session
            })
            .then((response: { deleteResults: IEditFeatureResult[] }) => {
              return;
            })
            .catch((error: any) => {
              throw new Error(error.message);
            })
          } else {
            if('error' in deleteResult) {
              throw new Error(deleteResult.error?.description);
            }
          }
        })
        .catch((error: any) => {
          throw new Error(error.message);
        })
        res.json(updateResult);
      } else {
        if('error' in updateResult) {
          throw new Error(updateResult.error?.description);
        } else {
          throw new Error('Error deactivating user');
        }
      }
    })
    .catch((error: any) => {
      throw new Error(error.message);
    })
  }
  catch (error: any) {
    appLogger.error('User DELETE error:', error);
    res.status(500).send({
      error: error.message,
      message: 'User DELETE error'
    });
  }
})

/**
 * @swagger
 * /users:
 *  patch:
 *    summary: Update a user in wqims.users
 *    description: Updates a user in wqims.users based on ID provided in body
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
 *        description: User updated successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
usersRouter.patch('/', async (req, res) => {
  try {
    const user = req.body;
    const session: ApplicationCredentialsManager = new ApplicationCredentialsManager({
      clientId: WQIMS_REST_INFO.appId,
      clientSecret: WQIMS_REST_INFO.secret,
    });
    const roles: IWQIMSRole[] = await getRoleIds(session);
  
    await updateFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_lyr_id}`,
      authentication: session,
      features: [{
        attributes: {
          ...user
        }
      }],
    })
    .then((response: { updateResults: IEditFeatureResult[] }) => {
      // need to update role if role has changed
      updateUserRole(session, user, roles)
      .then((response: IEditFeatureResult) => {
        if('error' in response) {
          throw new Error(response.error?.description);
        }
      })
      .catch((error: any) => {
        throw new Error(error.message);
      });
      const updateResult: IEditFeatureResult = response.updateResults[0];
      if('success' in updateResult && updateResult.success) {
        res.json(response.updateResults[0]);
      } else {
        if('error' in updateResult) {
          throw new Error(updateResult.error?.description);
        }
        else {
          throw new Error('Error updating user');
        }
      }
    })
    .catch((error: any) => {
      throw new Error(error.message);
    })
  }
  catch (error: any) {
    appLogger.error('User PATCH error:', error);
    res.status(500).send({
      error: error.message,
      message: 'User PATCH error'
    });
  }
})

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

function getRoleIds(session: ApplicationCredentialsManager): Promise<IWQIMSRole[]> {
  return new Promise((resolve, reject) => {
    queryFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.roles_lyr_id}/query`,
      where: '1=1',
      outFields: '*',
      authentication: session
    }).then((response: IQueryFeaturesResponse | IQueryResponse) => {
      if('features' in response) {
        resolve(response.features.map((feature: IFeature) => {
          return {
            ROLE_ID: feature.attributes.GLOBALID,
            ROLE: feature.attributes.ROLE,
            PERMISSIONS: {
              ADD_USER: feature.attributes.ADD_USER,
              EDIT_USER: feature.attributes.EDIT_USER,
              DELETE_USER: feature.attributes.DELETE_USER,
              ASSIGN_USER_ROLE: feature.attributes.ASSIGN_USER_ROLE,
              ADD_THRESHOLD: feature.attributes.ADD_THRESHOLD,
              EDIT_THRESHOLD: feature.attributes.EDIT_THRESHOLD,
              DELETE_THRESHOLD: feature.attributes.DELETE_THRESHOLD,
              ADD_GROUP: feature.attributes.ADD_GROUP,
              ADD_GROUP_USER: feature.attributes.ADD_GROUP_USER,
              ADD_GROUP_THRESHOLD: feature.attributes.ADD_GROUP_THRESHOLD,
              EDIT_GROUP: feature.attributes.EDIT_GROUP,
              REMOVE_GROUP_USER: feature.attributes.REMOVE_GROUP_USER,
              REMOVE_GROUP: feature.attributes.REMOVE_GROUP,
              REVIEW_ALERTS: feature.attributes.REVIEW_ALERTS,
              ACKNOWLEDGE_ALERTS: feature.attributes.ACKNOWLEDGE_ALERTS,
            }
          }
        }))
      } else {
        reject([]);
      }
    })
  })
}

// Fetches the role from the rel class, checks if user input role matches
// updates the role if it doesn't match
// returns the IEditFeatureResponse
function updateUserRole(session: ApplicationCredentialsManager, user: any, roles: IWQIMSRole[]): Promise<IEditFeatureResult> {
  return new Promise((resolve, reject) => {
    queryFeatures({
      url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_roles_lyr_id}`,
      where: `USER_ID = '${user.globalid}'`,
      authentication: session
    })
    .then((response: IQueryFeaturesResponse | IQueryResponse) => {
      // if there is a response with features, then role is being updated
      if('features' in response && response.features.length > 0) {
        const prev_role = response.features[0].attributes;
        if(prev_role.map((role: IWQIMSRole)=>role.ROLE_ID) !== user.role.toLowerCase()) {
          const newRoleId: string | undefined = roles.find(role => role.ROLE === user.ROLE.toLowerCase())?.ROLE_ID;
          if(newRoleId) {
            updateFeatures({
              url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_roles_lyr_id}`,
              features: [{
                attributes: {
                  RID: prev_role.RID,
                  USER_ID: response.features[0].attributes.GLOBALID,
                  ROLE_ID: newRoleId
                }
              }],
              authentication: session
            })
            .then((response: { updateResults: IEditFeatureResult[] }) => {
              const roleUpdateResponse: IEditFeatureResult = response.updateResults[0];
              if('success' in roleUpdateResponse && roleUpdateResponse.success) {
                resolve(roleUpdateResponse);
              } else {
                reject(roleUpdateResponse);
              }
            })
          }
        }
      } else { // response with no features, no role assigned, so add role
        addFeatures({
          url: `${WQIMS_REST_INFO.url}/${WQIMS_REST_INFO.users_roles_lyr_id}`,
          features: [{
            attributes: {
              USER_ID: user.GLOBALID,
              ROLE_ID: roles.find(role => role.ROLE === user.ROLE.toLowerCase())?.ROLE_ID
            }
          }],
          authentication: session
        })
        .then((response: { addResults: IEditFeatureResult[] }) => {
          const roleAddResponse: IEditFeatureResult = response.addResults[0];
          if('success' in roleAddResponse && roleAddResponse.success) {
            resolve(roleAddResponse);
          } else {
            reject(roleAddResponse);
          }
        })
      }
    })
  })
}

export default usersRouter;