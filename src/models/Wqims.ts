import {
  addFeatures,
  IEditFeatureResult,
  IFeature,
  IQueryFeaturesResponse,
  IQueryResponse,
  queryFeatures,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import { gisCredentialManager } from "../routes/auth";
import { appLogger } from "../util/appLogger";
import { v4 as uuidv4 } from "uuid";

/**
 * Class representing a WqimsObject.
 */
class WqimsObject {
  OBJECTID?: number;
  ACTIVE?: number = 1;
  static featureUrl: string;
  featureUrl: string = WqimsObject.featureUrl;

  /**
   * Creates an instance of WqimsObject.
   * @param OBJECTID - The object ID.
   * @param ACTIVE - The active status.
   */
  constructor(OBJECTID?: number, ACTIVE?: number) {
    this.OBJECTID = OBJECTID;
    this.ACTIVE = ACTIVE ?? 1;
  }

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
        authentication: gisCredentialManager,
      });
      if ("features" in response) return response.features;
      throw new Error("Error getting data");
    } catch (error) {
      appLogger.error("GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw { error: error instanceof Error ? error.message : "unknown error", message: "GET error" };
    }
  }

  /**
   * Sets the active status.
   * @param value - The active status.
   */
  set active(value: number) {
    this.ACTIVE = value ?? 0;
  }

  /**
   * Sets the object ID.
   * @param value - The object ID.
   */
  set objectId(value: number) {
    this.OBJECTID = value ?? 0;
  }

  /**
   * Gets the object ID.
   * @returns The object ID.
   */
  get objectId(): number {
    return this.OBJECTID ?? 0;
  }

  /**
   * Adds a new feature.
   * @returns A promise that resolves to the result of the add operation.
   */
  async addFeature(): Promise<IEditFeatureResult> {
    if ("globalId" in this) this.globalId = `{${uuidv4().toUpperCase()}}`;
    else if ("GROUPID" in this) this.GROUPID = `{${uuidv4().toUpperCase()}}`;
    this.active = 1;

    const { OBJECTID, ...objectWithoutOID } = this;
    const addResponse = await addFeatures({
      url: this.featureUrl,
      features: [{ attributes: objectWithoutOID }],
      authentication: gisCredentialManager,
    });

    this.OBJECTID = addResponse.addResults[0].objectId;
    if("GLOBALID" in this) {
      return { objectId: this.OBJECTID, success: addResponse.addResults[0].success, globalId: this.GLOBALID as string }
    } else if("GROUPID" in this) {
      return  { objectId: this.OBJECTID, success: addResponse.addResults[0].success, globalId: this.GROUPID as string };
    } else {
      return addResponse.addResults[0];
    }
  }

  /**
   * Updates an existing feature.
   * @returns A promise that resolves to the result of the update operation.
   */
  async updateFeature(): Promise<IEditFeatureResult> {
    const response = await updateFeatures({
      url: this.featureUrl,
      authentication: gisCredentialManager,
      features: [{ attributes: this }],
    });
    return response.updateResults[0];
  }

  /**
   * Soft deletes a feature by setting its active status to 0.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDeleteFeature(): Promise<IEditFeatureResult> {
    this.ACTIVE = 0;
    const { featureUrl, ...objectWithoutUrl } = this;
    const response = await updateFeatures({
      url: this.featureUrl,
      features: [{ attributes: objectWithoutUrl }],
      authentication: gisCredentialManager,
    });
    return response.updateResults[0];
  }

  /**
   * Reactivates a feature if it exists in the response.
   * @param response - The response from a query operation.
   * @returns A promise that resolves to the result of the reactivation operation.
   */
  async reactivateFeature(response: IQueryFeaturesResponse | IQueryResponse): Promise<IEditFeatureResult> {
    if ("features" in response && response.features.length > 0) {
      const existingObject = response.features[0].attributes;
      this.objectId = existingObject.OBJECTID;
      this.active = 1;

      const updateResponse = await updateFeatures({
        url: this.featureUrl,
        features: [{ attributes: this }],
        authentication: gisCredentialManager,
      });

      return updateResponse.updateResults[0];
    } else {
      return { objectId: -1, success: false, error: { code: 999, description: "No inactive record found" } };
    }
  }

  static async getObject(objectId: number): Promise<IFeature | null> {
    try {
      const response = await queryFeatures({
        url: this.featureUrl,
        where: `OBJECTID=${objectId} AND ACTIVE=1`,
        outFields: "*",
        authentication: gisCredentialManager,
      });
      if ("features" in response && response.features.length > 0) {
        return response.features[0];
      }
      return null;
    } catch (error) {
      appLogger.error("GET Object Error:", error instanceof Error ? error.stack : "unknown error");
      throw { error: error instanceof Error ? error.message : "unknown error", message: "GET object error" };
    }
  }
}

export { WqimsObject };
