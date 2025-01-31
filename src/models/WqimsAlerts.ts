import { IFeature, IQueryResponse } from "./Wqims";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { WqimsGroup } from "./WqimsGroup";
import { WqimsUser } from "./WqimsUser";
import { appLogger } from "../util/appLogger";
import { Wqims } from "./Wqims.interface";
import { ArcGISService } from '../services/ArcGISService';

/**
 * Class representing a WqimsAlert.
 * @extends WqimsObject
 */
class WqimsAlert extends WqimsObject implements Wqims {
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
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          where: "ACTIVE=1",
          outFields: "*",
          returnGeometry: false
        }
      );
      
      return response.features || [];
    } catch (error) {
      appLogger.error("Alerts GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }

  /**
   * Retrieves alerts for a specific user.
   * @param userId - The user ID.
   * @returns A promise that resolves to an array of user alerts.
   */
  static async getUserAlerts(userId: number): Promise<IFeature[]> {
    try {
      // Get user's groups
      const userGroupsResponse = await ArcGISService.request<IQueryResponse>(
        `${WqimsUser.featureUrl}/queryRelatedRecords`,
        'GET',
        {
          objectIds: [userId],
          relationshipId: parseInt(authConfig.arcgis.layers.usergroups_rel_id),
          outFields: ["OBJECTID"]
        }
      );

      if (!userGroupsResponse.relatedRecordGroups?.[0]?.relatedRecords?.length) {
        return [];
      }

      const groupObjectIds = userGroupsResponse.relatedRecordGroups[0].relatedRecords
        .map((feature) => feature.attributes.OBJECTID);

      // Get thresholds for those groups
      const groupThresholdsResponse = await ArcGISService.request<IQueryResponse>(
        `${WqimsGroup.featureUrl}/queryRelatedRecords`,
        'GET',
        {
          objectIds: groupObjectIds,
          relationshipId: parseInt(authConfig.arcgis.layers.thresholdsgroups_rel_id),
          outFields: ["GLOBALID"]
        }
      );

      const thresholdGlobalIDs: string[] = [];
      groupThresholdsResponse.relatedRecordGroups?.forEach((group) => {
        group.relatedRecords?.forEach((feature) => {
          thresholdGlobalIDs.push(feature.attributes.GLOBALID);
        });
      });

      if (!thresholdGlobalIDs.length) {
        return [];
      }

      // Get alerts for those thresholds
      const alertsResponse = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          outFields: "*",
          returnGeometry: false,
          where: `THRESHOLD_ID IN (${thresholdGlobalIDs.map((id) => `'${id}'`).join(",")})`
        }
      );

      return alertsResponse.features || [];
    } catch (error) {
      appLogger.error("User Alerts GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }

  /**
   * Updates alert status for a specific user.
   * @param userId - The user ID.
   * @returns A promise that resolves when the alert status has been updated.
   * @throws Will throw an error if the status update fails.
   */
  async updateStatus(userId: number) {
    try {
      const userResponse = await ArcGISService.request<IQueryResponse>(
        `${WqimsUser.featureUrl}/query`,
        'GET',
        {
          outFields: ["NAME"],
          where: `OBJECTID=${userId}`,
          returnGeometry: false
        }
      );

      if (!userResponse.features?.length) {
        throw new Error("User not found");
      }

      switch (this.STATUS.toLowerCase()) {
        case "closed":
          Object.assign(this, {
            CLOSED_TIME: Date.now(),
            CLOSED_BY: userResponse.features[0].attributes.NAME,
            STATUS: "Closed"
          });
          break;
        case "acknowledged":
          Object.assign(this, {
            ACK_TIME: Date.now(),
            ACK_BY: userResponse.features[0].attributes.NAME,
            STATUS: "Acknowledged"
          });
          break;
        default:
          throw new Error("Invalid status");
      }

      return await this.updateFeature();
    } catch (error) {
      appLogger.error("Alert Status Update Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }

  static async getAlert(alertId: number): Promise<IFeature | null> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          where: `OBJECTID=${alertId}`,
          outFields: '*'
        }
      );
      
      return response.features?.[0] || null;
    } catch (error) {
      appLogger.error("Alert GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }
}

export { WqimsAlert };