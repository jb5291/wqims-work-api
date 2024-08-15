import { WqimsObject } from "./Wqims";
import {
  addFeatures,
  deleteFeatures,
  IEditFeatureResult,
  IFeature,
  queryFeatures,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import { Request } from "express";

import { gisCredentialManager } from "../routes/auth";
import { authConfig } from "../util/secrets";
import { appLogger } from "../util/appLogger";

class WqimsGroup extends WqimsObject {
  GROUPNAME: string;
  GROUPID: string | null;
  MEMBERIDS: string[];
  THRESHOLDIDS: string[];

  /**
   * Constructs a new WqimsGroup instance.
   *
   * @param {Request["body"]} body - The request body.
   */
  constructor(body: Request["body"] | null);

  /**
   * Constructs a new WqimsGroup instance.
   *
   * @param {Request["body"]} body - The request body.
   * @param {string} GROUPNAME - The group name.
   * @param {number | undefined} ACTIVE - The active status.
   * @param {string[]} MEMBERIDS - The member IDs.
   * @param {string[]} THRESHOLDIDS - The threshold IDs.
   * @param {number | undefined} OBJECTID - The object ID.
   * @param {string | null} GROUPID - The group ID.
   */
  constructor(
    body: Request["body"] | null,
    GROUPNAME: string,
    ACTIVE: number | undefined,
    MEMBERIDS: string[],
    THRESHOLDIDS: string[],
    OBJECTID: number | undefined,
    GROUPID: string | null
  );

  /**
   * Constructs a new WqimsGroup instance.
   *
   * @param {Request["body"]} body - The request body.
   * @param {string} GROUPNAME - The group name.
   * @param {number | undefined} ACTIVE - The active status.
   * @param {string[]} MEMBERIDS - The member IDs.
   * @param {string[]} THRESHOLDIDS - The threshold IDs.
   * @param {number | undefined} OBJECTID - The object ID.
   * @param {string | null} GROUPID - The group ID.
   */
  constructor(
    body: Request["body"] | null,
    GROUPNAME?: string,
    ACTIVE?: number | undefined,
    MEMBERIDS?: string[],
    THRESHOLDIDS?: string[],
    OBJECTID?: number | undefined,
    GROUPID?: string | null
  ) {
    if (body) {
      super(body.OBJECTID, body.ACTIVE);
      this.GROUPNAME = body.GROUPNAME;
      this.MEMBERIDS = body.MEMBERIDS ? body.MEMBERIDS : [];
      this.THRESHOLDIDS = body.THRESHOLDIDS ? body.THRESHOLDIDS : [];
      this.GROUPID = body.GROUPID;
    } else {
      super(OBJECTID, ACTIVE);
      this.GROUPNAME = !GROUPNAME ? "" : GROUPNAME;
      this.MEMBERIDS = !MEMBERIDS ? [] : MEMBERIDS;
      this.THRESHOLDIDS = !THRESHOLDIDS ? [] : THRESHOLDIDS;
      this.GROUPID = !GROUPID ? null : GROUPID;
    }
  }

  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.groups}`;
  static usersRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;
  static thresholdsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds_groups}`;

  /**
   * Assigns thresholds to a group.
   *
   * @param {string[]} groupIds - The IDs of the groups.
   * @param {string} thresholdId - The ID of the threshold.
   * @returns {Promise<IEditFeatureResult>} The result of the add operation.
   */
  static async assignThresholds(groupIds: string[], thresholdId: string): Promise<IEditFeatureResult> {
    const addGroupThresholdResult = await addFeatures({
      url: WqimsGroup.thresholdsRelationshipClassUrl,
      authentication: gisCredentialManager,
      features: groupIds.map((id: string) => {
        return {
          attributes: {
            GROUP_ID: id,
            THRSHLD_ID: thresholdId,
          },
        };
      }),
    });
    return addGroupThresholdResult.addResults[0];
  }

  static async assignMembers(groupIds: string[], userId: string): Promise<IEditFeatureResult> {
    const addGroupMemberResult = await addFeatures({
      url: WqimsGroup.usersRelationshipClassUrl,
      authentication: gisCredentialManager,
      features: groupIds.map((id: string) => {
        return {
          attributes: {
            GROUP_ID: id,
            USER_ID: userId,
          },
        };
      }),
    });
    return addGroupMemberResult.addResults[0];
  }

  static async assignItemsToGroup(response: IFeature[]) {
    const groups: WqimsGroup[] = await Promise.all(
      response.map(async (groupFeature: IFeature) => {
        const group = new WqimsGroup(groupFeature.attributes);
        const getGroupMembers = await group.getGroupItems(WqimsGroup.usersRelationshipClassUrl);
        const getGroupThresholds = await group.getGroupItems(WqimsGroup.thresholdsRelationshipClassUrl);

        group.MEMBERIDS = getGroupMembers.map((member: IFeature) => member.attributes.USER_ID);
        group.THRESHOLDIDS = getGroupThresholds.map((threshold: IFeature) => threshold.attributes.THRSHLD_ID);

        return group;
      })
    );
    return groups;
  }

  /**
   * Sets the group ID.
   *
   * @param {string | null} value - The group ID.
   */
  set groupId(value: string | null) {
    this.GROUPID = value;
  }

  /**
   * Reactivates a feature by querying for inactive records and updating the active status.
   *
   * @returns {Promise<IEditFeatureResult>} The result of the feature update operation.
   */
  async checkInactive(): Promise<IEditFeatureResult> {
    const response = await queryFeatures({
      url: this.featureUrl,
      where: `ACTIVE=0 AND GROUPNAME='${this.GROUPNAME}'`,
      authentication: gisCredentialManager,
    });

    if ("features" in response && response.features.length > 0) {
      this.GROUPID = response.features[0].attributes.GLOBALID;
    }

    return await this.reactivateFeature(response);
  }

  /**
   * Updates a feature.
   *
   * @returns {Promise<IEditFeatureResult>} The result of the update operation.
   */
  async updateFeature(): Promise<IEditFeatureResult> {
    const { MEMBERIDS, THRESHOLDIDS, ...groupWithoutItems } = this;

    const response = await updateFeatures({
      url: this.featureUrl,
      features: [{ attributes: groupWithoutItems }],
      authentication: gisCredentialManager,
    });

    return response.updateResults[0] as IEditFeatureResult;
  }

  /**
   * Soft deletes a feature by setting its active status to 0.
   *
   * @returns {Promise<IEditFeatureResult>} The result of the soft delete operation.
   */
  async softDeleteFeature(): Promise<IEditFeatureResult> {
    this.ACTIVE = 0;
    const { MEMBERIDS, THRESHOLDIDS, ...groupWithoutItems } = this;
    const response = await updateFeatures({
      url: this.featureUrl,
      features: [{ attributes: groupWithoutItems }],
      authentication: gisCredentialManager,
    });
    return response.updateResults[0] as IEditFeatureResult;
  }

  /**
   * Adds group items to a relationship class.
   *
   * @param {string} relClassUrl - The relationship class URL.
   * @returns {Promise<IEditFeatureResult>} The result of the add operation.
   */
  async addGroupItems(relClassUrl: string): Promise<IEditFeatureResult> {
    switch (relClassUrl) {
      case WqimsGroup.thresholdsRelationshipClassUrl: {
        const addGroupThrshldResult = await addFeatures({
          url: relClassUrl,
          authentication: gisCredentialManager,
          features: this.THRESHOLDIDS.map((id: string) => {
            return {
              attributes: {
                GROUP_ID: this.GROUPID,
                THRSHLD_ID: id,
              },
            };
          }),
        });

        return addGroupThrshldResult.addResults[0];
      }
      case WqimsGroup.usersRelationshipClassUrl: {
        const addGroupUserResult = await addFeatures({
          url: relClassUrl,
          authentication: gisCredentialManager,
          features: this.MEMBERIDS.map((id: string) => {
            return {
              attributes: {
                GROUP_ID: this.GROUPID,
                USER_ID: id,
              },
            };
          }),
        });

        return addGroupUserResult.addResults[0];
      }
      default:
        return { objectId: -1, success: false, error: { code: 999, description: "Invalid relationship class URL" } };
    }
  }

  /**
   * Deletes group items from a relationship class.
   *
   * @param {string} relClassUrl - The relationship class URL.
   * @returns {Promise<IEditFeatureResult>} The result of the delete operation.
   */
  async deleteGroupItems(relClassUrl: string): Promise<IEditFeatureResult> {
    const queryRelatedRecordsResult = await queryFeatures({
      url: relClassUrl,
      where: `GROUP_ID='${this.GROUPID}'`,
      returnIdsOnly: true,
      authentication: gisCredentialManager,
    });

    if (
      queryRelatedRecordsResult &&
      "objectIds" in queryRelatedRecordsResult &&
      queryRelatedRecordsResult.objectIds &&
      queryRelatedRecordsResult.objectIds.length > 0
    ) {
      const deleteGroupThresholdsResult = await deleteFeatures({
        url: relClassUrl,
        objectIds: queryRelatedRecordsResult.objectIds,
        authentication: gisCredentialManager,
      });

      return deleteGroupThresholdsResult.deleteResults[0];
    } else if (
      queryRelatedRecordsResult &&
      "objectIds" in queryRelatedRecordsResult &&
      queryRelatedRecordsResult.objectIds &&
      queryRelatedRecordsResult.objectIds.length === 0
    ) {
      return { objectId: -1, success: true, error: { code: 999, description: "No relationships found" } };
    } else {
      return { objectId: -1, success: false, error: { code: 999, description: "Invalid relationship class URL" } };
    }
  }

  /**
   * Retrieves group items from a relationship class.
   *
   * @param {string} relClassUrl - The relationship class URL.
   * @returns {Promise<IFeature[]>} The retrieved features.
   * @throws Will throw an error if the data retrieval fails.
   */
  async getGroupItems(relClassUrl: string): Promise<IFeature[]> {
    try {
      const response = await queryFeatures({
        url: relClassUrl,
        where: `GROUP_ID='${this.GROUPID}'`,
        outFields: "*",
        authentication: gisCredentialManager,
      });

      if ("features" in response) {
        return response.features;
      } else {
        throw new Error("Error getting data");
      }
    } catch (error) {
      const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("User GET Error:", stack);
      throw {
        error: error instanceof Error ? error.message : "unknown error",
        message: "User GET error",
      };
    }
  }
}

export { WqimsGroup };
