import { addFeatures, IFeature, queryFeatures } from "@esri/arcgis-rest-feature-service";
import { gisCredentialManager } from "../routes/auth";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { appLogger } from "../util/appLogger";

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
    static relationshipUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.templates_items_rel_id}`;

    set globalId(value: string | null) {
        this.GLOBALID = value;
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
}

export default WqimsChecklist;