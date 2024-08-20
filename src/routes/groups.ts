import express from "express";
import { IFeature } from "@esri/arcgis-rest-feature-service";

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
 *        thresholdId:
 *          type: string
 *          required: true
 *        groupIds:
 *          type: array
 *          items:
 *            type: string
 *    AssignMemberData:
 *      type: object
 *      properties:
 *        memberId:
 *          type: string
 *          required: true
 *        groupIds:
 *          type: array
 *          items:
 *            type: string
 *    AddGroupDataResult:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GROUPNAME:
 *          type: string
 *        GROUPID:
 *          type: string
 *        ACTIVE:
 *           type: integer
 *           nullable: true
 *        MEMBERIDS:
 *          type: array
 *          items:
 *            type: string
 *        THRESHOLDIDS:
 *          type: array
 *          items:
 *            type: string
 *    AddGroupData:
 *      type: object
 *      properties:
 *        GROUPNAME:
 *          type: string
 *        MEMBERIDS:
 *          type: array
 *          items:
 *            type: string
 *        THRESHOLDIDS:
 *          type: array
 *          items:
 *            type: string
 *        ACTIVE:
 *           type: integer
 *           nullable: true
 *    GroupData:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GROUPNAME:
 *          type: string
 *        GROUPID:
 *          type: string
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
 *    ArcGISGetGroupsResponse:
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
 *                type: schema
 *                ref: '#/components/schemas/GroupData'
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
    const groups: WqimsGroup[] = await WqimsGroup.assignItemsToGroup(getGroupsResult);

    const groupData = groups.map((group: WqimsGroup) => {
      const { featureUrl, ...groupNoUrl } = group;
      return groupNoUrl;
    });
    res.json(groupData);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("Group GET Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "Group GET error",
    });
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
    const group: WqimsGroup = new WqimsGroup(req.body);

    const updateResult = await group.checkInactive();
    if (!updateResult.success) {
      const addResult = await group.addFeature();
      if (!addResult.success) throw new Error("Error adding group");
    }
    if (group.MEMBERIDS.length) {
      const membersAddResults = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl);
      if (!membersAddResults.success) {
        appLogger.warn("Group members not added:", membersAddResults.error);
        group.MEMBERIDS = [];
      }
    }
    if (group.THRESHOLDIDS.length) {
      const thresholdsAddResults = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl);
      if (!thresholdsAddResults.success) {
        appLogger.warn("Group thresholds not added:", thresholdsAddResults.error);
        group.THRESHOLDIDS = [];
      }
    }
    const { featureUrl, ...groupData } = group;
    res.json(groupData);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("Group PUT Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "Group PUT error",
    });
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
groupsRouter.post(
  "/", verifyAndRefreshToken, logRequest, async (req, res) => {
    try {
      const group = new WqimsGroup(req.body);

      const updateResult = await group.softDeleteFeature();
      if (!updateResult.success) {
        throw new Error(updateResult.error?.description || "Error updating group active status.");
      }
      res.json(group);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("Group POST Error:", stack);
      res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "Group POST error",
      });
    }
  }
);

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
groupsRouter.patch(
  "/", verifyAndRefreshToken, logRequest, async (req, res) => {
    try {
      const group: WqimsGroup = new WqimsGroup(req.body);

      const updateResult = await group.updateFeature();
      if (!updateResult.success) {
        throw new Error(updateResult.error?.description || "Error updating group");
      }

      // by default all relationship rows are deleted from each relationship
      const deleteGroupMembersResult = await group.deleteGroupItems(WqimsGroup.usersRelationshipClassUrl);
      if (!deleteGroupMembersResult.success) {
        throw new Error(deleteGroupMembersResult.error?.description);
      }
      // if there are members, add them
      if (group.MEMBERIDS.length) {
        const addGroupMembersResult = await group.addGroupItems(WqimsGroup.usersRelationshipClassUrl);
        if (!addGroupMembersResult.success) {
          appLogger.warn("Group members not added:", addGroupMembersResult.error);
          group.MEMBERIDS = [];
        }
      }

      const deleteGroupThresholdsResult = await group.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl);
      if (!deleteGroupThresholdsResult.success) {
        throw new Error(deleteGroupThresholdsResult.error?.description);
      }
      if (group.THRESHOLDIDS.length) {
        const addGroupThresholdsResult = await group.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl);
        if (!addGroupThresholdsResult.success) {
          appLogger.warn("Group thresholds not added:", addGroupThresholdsResult.error);
          group.THRESHOLDIDS = [];
        }
      }
      res.json(group);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("Group PATCH Error:", stack);
      res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "Group PATCH error",
      });
    }
  }
);

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
groupsRouter.post(
  "/assignThreshold", verifyAndRefreshToken, logRequest, async (req, res) => {
    try {
      const assignThresholdsResult = await WqimsGroup.assignThresholds(req.body.groupIds, req.body.thresholdId);
      if (!assignThresholdsResult.success) {
        throw new Error(assignThresholdsResult.error?.description || "Error assigning threshold");
      }
      res.json(assignThresholdsResult);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("Group POST Error:", stack);
      res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "Group POST error",
      });
    }
  }
);

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
      const assignMembersResult = await WqimsGroup.assignMembers(req.body.groupIds, req.body.memberId);
      if (!assignMembersResult.success) {
        throw new Error(assignMembersResult.error?.description || "Error assigning threshold");
      }
      res.json(assignMembersResult);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("Group POST Error:", stack);
      res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "Group POST error",
      });
    }
  }
);

export default groupsRouter;