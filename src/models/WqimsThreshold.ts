import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { authConfig } from "../util/secrets";
import {
  deleteFeatures,
  IEditFeatureResult,
  IQueryFeaturesResponse,
  IQueryResponse,
  queryFeatures,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import { gisCredentialManager } from "../routes/auth";

/**
 * Class representing a WqimsThreshold.
 * @extends WqimsObject
 */
class WqimsThreshold extends WqimsObject {
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
    const response = await queryFeatures({
      url: this.featureUrl,
      where: `ACTIVE=0 AND LOCATION_CODE='${this.LOCATION_CODE}' AND ANALYSIS='${this.ANALYSIS}'`,
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;

    if (response.features?.length) {
      this.GLOBALID = response.features[0].attributes.GLOBALID;
    }

    return this.reactivateFeature(response);
  }

  /**
   * Removes relationship records from M2M tables
   * @param relClassUrl relationship class url
   * @returns {Promise<IEditFeatureResult | undefined>} A promise that resolves to the result of the remove relationship operation.
   */
  async removeRelationship(relClassUrl: string): Promise<IEditFeatureResult | undefined> {
    const queryRelResponse = await queryFeatures({
      url: relClassUrl,
      where: `THRSHLD_ID='${this.GLOBALID}'`,
      returnIdsOnly: true,
      authentication: gisCredentialManager,
    }) as IQueryResponse;

    if (queryRelResponse.objectIds?.length) {
      const deleteRelResponse = await deleteFeatures({
        url: relClassUrl,
        objectIds: queryRelResponse.objectIds,
        authentication: gisCredentialManager,
      });

      if (deleteRelResponse.deleteResults[0].success) {
        return deleteRelResponse.deleteResults[0];
      } else {
        return Promise.reject(deleteRelResponse.deleteResults[0]?.error?.description);
      }
    } else {
      return { objectId: this.OBJECTID || 0, success: true };
    }
  }
}

export { WqimsThreshold };