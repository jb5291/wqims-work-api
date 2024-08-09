import express from "express";
import {ApplicationCredentialsManager} from "@esri/arcgis-rest-request";
import {
  addFeatures,
    deleteFeatures,
  IEditFeatureResult,
  IFeature,
  IQueryFeaturesResponse,
  IQueryRelatedResponse,
  IQueryResponse,
  IRelatedRecordGroup,
  queryFeatures,
  queryRelated,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import {v4 as uuidv4} from "uuid";
import {authConfig} from "../util/secrets";

import {appLogger} from "../util/appLogger";
import graphHelper from "../util/graph";
import {gisCredentialManager} from "./auth";

const usersRouter = express.Router();

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
const groupsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;
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
    const response: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
      url: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
      where: "ACTIVE=1",
      authentication: gisCredentialManager,
    });

    if ("features" in response) {
      res.json(response.features);
    } else {
      throw new Error("Error getting data");
    }
  } catch (error) {
    const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
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
    const user: WqimsUser = req.body;
    if (!user) throw new Error("User data not provided");

    const response: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
      url: featureUrl,
      where: `ACTIVE=0 AND EMAIL='${user.EMAIL}'`,
      authentication: gisCredentialManager,
    });

    if ("features" in response && response.features.length > 0) {
      const existingUser = response.features[0].attributes;
      user.OBJECTID = existingUser.OBJECTID;
      user.GLOBALID = existingUser.GLOBALID;
      user.ACTIVE = 1;

      const updateResponse: {updateResults: IEditFeatureResult[]} = await updateFeatures({
        url: featureUrl,
        features: [{ attributes: user }],
        authentication: gisCredentialManager,
      });

      const updateResult: IEditFeatureResult = updateResponse.updateResults[0];
      await updateUserRole(gisCredentialManager, user);
      res.json(updateResult);
    } else {
      user.GLOBALID = `{${uuidv4().toUpperCase()}}`;
      user.ACTIVE = 1;
      const { OBJECTID, ...userWithoutOID } = user;

      const addResponse: {addResults: IEditFeatureResult[]} = await addFeatures({
        url: featureUrl,
        features: [{ attributes: userWithoutOID }],
        authentication: gisCredentialManager,
      });

      user.OBJECTID = addResponse.addResults[0].objectId;
      await updateUserRole(gisCredentialManager, user);
      res.json(addResponse.addResults[0]);
    }
  } catch (error) {
    const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User PUT Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User PUT error",
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
  try {
    const user: WqimsUser = req.body;
    if (!user) throw new Error("User data not provided");

    user.ACTIVE = 0;
    const response = await updateFeatures({
      url: featureUrl,
      features: [{ attributes: user }],
      authentication: gisCredentialManager,
    });

    const updateResult = response.updateResults[0];
    if (updateResult.success) {
      await deleteUserRelClassRecord(gisCredentialManager, user, rolesRelationshipClassUrl);
      await deleteUserRelClassRecord(gisCredentialManager, user, groupsRelationshipClassUrl);
      res.json(updateResult);
    } else {
      throw new Error(updateResult.error?.description || "Error deactivating user");
    }
  } catch (error) {
    const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User DELETE error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User DELETE error",
    });
  }
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
  try {
    const user: WqimsUser = req.body;

    const response: {updateResults: IEditFeatureResult[]} = await updateFeatures({
      url: featureUrl,
      authentication: gisCredentialManager,
      features: [{ attributes: user }],
    });

    const updateResult: IEditFeatureResult = response.updateResults[0];
    if (updateResult.success) {
      const roleResponse: IEditFeatureResult | undefined = await updateUserRole(gisCredentialManager, user);
      if (roleResponse && roleResponse.error) {
        throw new Error(roleResponse.error.description);
      }
      res.json(updateResult);
    } else {
      throw new Error(updateResult.error?.description || "Error updating user");
    }
  } catch (error) {
    const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User PATCH error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User PATCH error",
    });
  }
});

usersRouter.use("/search", async (req, res) => {
  try {
    const searchQuery = req.query.filter as string;
    const users = await graphHelper.getADUsers(searchQuery);
    res.send(users);
  } catch (error) {
    appLogger.error(error);
    res.status(500).send({ error: error instanceof Error ? error.message : "Unknown error searching for users" });
  }
});

