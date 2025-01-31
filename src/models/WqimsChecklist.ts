import { IEditFeatureResult, IFeature, IQueryResponse } from "./Wqims";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { appLogger } from "../util/appLogger";
import { v4 as uuidv4 } from "uuid";
import { Wqims } from "./Wqims.interface";
import { ArcGISService } from '../services/ArcGISService';

export type IChecklistItem = {
  DESCRIPTION: string;
  ORDER_: number;
  CREATED_AT: number | null;
  UPDATED_AT: number | null;
  STATUS: string;
  COMPLETED_BY: string | null;
  COMPLETED_AT: number | null;
  GLOBALID: string | null;
  OBJECTID: number | null;
  TEMPLATE_ID: string | null;
}

/**
 * Class representing a WqimsChecklist.
 * @extends WqimsObject
 */
class WqimsChecklist extends WqimsObject implements Wqims {
  GLOBALID!: string | null;
  TEMPLATE_NAME!: string;
  CREATED_AT!: number;
  UPDATED_AT!: number;
  items!: IChecklistItem[];

    constructor(body: Request["body"] | null, ...args: any[]) {
        super(body?.OBJECTID, body?.ACTIVE);
        // Initialize default values
        this.TEMPLATE_NAME = "";
        this.items = [];
        this.CREATED_AT = 0;
        this.UPDATED_AT = 0;
        this.GLOBALID = null;

        // Assign body values if provided
        if (body) {
            Object.assign(this, body);
        } else if (args.length) {
            [
                this.CREATED_AT,
                this.UPDATED_AT,
                this.GLOBALID,
                this.TEMPLATE_NAME,
                this.items,
            ] = args;
        }

        this.featureUrl = WqimsChecklist.featureUrl;
    }

