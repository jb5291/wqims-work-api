import express from "express";
import { ApplicationCredentialsManager } from "@esri/arcgis-rest-request";
import {
  addFeatures,
  updateFeatures,
  queryFeatures,
  IQueryFeaturesResponse,
  IQueryResponse,
  IQueryRelatedResponse,
  IRelatedRecordGroup,
  IEditFeatureResult,
  IFeature,
  queryRelated,
} from "@esri/arcgis-rest-feature-service";
import { v4 as uuidv4 } from "uuid";

import { authConfig } from "../util/secrets";
import { appLogger } from "../util/appLogger";
import graphHelper from "../util/graph";
import { gisCredentialManager } from "./auth";
// import { AGSsession } from '../api';

const usersRouter = express.Router();

type arcgisError = {
  code: number;
  description: string;
};
type WqimsUser = {
  OBJECTID: number | null;
  GLOBALID: string | null;
  NAME: string;
  DEPARTMENT: string;
  POSITION: string;
  DIVISION: string;
  PHONENUMBER: string;
  EMAIL: string;
  ROLE: string;
  RAPIDRESPONSETEAM: number;
  ALTPHONENUMBER: string;
  STARTTIME: string;
  ENDTIME: string;
  ACTIVE: number | null;
};
type WqimsRole = {
  OBJECTID: number;
  ROLE: string;
  ADD_USER: number;
  EDIT_USER: number;
  DELETE_USER: number;
  ASSIGN_USER_ROLE: number;
  ADD_THRESHOLD: number;
  EDIT_THRESHOLD: number;
  DELETE_THRESHOLD: number;
  ADD_GROUP: number;
  ADD_GROUP_USER: number;
  ADD_GROUP_THRESHOLD: number;
  EDIT_GROUP: number;
  REMOVE_GROUP_USER: number;
  REMOVE_GROUP: number;
  REVIEW_ALERTS: number;
  ACKNOWLEDGE_ALERTS: number;
  GLOBALID: string;
};

const featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`;
const rolesRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_roles}`;
const rolesUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.roles}`;

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
usersRouter.get("/" /*, logRequest, verifyAndRefreshToken*/, async (req, res) => {
  try {
    gisCredentialManager.refreshToken().then((manager: string) => {
      queryFeatures({
        url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
        where: "ACTIVE=1",
        authentication: manager,
      }).then((response: IQueryFeaturesResponse | IQueryResponse) => {
        if ("features" in response) {
          res.json(response.features);
        } else {
          throw new Error("Error getting data");
        }
      });
    });
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User GET Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User GET error",
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
usersRouter.put("/", async (req, res) => {
  try {
    let getUserResult: IQueryFeaturesResponse | IQueryResponse;
    const user: WqimsUser = req.body;

    if (!user) {
      throw new Error("User data not provided");
    }

    // query user table to see if user already exists and is inactive
    // DOES NOT CHECK IF THE USER EXISTS ALREADY, ONLY IF THEY ARE INACTIVE
    // NEED TO CHECK FOR DUPLICATE USERS ON THE FRONT END
    gisCredentialManager.refreshToken().then(async (token: string) => {
      await queryFeatures({
        url: featureUrl,
        where: `ACTIVE=0 AND EMAIL='${user.EMAIL}'`,
        authentication: token,
      })
        .then(async (response: IQueryFeaturesResponse | IQueryResponse) => {
          getUserResult = response;
          // if user exists and is inactive, update the user
          if ("features" in getUserResult && getUserResult.features.length > 0) {
            //
            // REACTIVATE USER
            //
            user.OBJECTID = getUserResult.features[0].attributes.OBJECTID;
            user.GLOBALID = getUserResult.features[0].attributes.GLOBALID;
            user.ACTIVE = 1;
            await updateFeatures({
              url: featureUrl,
              features: [
                {
                  attributes: user,
                },
              ],
              authentication: token,
            }).then(async (response: { updateResults: IEditFeatureResult[] }) => {
              const updateResult: IEditFeatureResult = response.updateResults[0];
              // if the user was inactive, find their previous role, and compare it to the new role
              await updateUserRole(token, user)
                .then((response: IEditFeatureResult) => {
                  if ("error" in response) {
                    throw new Error(response.error?.description);
                  }
                })
                .catch((error) => {
                  throw new Error(error.message);
                });
              res.json(updateResult);
            });
          } else {
            // create a new user
            const new_guid = `{${uuidv4().toUpperCase()}}`;
            user.GLOBALID = new_guid;
            user.ACTIVE = 1;
            addFeatures({
              url: featureUrl,
              features: [
                {
                  attributes: {
                    GLOBALID: user.GLOBALID,
                    NAME: user.NAME,
                    DEPARTMENT: user.DEPARTMENT,
                    POSITION: user.POSITION,
                    DIVISION: user.DIVISION,
                    PHONENUMBER: user.PHONENUMBER,
                    EMAIL: user.EMAIL,
                    ROLE: user.ROLE,
                    RAPIDRESPONSETEAM: user.RAPIDRESPONSETEAM,
                    ALTPHONENUMBER: user.ALTPHONENUMBER,
                    STARTTIME: user.STARTTIME,
                    ENDTIME: user.ENDTIME,
                    ACTIVE: user.ACTIVE,
                  },
                },
              ],
              authentication: token,
            }).then(async (response: { addResults: IEditFeatureResult[] }) => {
              // add role to relationship class
              await updateUserRole(token, user).then((response: IEditFeatureResult) => {
                if ("error" in response) {
                  throw new Error(response.error?.description);
                }
              });
              res.json(response.addResults[0]);
            });
          }
        })
        .catch((error) => {
          throw new Error(error.message);
        });
    });
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User GET Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User GET error",
    });
  }
});

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
usersRouter.post("/", async (req, res) => {
  /* try {
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
  } */
});

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
usersRouter.patch("/", async (req, res) => {
  /* try {
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
  } */
});

usersRouter.use("/search", async (req, res) => {
  try {
    const searchQuery = req.query.filter as string;
    const users = await graphHelper.getADUsers(searchQuery);
    res.send(users);
  } catch (error) {
    appLogger.error(error);
    res.status(500).send(error);
  }
});

function getRoleIds(session: ApplicationCredentialsManager | string): Promise<WqimsRole[]> {
  return new Promise((resolve, reject) => {
    queryFeatures({
      url: rolesUrl,
      where: "1=1",
      outFields: "*",
      authentication: session,
    }).then((response: IQueryFeaturesResponse | IQueryResponse) => {
      if ("features" in response) {
        resolve(
          response.features.map((feature: IFeature) => {
            return feature.attributes as WqimsRole;
          })
        );
      } else {
        reject([]);
      }
    });
  });
}

// Fetches the role from the rel class, checks if user input role matches
// updates the role if it doesn't match
// returns the IEditFeatureResponse
function updateUserRole(session: ApplicationCredentialsManager | string, user: WqimsUser): Promise<IEditFeatureResult> {
  return new Promise((resolve, reject) => {
    const objectId = user.OBJECTID ? user.OBJECTID : 0;
    const allowedRoles: string[] = ["Admin", "Editor", "Viewer"];
    if (allowedRoles.includes(user.ROLE)) {
      queryRelated({
        url: featureUrl,
        objectIds: [objectId],
        outFields: ["ROLE"],
        relationshipId: 0, // this is the relationship id for the users_roles rel class
        authentication: session,
      }).then(async (response: IQueryRelatedResponse) => {
        // updating role
        const roles = await getRoleIds(session);
        if ("relatedRecordGroups" in response && response.relatedRecordGroups.length > 0) {
          const relatedRecordGroup: IRelatedRecordGroup = response.relatedRecordGroups[0];
          if (
            "relatedRecords" in relatedRecordGroup &&
            relatedRecordGroup.relatedRecords &&
            relatedRecordGroup.relatedRecords.length > 0
          ) {
            const relatedRecord = relatedRecordGroup.relatedRecords[0];
            if (relatedRecord.attributes.ROLE === user.ROLE.toLowerCase()) {
              resolve({ objectId: objectId, success: true });
            } else {
              await updateFeatures({
                url: rolesRelationshipClassUrl,
                features: [
                  {
                    attributes: {
                      RID: relatedRecord.attributes.RID,
                      USER_ID: user.GLOBALID,
                      ROLE_ID: roles.find((role) => role.ROLE === user.ROLE.toLowerCase())?.GLOBALID,
                    },
                  },
                ],
              });
            }
          } else {
            throw new Error("No related records found in related record group.");
          }
        } else {
          // add role
          addFeatures({
            url: rolesRelationshipClassUrl,
            features: [
              {
                attributes: {
                  USER_ID: user.GLOBALID,
                  ROLE_ID: roles.find((role) => role.ROLE === user.ROLE.toLowerCase())?.GLOBALID,
                },
              },
            ],
            authentication: session,
          }).then((response: { addResults: IEditFeatureResult[] }) => {
            const roleAddResponse: IEditFeatureResult = response.addResults[0];
            if ("success" in roleAddResponse && roleAddResponse.success) {
              resolve(roleAddResponse);
            } else {
              reject(roleAddResponse);
            }
          });
        }
      });
    } else {
      reject("Invalid role");
    }
  });
}

export default usersRouter;
