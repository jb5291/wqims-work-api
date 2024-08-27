import { WqimsObject } from "./Wqims";
import {
  addFeatures,
  deleteFeatures,
  IEditFeatureResult,
  IFeature, IQueryFeaturesResponse, IQueryResponse,
  IRelatedRecordGroup,
  queryFeatures,
  queryRelated,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import { Request } from "express";
import { gisCredentialManager } from "../routes/auth";
import { authConfig } from "../util/secrets";
import { appLogger } from "../util/appLogger";
import { WqimsUser } from "./WqimsUser";
import { WqimsThreshold } from "./WqimsThreshold";

/**
 * Class representing a WqimsGroup.
 * @extends WqimsObject
 */
class WqimsGroup extends WqimsObject {
  GROUPNAME: string;
  GROUPID: string | null;
  MEMBERS: WqimsUser[];
  THRESHOLDS: WqimsThreshold[];

  /**
   * Creates an instance of WqimsGroup.
   * @param body - The request body.
   * @param GROUPNAME - The group name.
   * @param ACTIVE - The active status.
   * @param MEMBERS - The group members.
   * @param THRESHOLDS - The group thresholds.
   * @param OBJECTID - The object ID.
   * @param GROUPID - The group ID.
   */
  constructor(
      body: Request["body"] | null,
      GROUPNAME?: string,
      ACTIVE?: number,
      MEMBERS?: WqimsUser[],
      THRESHOLDS?: WqimsThreshold[],
      OBJECTID?: number,
      GROUPID?: string | null
  ) {
    super(body?.OBJECTID ?? OBJECTID, body?.ACTIVE ?? ACTIVE);
    this.GROUPNAME = body?.GROUPNAME ?? GROUPNAME ?? "";
    this.MEMBERS = body?.MEMBERS ?? MEMBERS ?? [];
    this.THRESHOLDS = body?.THRESHOLDS ?? THRESHOLDS ?? [];
    this.GROUPID = body?.GROUPID ?? GROUPID ?? null;

    this.featureUrl = WqimsGroup.featureUrl;
  }

  /**
   * The URL of the feature service.
   */
  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.groups}`;

  /**
   * The URL of the users relationship class.
   */
  static usersRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;

  /**
   * The URL of the thresholds relationship class.
   */
  static thresholdsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds_groups}`;

  /**
   * Assigns thresholds to groups.
   * @param GROUPIDs - The group IDs.
   * @param thresholdId - The threshold ID.
   * @returns A promise that resolves to the result of the add operation.
   */
  static async assignThresholds(GROUPIDs: string[], thresholdId: string): Promise<IEditFeatureResult> {
    const features = GROUPIDs.map(id => ({ attributes: { GROUP_ID: id, THRSHLD_ID: thresholdId } }));
    const result = await addFeatures({ url: this.thresholdsRelationshipClassUrl, authentication: gisCredentialManager, features });
    return result.addResults[0];
  }

  /**
   * Assigns members to groups.
   * @param GROUPIDs - The group IDs.
   * @param userId - The user ID.
   * @returns A promise that resolves to the result of the add operation.
   */
  static async assignMembers(GROUPIDs: string[], userId: string): Promise<IEditFeatureResult> {
    const features = GROUPIDs.map(id => ({ attributes: { GROUP_ID: id, USER_ID: userId } }));
    const result = await addFeatures({ url: this.usersRelationshipClassUrl, authentication: gisCredentialManager, features });
    return result.addResults[0];
  }

  /**
   * Assigns items to groups.
   * @param response - The response from a query operation.
   * @returns A promise that resolves to an array of WqimsGroup instances.
   */
  static async assignItemsToGroup(response: IFeature[]): Promise<WqimsGroup[]> {
    return Promise.all(response.map(async groupFeature => {
      const group = new WqimsGroup(groupFeature.attributes);
      group.MEMBERS = await group.getGroupItems(parseInt(authConfig.arcgis.layers.usergroups_rel_id)).then(items => items.map(item => new WqimsUser(item.attributes)));
      group.THRESHOLDS = await group.getGroupItems(parseInt(authConfig.arcgis.layers.thresholdsgroups_rel_id)).then(items => items.map(item => new WqimsThreshold(item.attributes)));
      return group;
    }));
  }

  /**
   * Sets the group ID.
   * @param value - The group ID.
   */
  set groupId(value: string | null) {
    this.GROUPID = value;
  }

  /**
   * Checks for inactive groups.
   * @returns A promise that resolves to the result of the reactivation operation.
   */
  async checkInactive(): Promise<IEditFeatureResult> {
    const response = await queryFeatures({ url: this.featureUrl, where: `ACTIVE=0 AND GROUPNAME='${this.GROUPNAME}'`, authentication: gisCredentialManager }) as IQueryFeaturesResponse;
    if (response.features?.length) this.groupId = response.features[0].attributes.GROUPID;
    return this.reactivateFeature(response);
  }

  /**
   * Updates an existing group.
   * @returns A promise that resolves to the result of the update operation.
   */
  async updateFeature(): Promise<IEditFeatureResult> {
    const { MEMBERS, THRESHOLDS, ...groupWithoutItems } = this;
    const response = await updateFeatures({ url: this.featureUrl, features: [{ attributes: groupWithoutItems }], authentication: gisCredentialManager });
    return response.updateResults[0];
  }

  /**
   * Soft deletes a group by setting its active status to 0.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDeleteFeature(): Promise<IEditFeatureResult> {
    this.ACTIVE = 0;
    const { MEMBERS, THRESHOLDS, ...groupWithoutItems } = this;
    const response = await updateFeatures({ url: this.featureUrl, features: [{ attributes: groupWithoutItems }], authentication: gisCredentialManager });
    return response.updateResults[0];
  }

  /**
   * Adds items to a group.
   * @param relClassUrl - The relationship class URL.
   * @param items - The items to add.
   * @returns A promise that resolves to the result of the add operation.
   */
  async addGroupItems(relClassUrl: string, items: WqimsUser[] | WqimsThreshold[]): Promise<IEditFeatureResult> {
    const ids = items.map(feature => feature.GLOBALID);
    const features = ids.map(id => ({ attributes: { GROUP_ID: this.GROUPID, [relClassUrl === WqimsGroup.thresholdsRelationshipClassUrl ? 'THRSHLD_ID' : 'USER_ID']: id } }));
    const result = await addFeatures({ url: relClassUrl, authentication: gisCredentialManager, features });
    return result.addResults[0];
  }

  /**
   * Deletes items from a group.
   * @param relClassUrl - The relationship class URL.
   * @param items - The items to delete.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteGroupItems(relClassUrl: string, items: (WqimsUser[] | WqimsThreshold[])): Promise<IEditFeatureResult> {
    let whereClause: string;
    if ('ANALYTE' in items[0]) {
      whereClause = `GROUP_ID='${this.GROUPID}' AND THRSHLD_ID IN ('${items.map(feature=>feature.GLOBALID).join("','")}')`;
    } else {
      whereClause = `GROUP_ID='${this.GROUPID}' AND USER_ID IN ('${items.map(feature=>feature.GLOBALID).join("','")}')`;
    }
    const queryResult = await queryFeatures({ url: relClassUrl, where: whereClause, returnIdsOnly: true, authentication: gisCredentialManager }) as IQueryResponse;
    if (queryResult.objectIds?.length) {
      const deleteResult = await deleteFeatures({ url: relClassUrl, objectIds: queryResult.objectIds, authentication: gisCredentialManager });
      return deleteResult.deleteResults[0];
    }
    return { objectId: -1, success: queryResult.objectIds?.length === 0, error: { code: 999, description: queryResult.objectIds?.length === 0 ? "No relationships found" : "Invalid relationship class URL" } };
  }

  /**
   * Retrieves items for a group.
   * @param relationshipId - The relationship ID.
   * @returns A promise that resolves to an array of features.
   * @throws Will throw an error if the query fails.
   */
  async getGroupItems(relationshipId: number): Promise<IFeature[]> {
    try {
      const response = await queryRelated({ url: this.featureUrl, objectIds: [this.objectId], relationshipId, outFields: "*", authentication: gisCredentialManager });
      return response.relatedRecordGroups?.[0]?.relatedRecords ?? [];
    } catch (error) {
      appLogger.error("User GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw { error: error instanceof Error ? error.message : "unknown error", message: "User GET error" };
    }
  }
}

export { WqimsGroup };