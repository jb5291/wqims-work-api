import express from "express";
import { appLogger } from "../util/appLogger";
import { WqimsGroup } from "../models/WqimsGroup";
import { logRequest, verifyAndRefreshToken } from "./auth";
import { WqimsUser } from "../models/WqimsUser";
import { WqimsThreshold } from "../models/WqimsThreshold";

const groupsRouter = express.Router();

/**
 * @swagger
 * components:
 *  schemas:
 *    AssignThresholdData:
 *      type: object
 *      properties:
 *        thresholdId: { type: string, required: true } 
 *        GROUPIDs: { type: array, items: { type: string } } 
 *    AssignMemberData:
 *      type: object
 *      properties:
 *        memberId: { type: string, required: true } 
 *        GROUPIDs: { type: array, items: { type: string } } 
 *    AddGroupDataResult:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } 
 *        GROUPNAME: { type: string } 
 *        GROUPID: { type: string } 
 *        ACTIVE: { type: integer, nullable: true } 
 *        MEMBERS: { type: array, items: { type: string } } 
 *        THRESHOLDS: { type: array, items: { type: string } } 
 *    AddGroupData:
 *      type: object
 *      properties:
 *        GROUPNAME: { type: string } 
 *        MEMBERS: { type: array, items: { type: string } } 
 *        THRESHOLDS: { type: array, items: { type: string } } 
 *        ACTIVE: { type: integer, nullable: true } 
 *    GroupData:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } 
 *        GROUPNAME: { type: string } 
 *        GROUPID: { type: string } 
 *        ACTIVE: { type: integer, nullable: true } 
 *    ArcGISEditFeatureResponse:
 *      type: object
 *      properties:
 *        addResults: {
 *          type: array,
 *          items: {
 *            type: object,
 *            properties: {
 *              objectId: { type: number }, 
 *              globalId: { type: string }, 
 *              success: { type: boolean }, 
 *              error: {
 *                type: object,
 *                properties: {
 *                  code: { type: number }, 
 *                  description: { type: string } 
 *                }
 *              }
 *            }
 *          }
 *        } 
 *    ArcGISGetGroupsResponse:
 *      type: object
 *      properties:
 *        objectIdFieldName: { type: string } 
 *        globalIdFieldName: { type: string } 
 *        hasZ: { type: boolean } 
 *        hasM: { type: boolean } 
 *        fields: { type: array, items: { type: object, properties: { name: { type: string }, alias: { type: string }, type: { type: string }, length: { type: number } } } } 
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
 *        } 
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
groupsRouter.get("/", /*verifyAndRefreshToken, logRequest,*/ async (req, res) => {
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
      appLogger.error("Group GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group GET error" });
    } else {
      appLogger.error("Group GET Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group GET error" });
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
groupsRouter.put("/", /*verifyAndRefreshToken, logRequest,*/ async (req, res) => {
  try {
    const group = new WqimsGroup(req.body);

    const updateResult = await group.checkInactive();
    if (!updateResult.success) {
      const addResult = await group.addFeature();
      if (!addResult.success) throw new Error("Error adding group");
      group.GROUPID = addResult.globalId as string;
    }

    if (group.MEMBERS.length) {
      const MEMBERSAddResults = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl, group.MEMBERS);
      if (!MEMBERSAddResults.success) {
        appLogger.warn("Group MEMBERS not added:", MEMBERSAddResults.error);
        group.MEMBERS = [];
      }
      const newMembers = group.MEMBERS.filter((user: WqimsUser) => !group.MEMBERS.some(member => member.GLOBALID === user.GLOBALID));
      group.MEMBERS.push(...newMembers);
    }

    if (group.THRESHOLDS.length) {
      const thresholdsAddResults = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, group.THRESHOLDS);
      if (!thresholdsAddResults.success) {
        appLogger.warn("Group thresholds not added:", thresholdsAddResults.error);
        group.THRESHOLDS = [];
      }
      const newThresholds = group.THRESHOLDS.filter((threshold: WqimsThreshold) => !group.THRESHOLDS.some(groupThreshold => groupThreshold.GLOBALID === threshold.GLOBALID));
      group.THRESHOLDS.push(...newThresholds);
    }

    const { featureUrl, ...groupData } = group;
    res.json(groupData);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group PUT error" });
    } else {
      appLogger.error("Group PUT Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group PUT error" });
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
groupsRouter.post("/", /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const group = new WqimsGroup(req.body);
    const updateResult = await group.softDeleteFeature();
    if (!updateResult.success) throw new Error(updateResult.error?.description || "Error updating group active status.");

    if(group.MEMBERS.length) {
      const deleteMembersResult = await group.deleteGroupItems(WqimsGroup.usersRelationshipClassUrl, group.MEMBERS);
      if (!deleteMembersResult.success) throw new Error(deleteMembersResult.error?.description);
    }

    if(group.THRESHOLDS.length) {
      const deleteThresholdsResult = await group.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, group.THRESHOLDS);
      if (!deleteThresholdsResult.success) throw new Error(deleteThresholdsResult.error?.description);
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

    if (usersToRemove.length) {
      const deleteGroupMEMBERSResult = await group.deleteGroupItems(WqimsGroup.usersRelationshipClassUrl, usersToRemove);
      if (!deleteGroupMEMBERSResult.success) throw new Error(deleteGroupMEMBERSResult.error?.description);
      group.MEMBERS = group.MEMBERS.filter(({ GLOBALID }) => !usersToRemove.map((user: WqimsUser)=>user.GLOBALID).includes(GLOBALID));
    }

    if (usersToAdd.length) {
      const addGroupMEMBERSResult = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl, usersToAdd);
      if (!addGroupMEMBERSResult.success) {
        appLogger.warn("Group MEMBERS not added:", addGroupMEMBERSResult.error);
        group.MEMBERS = [];
      }
      const newMembers = usersToAdd.filter((user: WqimsUser) => !group.MEMBERS.some(member => member.GLOBALID === user.GLOBALID));
      group.MEMBERS.push(...newMembers);
    }

    if (thresholdsToRemove.length) {
      const deleteGroupThresholdsResult = await group.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, thresholdsToRemove);
      if (!deleteGroupThresholdsResult.success) throw new Error(deleteGroupThresholdsResult.error?.description);
      group.THRESHOLDS = group.THRESHOLDS.filter(({ GLOBALID }) => !thresholdsToRemove.map((threshold: WqimsThreshold) => threshold.GLOBALID).includes(GLOBALID));
    }

    if (thresholdsToAdd.length) {
      const addGroupThresholdsResult = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, thresholdsToAdd);
      if (!addGroupThresholdsResult.success) {
        appLogger.warn("Group thresholds not added:", addGroupThresholdsResult.error);
        group.THRESHOLDS = [];
      }
      const newThresholds = thresholdsToAdd.filter((threshold: WqimsThreshold) => !group.THRESHOLDS.some(groupThreshold => groupThreshold.GLOBALID === threshold.GLOBALID));
      group.THRESHOLDS.push(...newThresholds);
    }

    const { featureUrl, ...groupData } = group;

    res.json(groupData);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group PATCH Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group PATCH error" });
    } else {
      appLogger.error("Group PATCH Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group PATCH error" });
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

/**
 * @swagger
 * /notificationGroups/{id}:
 *  get:
 *    summary: Get a group by id
 *    description: Gets a group by id from notificationGroups
 *    parameters: 
 *      - in: path
 *        name: id
 *        required: true
 *        description: The id of the group to get
 *        schema:
 *          type: integer
 *    tags:
 *      - Notification Groups
 *    responses:
 *      '200':
 *        description: A group
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/GroupData'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
groupsRouter.get('/:id', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const groupResult = await WqimsGroup.getGroup(groupId);
    if (groupResult) {
      const groupItems = await WqimsGroup.assignItemsToGroup([groupResult])

      const groupData = groupItems.map(({ featureUrl, MEMBERS, THRESHOLDS, ...group }) => ({
        ...group,
        MEMBERS: MEMBERS.map(({ featureUrl, ...member }) => member),
        THRESHOLDS: THRESHOLDS.map(({ featureUrl, ...threshold }) => threshold),
      }));
      res.json(groupData);
    } else {
      res.status(404).json({ message: 'Group not found' });
    }
  } catch (error) {
    console.error('Error fetching group                             :', error);
    res.status(500).json({ message: 'Error fetching group', error });
  }
});

export default groupsRouter;
