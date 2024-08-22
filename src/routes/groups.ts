import express from "express";
import { appLogger } from "../util/appLogger";
import { WqimsGroup } from "../models/WqimsGroup";
import { logRequest, verifyAndRefreshToken } from "./auth";

const groupsRouter = express.Router();

/**
 * @swagger
 * components:
 *  schemas:
 *    AssignThresholdData:
 *      type: object
 *      properties:
 *        thresholdId: { type: string, required: true } // ID of the threshold to be assigned
 *        GROUPIDs: { type: array, items: { type: string } } // Array of group IDs to which the threshold will be assigned
 *    AssignMemberData:
 *      type: object
 *      properties:
 *        memberId: { type: string, required: true } // ID of the member to be assigned
 *        GROUPIDs: { type: array, items: { type: string } } // Array of group IDs to which the member will be assigned
 *    AddGroupDataResult:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } // Object ID of the group
 *        GROUPNAME: { type: string } // Name of the group
 *        GROUPID: { type: string } // ID of the group
 *        ACTIVE: { type: integer, nullable: true } // Active status of the group
 *        MEMBERIDS: { type: array, items: { type: string } } // Array of member IDs in the group
 *        THRESHOLDIDS: { type: array, items: { type: string } } // Array of threshold IDs in the group
 *    AddGroupData:
 *      type: object
 *      properties:
 *        GROUPNAME: { type: string } // Name of the group
 *        MEMBERIDS: { type: array, items: { type: string } } // Array of member IDs to be added to the group
 *        THRESHOLDIDS: { type: array, items: { type: string } } // Array of threshold IDs to be added to the group
 *        ACTIVE: { type: integer, nullable: true } // Active status of the group
 *    GroupData:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } // Object ID of the group
 *        GROUPNAME: { type: string } // Name of the group
 *        GROUPID: { type: string } // ID of the group
 *        ACTIVE: { type: integer, nullable: true } // Active status of the group
 *    ArcGISEditFeatureResponse:
 *      type: object
 *      properties:
 *        addResults: {
 *          type: array,
 *          items: {
 *            type: object,
 *            properties: {
 *              objectId: { type: number }, // Object ID of the added feature
 *              globalId: { type: string }, // Global ID of the added feature
 *              success: { type: boolean }, // Success status of the operation
 *              error: {
 *                type: object,
 *                properties: {
 *                  code: { type: number }, // Error code
 *                  description: { type: string } // Error description
 *                }
 *              }
 *            }
 *          }
 *        } // Array of results from adding a feature
 *    ArcGISGetGroupsResponse:
 *      type: object
 *      properties:
 *        objectIdFieldName: { type: string } // Field name for the object ID
 *        globalIdFieldName: { type: string } // Field name for the global ID
 *        hasZ: { type: boolean } // Indicates if the response has Z values
 *        hasM: { type: boolean } // Indicates if the response has M values
 *        fields: { type: array, items: { type: object, properties: { name: { type: string }, alias: { type: string }, type: { type: string }, length: { type: number } } } } // Array of field definitions
 *        features: {
 *          type: array,
 *          items: {
 *            type: object,
 *            properties: {
 *              attributes: {
 *                type: schema,
 *                ref: '#/components/schemas/GroupData'
 *              }
 *            }
 *          }
 *        } // Array of features
 */

