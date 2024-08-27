import {
  IFeature,
  queryRelated,
  queryFeatures,
  IQueryFeaturesResponse,
} from "@esri/arcgis-rest-feature-service";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { WqimsGroup } from "./WqimsGroup";
import { WqimsUser } from "./WqimsUser";
import { gisCredentialManager } from "../routes/auth";
import { appLogger } from "../util/appLogger";

/**
 * Class representing a WqimsAlert.
 * @extends WqimsObject
 */
class WqimsAlert extends WqimsObject {
  GLOBALID!: string | null;
  SAMPLENUM!: string;
  LOCATION!: string;
  LOCCODE!: string;
  COLLECTDATE!: number;
  SAMPLECOLLECTOR!: string;
  ACODE!: string;
  ANALYTE!: string;
  ANALYSEDDATE!: number;
  ANALYSEDBY!: string;
  DATEVALIDATED!: number;
  VALIDATEDBY!: string;
  GEOCODEMATCHEDADDRESS!: string;
  RESULT!: string;
  WARNING_STATUS!: string;
  STATUS!: string;
  COMMENTS!: string;
  ACK_TIME!: number;
  ACK_BY!: string;
  CLOSED_TIME!: number;
  CLOSED_BY!: string;
  THRESHOLD_ID!: string | null;
  TEMPLATE_ID!: string | null;
  RESULT_ID!: string | null;
  ACTIVE!: number;

  /**
   * Creates an instance of WqimsAlert.
   * @param body - The request body.
   * @param args - Additional arguments.
   */
  constructor(body: Request["body"] | null, ...args: any[]) {
    super(body?.OBJECTID, body?.ACTIVE);
    Object.assign(this, body || {});
    if (!body) {
      [
        this.GLOBALID,
        this.SAMPLENUM,
        this.LOCATION,
        this.COLLECTDATE,
        this.SAMPLECOLLECTOR,
        this.ACODE,
        this.ANALYSEDDATE,
        this.ANALYSEDBY,
        this.DATEVALIDATED,
        this.VALIDATEDBY,
        this.GEOCODEMATCHEDADDRESS,
        this.RESULT,
        this.LOCCODE,
        this.WARNING_STATUS,
        this.ANALYTE,
        this.STATUS,
        this.COMMENTS,
        this.ACK_TIME,
        this.ACK_BY,
        this.CLOSED_TIME,
        this.CLOSED_BY,
        this.THRESHOLD_ID,
        this.TEMPLATE_ID,
        this.RESULT_ID,
      ] = args;
    }
    this.featureUrl = WqimsAlert.featureUrl
  }

  /**
   * The URL of the feature service.
   */
  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.alerts}`;

  /**
   * Retrieves active features.
   * @returns A promise that resolves to an array of active features.
   * @throws Will throw an error if the query fails.
   */
  static async getActiveFeatures(): Promise<IFeature[]> {
    try {
      const response = await queryFeatures({
        url: this.featureUrl,
        where: "ACTIVE=1",
        outFields: "*",
        returnGeometry: false,
        authentication: gisCredentialManager,
      });
      if ("features" in response) return response.features;
      throw new Error("Error getting data");
    } catch (error) {
      appLogger.error("User GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw { error: error instanceof Error ? error.message : "unknown error", message: "User GET error" };
    }
  }

  /**
   * Retrieves alerts for a specific user.
   * @param userId - The user ID.
   * @returns A promise that resolves to an array of user alerts.
   */
  static async getUserAlerts(userId: number): Promise<IFeature[]> {
    const thresholdGlobalIDs: number[] = [];
    const userGroupsResponse = await queryRelated({
      url: WqimsUser.featureUrl,
      outFields: ["OBJECTID"],
      objectIds: [userId],
      relationshipId: parseInt(authConfig.arcgis.layers.usergroups_rel_id),
      authentication: gisCredentialManager,
    });

    if (!userGroupsResponse.relatedRecordGroups?.[0]?.relatedRecords?.length) return [];

    const groupObjectIds = userGroupsResponse.relatedRecordGroups[0].relatedRecords.map((feature) => feature.attributes.OBJECTID);

    const groupThresholdsResponse = await queryRelated({
      url: WqimsGroup.featureUrl,
      outFields: ["GLOBALID"],
      objectIds: groupObjectIds,
      relationshipId: parseInt(authConfig.arcgis.layers.thresholdsgroups_rel_id),
      authentication: gisCredentialManager,
    });

    groupThresholdsResponse.relatedRecordGroups?.forEach((group) => {
      group.relatedRecords?.forEach((feature) => {
        thresholdGlobalIDs.push(feature.attributes.GLOBALID);
      });
    });

    if (!thresholdGlobalIDs.length) return [];

    const alertsResponse = await queryFeatures({
      url: this.featureUrl,
      outFields: "*",
      returnGeometry: false,
      where: `THRESHOLD_ID IN (${thresholdGlobalIDs.map((id) => `'${id}'`).join(",")})`,
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;

    return alertsResponse.features;
  }

  /**
   * Updates alert status for a specific user.
   * @param userId - The user ID.
   * @returns A promise that resolves when the alert status has been updated.
   * @throws Will throw an error if the status update fails.
   */
  async updateStatus(userId: number) {
    try {
      const userResponse = await queryFeatures({
        url: WqimsUser.featureUrl,
        outFields: ["NAME"],
        where: `OBJECTID=${userId}`,
        returnGeometry: false,
        authentication: gisCredentialManager,
      }) as IQueryFeaturesResponse;

      if (!userResponse.features?.length) throw new Error("User not found");

      switch (this.STATUS.toLowerCase()) {
        case "closed":
          Object.assign(this, {
            CLOSED_TIME: Date.now(),
            CLOSED_BY: userResponse.features[0].attributes.NAME,
            STATUS: "Closed",
            // ACTIVE: 0,
          });
          break;
        case "acknowledged":
          Object.assign(this, {
            ACK_TIME: Date.now(),
            ACK_BY: userResponse.features[0].attributes.NAME,
            STATUS: "Acknowledged",
          });
          break;
        default:
          throw new Error("Invalid status");
      }

      return await this.updateFeature();
    } catch (error) {
      appLogger.error("Alert Acknowledge Error:", error instanceof Error ? error.stack : "unknown error");
      throw { error: error instanceof Error ? error.message : "unknown error", message: "Alert Acknowledge error" };
    }
  }
}

export { WqimsAlert };