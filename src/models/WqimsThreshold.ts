import { WqimsObject, IEditFeatureResult, IQueryResponse, IFeature } from "./Wqims";
import { Request } from "express";
import { authConfig } from "../util/secrets";
import { Wqims } from "./Wqims.interface";
import { ArcGISService } from '../services/ArcGISService';
import { appLogger } from '../util/appLogger';

/**
 * Class representing a WqimsThreshold.
 * @extends WqimsObject
 */
class WqimsThreshold extends WqimsObject implements Wqims {
  GLOBALID!: string | null;
  LOCATION_CODE!: string;
  LOCATION_NAME!: string;
  PROJECT_NAME!: string;
  ANALYSIS!: string;
  ANALYTE!: string;
  UPPER_LOWER_SPECS!: string;
  SPECS_VALUE!: number;
  ACKTIMEOUT!: number;
  CLOSEOUTTIMEOUT!: number;
  TEMPLATE_ID!: string;
  SYSTEM!: string;
  UNIT!: string;

  /**
   * Creates an instance of WqimsThreshold.
   * @param body - The request body.
   * @param args - Additional arguments.
   */
  constructor(body: Request["body"] | null, ...args: any[]) {
    super(body?.OBJECTID, body?.ACTIVE);
    Object.assign(this, body || {});
    if (!body) {
      [
        this.GLOBALID,
        this.LOCATION_CODE,
        this.LOCATION_NAME,
        this.PROJECT_NAME,
        this.ANALYSIS,
        this.ANALYTE,
        this.UPPER_LOWER_SPECS,
        this.SPECS_VALUE,
        this.ACKTIMEOUT,
        this.CLOSEOUTTIMEOUT,
        this.TEMPLATE_ID,
        this.SYSTEM,
        this.UNIT,
      ] = args;
    }

    this.featureUrl = WqimsThreshold.featureUrl;
  }

  /**
   * The URL of the feature service.
   */
  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds}`;

  /**
   * The URL of the groups relationship class.
   */
  static groupsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds_groups}`;

  /**
   * Sets the global ID.
   * @param value - The global ID.
   */
  set globalId(value: string | null) {
    this.GLOBALID = value;
  }

  /**
   * Checks for inactive thresholds.
   * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the reactivation operation.
   */
  async checkInactive(): Promise<IEditFeatureResult> {
    const response = await ArcGISService.request<IQueryResponse>(
      `${this.featureUrl}/query`,
      'GET',
      {
        where: `ACTIVE=0 AND LOCATION_CODE='${this.LOCATION_CODE}' AND ANALYSIS='${this.ANALYSIS}'`,
        outFields: "*"
      }
    );

    if (response.features?.length) {
      this.GLOBALID = response.features[0].attributes.GLOBALID;
    }

    return this.reactivateFeature(response);
  }

  /**
   * Removes relationship records from M2M tables
   * @param relClassUrl relationship class url
   * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the remove relationship operation.
   */
  async removeRelationship(relClassUrl: string): Promise<IEditFeatureResult> {
    try {
      const queryResponse = await ArcGISService.request<IQueryResponse>(
        `${relClassUrl}/query`,
        'GET',
        {
          where: `THRSHLD_ID='${this.GLOBALID}'`,
          returnIdsOnly: true
        }
      );

      if (!queryResponse.objectIds?.length) {
        return { objectId: this.OBJECTID || 0, success: true };
      }

      const deleteResponse = await ArcGISService.request<{ deleteResults: IEditFeatureResult[] }>(
        `${relClassUrl}/deleteFeatures`,
        'POST',
        { objectIds: queryResponse.objectIds }
      );

      if (!deleteResponse.deleteResults[0].success) {
        throw new Error(deleteResponse.deleteResults[0].error?.description || "Delete failed");
      }

      return deleteResponse.deleteResults[0];
    } catch (error) {
      return Promise.reject(error);
    }
  }

  static async getThreshold(thresholdId: number): Promise<IFeature | null> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          where: `OBJECTID=${thresholdId}`,
          outFields: '*'
        }
      );
      
      return response.features?.[0] || null;
    } catch (error) {
      appLogger.error("GET Threshold Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }
}

export { WqimsThreshold };
