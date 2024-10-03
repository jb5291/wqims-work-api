import { addFeatures, deleteFeatures, IEditFeatureResult, IFeature, IQueryRelatedOptions, IQueryRelatedResponse, IQueryResponse, queryFeatures, queryRelated, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { gisCredentialManager } from "../routes/auth";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { appLogger } from "../util/appLogger";
import { v4 as uuidv4 } from "uuid";

export interface IChecklistItem {
  DESCRIPTION: string;
  ORDER_: number;
  CREATED_AT: number | null;
  UPDATED_AT: number | null;
  STATUS: string;
  COMPLETED_BY: string | null;
  COMPLETED_AT: number | null;
  GLOBALID: string | null;
  TEMPLATE_ID: string | null;
}

/**
 * Class representing a WqimsChecklist.
 * @extends WqimsObject
 */
class WqimsChecklist extends WqimsObject {
  GLOBALID!: string | null;
  TEMPLATE_NAME!: string;
  CREATED_AT!: number;
  UPDATED_AT!: number;
  items!: IChecklistItem[];

    constructor(body: Request["body"] | null, ...args: any[]) {
        super(body?.OBJECTID, body?.ACTIVE);
        Object.assign(this, body || {});
        if (!body) {
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

    /**
   * Retrieves active features, all features for checklists and checklist items.
   * @returns A promise that resolves to an array of active features.
   * @throws Will throw an error if the query fails.
   */
  static async getActiveFeatures(): Promise<IFeature[]> {
    try {
      const response = await queryFeatures({
        url: this.featureUrl,
        where: "1=1",
        outFields: "*",
        authentication: gisCredentialManager,
      });
      if ("features" in response) {
        const itemsResponse = await queryFeatures({
          url: this.itemFeaturesUrl,
          where: "1=1",
          outFields: "*",
          authentication: gisCredentialManager,
        })
        if ("features" in itemsResponse) {
          response.features.map(template => template.attributes as WqimsChecklist).forEach(feature => {
            feature.items = itemsResponse.features.map(item => item.attributes as IChecklistItem).filter(item => item.TEMPLATE_ID?.toUpperCase() === feature.GLOBALID?.toUpperCase());
          });
          return response.features;
        }
      } 
      throw new Error("Error getting data");
    } catch (error) {
        appLogger.error("User GET Error:", error instanceof Error ? error.stack : "unknown error");
        throw { error: error instanceof Error ? error.message : "unknown error", message: "User GET error" };
    }
  }

  static async removeRelationshipFromTemplate(templateId: number): Promise<IEditFeatureResult> {
    try {
      const response = await queryRelated({
        url: WqimsChecklist.featureUrl,
        relationshipId: parseInt(authConfig.arcgis.layers.templates_items_rel_id),
        authentication: gisCredentialManager,
      }) as IQueryResponse;
      if (response.objectIds?.length) {
        const deleteResult = await deleteFeatures({url: WqimsChecklist.featureUrl, objectIds: response.objectIds, authentication: gisCredentialManager});
        return deleteResult.deleteResults[0];
      } else {
        return {objectId: -1, success: response.objectIds?.length === 0, error: {code: 999, description: response.objectIds?.length === 0 ? "No relationships found" : "Invalid relationship class URL"}};
      }
    } catch (error) {
      appLogger.error("Checklist POST Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist POST error"};
    }
  }

  static async deleteFeature(url: string, templateId: number): Promise<IEditFeatureResult> {
    try {
      const response: { deleteResults: IEditFeatureResult[]; } = await deleteFeatures({url: url, objectIds: [templateId], authentication: gisCredentialManager});
      return response.deleteResults[0];
    } catch (error) {
      appLogger.error("Checklist DELETE Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist DELETE error"};
    }
  }

  static async getChecklistItems(templateId: number): Promise<IFeature[]> {
    try {
      const response = await queryRelated({
        url: WqimsChecklist.featureUrl,
        relationshipId: parseInt(authConfig.arcgis.layers.templates_items_rel_id),
        outFields: "*",
        objectIds: [templateId],
        authentication: gisCredentialManager,
      }) as IQueryRelatedResponse;
      if("relatedRecordGroups" in response && response.relatedRecordGroups?.length) {
        const relatedRecordGroups = response.relatedRecordGroups[0];
        if("relatedRecords" in relatedRecordGroups && relatedRecordGroups.relatedRecords?.length) {
          return relatedRecordGroups.relatedRecords;
        } else {
          return [];
        }
      } else {
        return [];
      }
    } catch (error) {
      appLogger.error("Checklist GET Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist GET error"};
    }
  }
  
  static async addTemplateFeature(templateName: string, creationTime: number): Promise<IEditFeatureResult> {
    try {
      const addResponse = await addFeatures({
        url: WqimsChecklist.featureUrl,
        features: [
          {
            attributes: {
              TEMPLATE_NAME: templateName,
              CREATED_AT: creationTime,
              UPDATED_AT: creationTime,
              GLOBALID: `{${uuidv4().toUpperCase()}}`
            }
          }
        ],
        authentication: gisCredentialManager,
      });
      return addResponse.addResults[0];
    } catch (error) {
      appLogger.error("Checklist POST Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist POST error"};
    }
  }

  /**
   * Updates a feature.
   * @returns A promise that resolves to the result of the update operation.
   */
  static async updateTemplateFeature(template: Partial<WqimsChecklist>): Promise<Partial<WqimsChecklist>> {
    try {
      const updateResponse = await updateFeatures({
        url: WqimsChecklist.featureUrl,
        features: [
          {
            attributes: template
          }
        ],
        authentication: gisCredentialManager,
      });
      if(updateResponse.updateResults[0].success) {
        return template;
      } else {
        throw new Error("Error updating template");
      }
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist PUT error"};
    }
  }

  static async updateItemFeatures(items: WqimsChecklist[]): Promise<WqimsChecklist[]> {
    try {
      const itemJson = items.map(item => { 
        const { ACTIVE, featureUrl, ...itemJson } = item;
        return itemJson;
      });
      const featureJson = itemJson.map(item => ({attributes: item}));
      const updateResponse = await updateFeatures({
        url: WqimsChecklist.itemFeaturesUrl,
        features: featureJson,
        authentication: gisCredentialManager,
      });
      if(updateResponse.updateResults.every(result => result.success)) {
        return items;
      } else {
        throw new Error("Error updating items");
      }
    } catch (error) {
      appLogger.error("Checklist PUT Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist PUT error"};
    }
  }

  static async addItemsToTemplate(items: WqimsChecklist[]): Promise<IEditFeatureResult[]> {
    try {
      const itemJson = items.map(item => { 
        const { ACTIVE, featureUrl, ...itemJson } = item;
        return itemJson;
      });
      const featureJson = itemJson.map(item => ({attributes: item}));
      const addResponse = await addFeatures({
        url: WqimsChecklist.itemFeaturesUrl,
        features: featureJson,
        authentication: gisCredentialManager,
      });
      return addResponse.addResults;
    } catch (error) {
      appLogger.error("Checklist POST Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist POST error"};
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
      const addResponse = await addFeatures({
        url: WqimsChecklist.itemFeaturesUrl,
        features: [{ attributes: objectWithoutOID }],
        authentication: gisCredentialManager,
      });
  
      this.OBJECTID = addResponse.addResults[0].objectId;
      if("GLOBALID" in this) {
        return { objectId: this.OBJECTID, success: addResponse.addResults[0].success, globalId: this.GLOBALID as string }
      } else {
        return addResponse.addResults[0];
      }
    } catch (error) {
      appLogger.error("Checklist POST Error:", error instanceof Error ? error.stack : "unknown error");
      throw {error: error instanceof Error ? error.message : "unknown error", message: "Checklist POST error"};
    }
  }

}

export default WqimsChecklist;