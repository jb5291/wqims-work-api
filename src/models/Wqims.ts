import { ArcGISService } from '../services/ArcGISService';
import { appLogger } from "../util/appLogger";
import { v4 as uuidv4 } from "uuid";

export interface IEditFeatureResult {
  objectId: number;
  globalId?: string;
  success: boolean;
  error?: {
    code: number;
    description: string;
  };
}

export interface IFeature {
  attributes: Record<string, any>;
}

export interface IQueryResponse {
  objectIds?: number[];
  features?: IFeature[];
}

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
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          where: "ACTIVE=1",
          outFields: "*",
          returnGeometry: false
        }
      );
      
      if (!response.features) throw new Error("Error getting data");
      return response.features;
      
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

    const { OBJECTID, featureUrl, ...objectWithoutOID } = this;
    
    try {
      const response = await ArcGISService.request<{ addResults: IEditFeatureResult[] }>(
        `${this.featureUrl}/addFeatures`,
        'POST',
        {
          features: [{
            attributes: objectWithoutOID
          }]
        }
      );

      const result = response.addResults[0];
      this.OBJECTID = result.objectId;

      if("GLOBALID" in this) {
        return { ...result, globalId: this.GLOBALID as string };
      } else if("GROUPID" in this) {
        return { ...result, globalId: this.GROUPID as string };
      } else {
        return result;
      }
    } catch (error) {
      appLogger.error("Add feature error:", error);
      throw error;
    }
  }

  /**
   * Updates an existing feature.
   * @returns A promise that resolves to the result of the update operation.
   */
  async updateFeature(): Promise<IEditFeatureResult> {
    try {
      const response = await ArcGISService.request<{ updateResults: IEditFeatureResult[] }>(
        `${this.featureUrl}/updateFeatures`,
        'POST',
        {
          features: [{ attributes: this }]
        }
      );
      return response.updateResults[0];
    } catch (error) {
      appLogger.error("Update feature error:", error);
      throw error;
    }
  }

  /**
   * Soft deletes a feature by setting its active status to 0.
   * @returns A promise that resolves to the result of the soft delete operation.
   */
  async softDeleteFeature(): Promise<IEditFeatureResult> {
    this.ACTIVE = 0;
    const { featureUrl, ...objectWithoutUrl } = this;
    
    try {
      const response = await ArcGISService.request<{ updateResults: IEditFeatureResult[] }>(
        `${this.featureUrl}/updateFeatures`,
        'POST',
        {
          features: [{ attributes: objectWithoutUrl }]
        }
      );
      return response.updateResults[0];
    } catch (error) {
      appLogger.error("Soft delete feature error:", error);
      throw error;
    }
  }

  /**
   * Reactivates a feature if it exists in the response.
   * @param response - The response from a query operation.
   * @returns A promise that resolves to the result of the reactivation operation.
   */
  async reactivateFeature(response: IQueryResponse): Promise<IEditFeatureResult> {
    if (response.features && response.features.length > 0) {
      const existingObject = response.features[0].attributes;
      this.objectId = existingObject.OBJECTID;
      this.active = 1;

      try {
        const updateResponse = await ArcGISService.request<{ updateResults: IEditFeatureResult[] }>(
          `${this.featureUrl}/updateFeatures`,
          'POST',
          {
            features: [{ attributes: this }]
          }
        );
        return updateResponse.updateResults[0];
      } catch (error) {
        appLogger.error("Reactivate feature error:", error);
        throw error;
      }
    } else {
      return { 
        objectId: -1, 
        success: false, 
        error: { 
          code: 999, 
          description: "No inactive record found" 
        } 
      };
    }
  }

  static async getObject(objectId: number): Promise<IFeature | null> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'POST',
        {
          where: `OBJECTID=${objectId} AND ACTIVE=1`,
          outFields: "*",
          returnGeometry: false
        }
      );
      
      if (response.features && response.features.length > 0) {
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