async function getRoleIds(session: ApplicationCredentialsManager | string): Promise<WqimsRole[]> {
  const response: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
    url: rolesUrl,
    where: "1=1",
    outFields: "*",
    authentication: session,
  });

  if ("features" in response) {
    return response.features.map((feature: IFeature) => feature.attributes as WqimsRole);
  } else {
    throw new Error("No features found");
  }
}

// Fetches the role from the rel class, checks if user input role matches
// updates the role if it doesn't match
// adds the role if it doesn't exist
// returns the IEditFeatureResponse
async function updateUserRole(session: ApplicationCredentialsManager | string, user: WqimsUser): Promise<IEditFeatureResult | undefined> {
  const objectId: number = user.OBJECTID || 0;
  const allowedRoles: string[] = ["Admin", "Editor", "Viewer"];
  if (!allowedRoles.includes(user.ROLE)) {
    return Promise.reject("Invalid role");
  }

  const response: IQueryRelatedResponse = await queryRelated({
    url: featureUrl,
    objectIds: [objectId],
    outFields: ["*"],
    relationshipId: 0,
    authentication: session,
  });

  const roles: WqimsRole[] = await getRoleIds(session);
  const relatedRecordGroup: IRelatedRecordGroup = response.relatedRecordGroups?.[0];
  const relatedRecord: IFeature | undefined = relatedRecordGroup?.relatedRecords?.[0];

  if (relatedRecord?.attributes.ROLE === user.ROLE.toLowerCase()) {
    return { objectId, success: true };
  }

  const userRolesQueryResponse: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
    url: rolesRelationshipClassUrl,
    where: `USER_ID='${user.GLOBALID}'`,
    outFields: "*",
    authentication: session,
  });

  if ("features" in userRolesQueryResponse && userRolesQueryResponse.features.length > 0) {
    const rid = userRolesQueryResponse.features?.[0]?.attributes.RID;
    if (!rid) {
      return Promise.reject("No related records found in related record group.");
    }
    const userRolesUpdateResponse: {updateResults: IEditFeatureResult[]} = await updateFeatures({
      url: rolesRelationshipClassUrl,
      features: [{
        attributes: {
          RID: rid,
          USER_ID: user.GLOBALID,
          ROLE_ID: roles.find((role: WqimsRole) => role.ROLE === user.ROLE.toLowerCase())?.GLOBALID,
        },
      }],
      authentication: session,
    });

    if (userRolesUpdateResponse.updateResults[0].success) {
      return userRolesUpdateResponse.updateResults[0];
    }
  } else {
    const roleAddResponse: {addResults: IEditFeatureResult[]} = await addFeatures({
      url: rolesRelationshipClassUrl,
      features: [{
        attributes: {
          USER_ID: user.GLOBALID,
          ROLE_ID: roles.find((role: WqimsRole) => role.ROLE === user.ROLE.toLowerCase())?.GLOBALID,
        },
      }],
      authentication: session,
    });

    if (roleAddResponse.addResults[0].success) {
      return roleAddResponse.addResults[0];
    }

    return Promise.reject(roleAddResponse.addResults[0]);
  }
}
async function deleteUserRelClassRecord(session: ApplicationCredentialsManager | string, user: WqimsUser, relClassUrl: string): Promise<IEditFeatureResult | undefined> {
  const response: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
    url: relClassUrl,
    where: `USER_ID='${user.GLOBALID}'`,
    outFields: "*",
    authentication: session,
  });
  if ("features" in response && response.features.length > 0) {
    const rid = response.features?.[0]?.attributes.RID;
    if (!rid) throw new Error("No related records found in related record group.");

    const deleteResponse = await deleteFeatures({
      url: relClassUrl,
      objectIds: [rid],
      where: `USER_ID='${user.GLOBALID}'`,
      authentication: session,
    });

    if (deleteResponse.deleteResults[0].success) {
      return deleteResponse.deleteResults[0];
    } else {
      throw new Error(deleteResponse.deleteResults[0].error?.description);
    }
  } else {
    return Promise.resolve({ objectId: user.OBJECTID as number, success: true });
  }
}
export default usersRouter;