    static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.checklist_templates}`;
    static itemFeaturesUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.checklist_items}`;

    set globalId(value: string | null) {
        this.GLOBALID = value;
    }

    get globalId() {
        return this.GLOBALID;
    }

    /**
   * Retrieves active features, all features for checklists and checklist items.
   * @returns A promise that resolves to an array of active features.
   * @throws Will throw an error if the query fails.
   */
  static async getActiveFeatures(): Promise<IFeature[]> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${this.featureUrl}/query`,
        'GET',
        {
          where: "1=1",
          outFields: "*"
        }
      );

      if (response.features) {
        const itemsResponse = await ArcGISService.request<IQueryResponse>(
          `${this.itemFeaturesUrl}/query`,
          'GET',
          {
            where: "1=1",
            outFields: "*"
          }
        );

        response.features.forEach(template => {
          const templateAttrs = template.attributes as WqimsChecklist;
          templateAttrs.items = (itemsResponse.features || [])
            .map(item => item.attributes as IChecklistItem)
            .filter(item => item.TEMPLATE_ID?.toUpperCase() === templateAttrs.GLOBALID?.toUpperCase());
        });
        return response.features;
      }
      throw { 
        error: "Error getting data", 
        message: "Checklist GET error" 
      };
    } catch (error) {
      appLogger.error("Checklist GET Error:", error instanceof Error ? error.stack : "unknown error");
      if (error && typeof error === 'object' && 'error' in error) {
        throw error;
      }
      throw { 
        error: error instanceof Error ? error.message : "Error getting data", 
        message: "Checklist GET error" 
      };
    }
  }

  static async removeRelationshipFromTemplate(templateId: number): Promise<IEditFeatureResult> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${WqimsChecklist.featureUrl}/query`,
        'GET',
        {
          where: `OBJECTID = ${templateId}`,
          outFields: "*"
        }
      );
      if (response.objectIds?.length) {
        const deleteResult = await ArcGISService.request<{ deleteResults: IEditFeatureResult[] }>(
          `${WqimsChecklist.featureUrl}/deleteFeatures`,
          'POST',
          {
            objectIds: response.objectIds,
          }
        );
        return deleteResult.deleteResults[0];
      } else {
        return {objectId: -1, success: response.objectIds?.length === 0, error: {code: 999, description: response.objectIds?.length === 0 ? "No relationships found" : "Invalid relationship class URL"}};
      }
    } catch (error) {
      appLogger.error("Checklist DELETE Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist DELETE error"};
    }
  }

  static async deleteFeature(url: string, templateId: number): Promise<IEditFeatureResult> {
    try {
      const response: { deleteResults: IEditFeatureResult[]; } = await ArcGISService.request<{ deleteResults: IEditFeatureResult[]; }>(
        `${url}/deleteFeatures`,
        'POST',
        {
          objectIds: [templateId]
        }
      );
      return response.deleteResults[0];
    } catch (error) {
      appLogger.error("Checklist DELETE Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist DELETE error"};
    }
  }

  static async getChecklistItems(templateId: number): Promise<IFeature[]> {
    try {
      const response = await ArcGISService.request<IQueryResponse>(
        `${WqimsChecklist.featureUrl}/query`,
        'GET',
        {
          where: `OBJECTID = ${templateId}`,
          outFields: "*"
        }
      );
      if (response.features) {
        return response.features;
      } else {
        return [];
      }
    } catch (error) {
      appLogger.error("Checklist GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist GET error"};
    }
  }

  /**
   * Adds a new feature.
   * @returns A promise that resolves to the result of the add operation.
   */
  static async addTemplateFeature(templateName: string, creationTime: number): Promise<IEditFeatureResult> {
    try {
      const response = await ArcGISService.request<{ addResults: IEditFeatureResult[] }>(
        `${this.featureUrl}/addFeatures`,
        'POST',
        {
          features: [{
            attributes: {
              TEMPLATE_NAME: templateName,
              CREATED_AT: creationTime,
              UPDATED_AT: creationTime,
              GLOBALID: `{${uuidv4().toUpperCase()}}`
            }
          }]
        }
      );

      if (!response.addResults[0].success) {
        throw new Error(response.addResults[0].error?.description || "Add failed");
      }
      return response.addResults[0];
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw error;
    }
  }

  /**
   * Updates a feature.
   * @returns A promise that resolves to the result of the update operation.
   */
  static async updateTemplateFeature(template: Partial<WqimsChecklist>): Promise<Partial<WqimsChecklist>> {
    try {
      const response = await ArcGISService.request<{ updateResults: IEditFeatureResult[] }>(
        `${this.featureUrl}/updateFeatures`,
        'POST',
        {
          features: [{ attributes: template }]
        }
      );

      if (!response.updateResults[0].success) {
        throw { error: "Error updating template", message: "Checklist PATCH error" };
      }
      return template;
    } catch (error) {
      appLogger.error("Checklist PATCH Error:", error instanceof Error ? error.stack : "unknown error");
      throw { 
        error: error instanceof Error ? error.message : "Error updating template",
        message: "Checklist PATCH error" 
      };
    }
  }

  static async addItemFeatures(items: IChecklistItem[]): Promise<IEditFeatureResult[]> {
    try {
      items.forEach(item => {
        item.GLOBALID = `{${uuidv4().toUpperCase()}}`;
        item.CREATED_AT = item.CREATED_AT || Date.now();
        item.UPDATED_AT = item.UPDATED_AT || Date.now();
      })
      const addResponse = await ArcGISService.request<{ addResults: IEditFeatureResult[] }>(
        `${WqimsChecklist.itemFeaturesUrl}/addFeatures`,
        'POST',
        {
          features: items.map(item => ({attributes: item}))
        }
      );
      if (addResponse.addResults.every(result => result.success)) {
        addResponse.addResults.forEach((result, index) => {
          items[index].OBJECTID = result.objectId;
        });
        return addResponse.addResults;
      } else {
        throw new Error("Error adding items");
      }
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist PUT error"};
    }
  }

  static async removeItemFeatures(items: IChecklistItem[]): Promise<IEditFeatureResult[]> {
    try {
      const deleteResponse = await ArcGISService.request<{ deleteResults: IEditFeatureResult[] }>(
        `${WqimsChecklist.itemFeaturesUrl}/deleteFeatures`,
        'POST',
        {
          objectIds: items.map(item => item.OBJECTID as number)
        }
      );
      return deleteResponse.deleteResults;
    } catch (error) {
      appLogger.error("Checklist DELETE Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist DELETE error"};
    }
  }

  static async updateItemFeatures(items: IChecklistItem[]): Promise<IChecklistItem[]> {
    try {
      const updateResponse = await ArcGISService.request<{ updateResults: IEditFeatureResult[] }>(
        `${WqimsChecklist.itemFeaturesUrl}/updateFeatures`,
        'POST',
        {
          features: items.map(item => ({attributes: item}))
        }
      );
      if(updateResponse.updateResults.every(result => result.success)) {
        return items;
      } else {
        throw new Error("Error updating items");
      }
    } catch (error) {
      appLogger.error("Checklist PATCH Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist PATCH error"};
    }
  }

  static cleanItem(item: IChecklistItem, templateId: string): IChecklistItem {
    return {
      ...item,
      TEMPLATE_ID: templateId,
      CREATED_AT: item.CREATED_AT || Date.now(),
      UPDATED_AT: item.UPDATED_AT || Date.now(),
      GLOBALID: item.GLOBALID || `{${uuidv4().toUpperCase()}}`
    }
  }

  async addItemsToTemplate(): Promise<IEditFeatureResult[]> {
    try {
      const featureJson = this.items.map(item => ({
        attributes: WqimsChecklist.cleanItem(item, this.GLOBALID as string)
      }));
      const addResponse = await ArcGISService.request<{ addResults: IEditFeatureResult[] }>(
        `${WqimsChecklist.itemFeaturesUrl}/addFeatures`,
        'POST',
        { features: featureJson }
      );
      if(addResponse.addResults.every(result => result.success)) {
        return addResponse.addResults;
      }
      throw { error: "Error adding items", message: "Checklist PUT error" };
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw { 
        error: error instanceof Error ? error.message : "unknown error", 
        message: "Checklist PUT error" 
      };
    }
  }

  /**
   * Adds a new feature.
   * @returns A promise that resolves to the result of the add operation.
   */
  async addItemFeature(): Promise<IEditFeatureResult> {
    try {
      this.GLOBALID = `{${uuidv4().toUpperCase()}}`;
  
      const { OBJECTID, ACTIVE, featureUrl, ...objectWithoutOID } = this;
      const addResponse = await ArcGISService.request<{ addResults: IEditFeatureResult[] }>(
        `${WqimsChecklist.itemFeaturesUrl}/addFeatures`,
        'POST',
        {
          features: [{ attributes: objectWithoutOID }]
        }
      );
      if(addResponse.addResults[0].success) {
        this.OBJECTID = addResponse.addResults[0].objectId;
        if("GLOBALID" in this) {
          return { objectId: this.OBJECTID, success: addResponse.addResults[0].success, globalId: this.GLOBALID as string }
        } else {
          return addResponse.addResults[0];
        }
      } else {
        throw new Error("Error adding item");
      }
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist PUT error"};
    }
  }

}

export default WqimsChecklist;