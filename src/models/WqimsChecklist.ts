import { addFeatures, deleteFeatures, IEditFeatureResult, IFeature, IQueryRelatedOptions, IQueryRelatedResponse, IQueryResponse, queryFeatures, queryRelated } from "@esri/arcgis-rest-feature-service";
import { gisCredentialManager } from "../routes/auth";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { appLogger } from "../util/appLogger";
import { v4 as uuidv4 } from "uuid";

/**
 * Class representing a WqimsChecklist.
 * @extends WqimsObject
 */
class WqimsChecklist extends WqimsObject {
    DESCRIPTION!: string;
    ORDER_!: number;
    CREATED_AT!: Date | null;
    UPDATED_AT!: Date | null;
    STATUS!: string;
    COMPLETED_BY!: string | null;
    COMPLETED_AT!: Date | null;
    GLOBALID!: string | null;
    TEMPLATE_ID!: string | null;

    constructor(body: Request["body"] | null, ...args: any[]) {
        super(body?.OBJECTID, body?.ACTIVE);
        Object.assign(this, body || {});
        if (!body) {
            [
                this.DESCRIPTION,
                this.ORDER_,
                this.CREATED_AT,
                this.UPDATED_AT,
                this.STATUS,
                this.COMPLETED_BY,
                this.COMPLETED_AT,
                this.GLOBALID,
                this.TEMPLATE_ID
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
      if ("features" in response) return response.features;
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
   * Adds a new feature.
   * @returns A promise that resolves to the result of the add operation.
   */
  async addItemFeature(): Promise<IEditFeatureResult> {
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
  }
}

export default WqimsChecklist;