/**
 * @swagger
 * /notificationGroups:
 *  get:
 *    summary: Get list of groups
 *    description: Gets a list of groups from notificationGroups
 *    tags:
 *      - Notification Groups
 *    responses:
 *      '200':
 *        description: A list of groups
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISGetGroupsResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
groupsRouter.get("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const getGroupsResult = await WqimsGroup.getActiveFeatures();
    const groups = await WqimsGroup.assignItemsToGroup(getGroupsResult);

    const groupData = groups.map(({ featureUrl, MEMBERS, THRESHOLDS, ...group }) => ({
      ...group,
      MEMBERS: MEMBERS.map(({ featureUrl, ...member }) => member),
      THRESHOLDS: THRESHOLDS.map(({ featureUrl, ...threshold }) => threshold),
    }));

    res.json(groupData);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /notificationGroups:
 *  put:
 *    summary: adds group to group list
 *    description: adds a group to notificationGroups
 *    tags:
 *      - Notification Groups
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AddGroupData'
 *    responses:
 *      '200':
 *        description: Group added successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/AddGroupDataResult'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
groupsRouter.put("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const group = new WqimsGroup(req.body.group);
    const { usersToAdd = [], thresholdsToAdd = [] } = req.body;

    const updateResult = await group.checkInactive();
    if (!updateResult.success) {
      const addResult = await group.addFeature();
      if (!addResult.success) throw new Error("Error adding group");
    }

    if (usersToAdd.length) {
      const MEMBERSAddResults = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl, usersToAdd);
      if (!MEMBERSAddResults.success) {
        appLogger.warn("Group MEMBERS not added:", MEMBERSAddResults.error);
        group.MEMBERS = [];
      }
    }

    if (thresholdsToAdd.length) {
      const thresholdsAddResults = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, thresholdsToAdd);
      if (!thresholdsAddResults.success) {
        appLogger.warn("Group thresholds not added:", thresholdsAddResults.error);
        group.THRESHOLDS = [];
      }
    }

    const { featureUrl, ...groupData } = group;
    res.json(groupData);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /notificationGroups:
 *  post:
 *    summary: Deactivates a group from groups table
 *    description: Deactivates a group from groups based on group provided in body
 *    tags:
 *      - Notification Groups
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/GroupData'
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
groupsRouter.post("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const group = new WqimsGroup(req.body);
    const updateResult = await group.softDeleteFeature();
    if (!updateResult.success) throw new Error(updateResult.error?.description || "Error updating group active status.");
    res.json(group);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /notificationGroups:
 *  patch:
 *    summary: updates group
 *    description: updates a group in notificationGroups table, could also be used to remove
 *         all items from a group.
 *    tags:
 *      - Notification Groups
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AddGroupDataResult'
 *    responses:
 *      '200':
 *        description: Group added successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/AddGroupDataResult'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
groupsRouter.patch("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const group = new WqimsGroup(req.body.group);
    const { usersToRemove = [], usersToAdd = [], thresholdsToRemove = [], thresholdsToAdd = [] } = req.body;

    const updateResult = await group.updateFeature();
    if (!updateResult.success) throw new Error(updateResult.error?.description || "Error updating group");

    if (usersToRemove.length > 1) {
      const deleteGroupMEMBERSResult = await group.deleteGroupItems(WqimsGroup.usersRelationshipClassUrl, usersToRemove);
      if (!deleteGroupMEMBERSResult.success) throw new Error(deleteGroupMEMBERSResult.error?.description);
    }

    if (usersToAdd.length) {
      const addGroupMEMBERSResult = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl, usersToAdd);
      if (!addGroupMEMBERSResult.success) {
        appLogger.warn("Group MEMBERS not added:", addGroupMEMBERSResult.error);
        group.MEMBERS = [];
      }
    }

    if (thresholdsToRemove.length > 1) {
      const deleteGroupThresholdsResult = await group.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, thresholdsToRemove);
      if (!deleteGroupThresholdsResult.success) throw new Error(deleteGroupThresholdsResult.error?.description);
    }

    if (thresholdsToAdd.length) {
      const addGroupThresholdsResult = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, thresholdsToAdd);
      if (!addGroupThresholdsResult.success) {
        appLogger.warn("Group thresholds not added:", addGroupThresholdsResult.error);
        group.THRESHOLDS = [];
      }
    }

    res.json(group);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /notificationGroups/assignThreshold:
 *  post:
 *    summary: assigns a threshold to a group
 *    description: Adds a relationship based on threshold id and group ids provided in body
 *    tags:
 *      - Notification Groups
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AssignThresholdData'
 *    responses:
 *      '200':
 *        description: Threshold assigned successfully
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
groupsRouter.post("/assignThreshold", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const assignThresholdsResult = await WqimsGroup.assignThresholds(req.body.GROUPIDs, req.body.thresholdId);
    if (!assignThresholdsResult.success) throw new Error(assignThresholdsResult.error?.description || "Error assigning threshold");
    res.json(assignThresholdsResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /notificationGroups/assignMember:
 *  post:
 *    summary: assigns a member to a group
 *    description: Adds a relationship based on member id and group ids provided in body
 *    tags:
 *      - Notification Groups
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AssignMemberData'
 *    responses:
 *      '200':
 *        description: Member assigned successfully
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
groupsRouter.post("/assignMember", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const assignMEMBERSResult = await WqimsGroup.assignMembers(req.body.GROUPIDs, req.body.memberId);
    if (!assignMEMBERSResult.success) throw new Error(assignMEMBERSResult.error?.description || "Error assigning threshold");
    res.json(assignMEMBERSResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

export default groupsRouter;