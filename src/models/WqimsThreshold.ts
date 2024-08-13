import {WqimsObject} from "./Wqims";
import {Request} from "express";
import {authConfig} from "../util/secrets";
import {
    deleteFeatures,
    IEditFeatureResult,
    IQueryFeaturesResponse,
    IQueryResponse, queryFeatures,
    updateFeatures
} from "@esri/arcgis-rest-feature-service";
import {gisCredentialManager} from "../routes/auth";

class WqimsThreshold extends WqimsObject {
    GLOBALID: string | null;
    LOCATION_CODE: string;
    LOCATION_NAME: string;
    PROJECT_NAME: string;
    ANALYSIS: string;
    ANALYTE: string;
    UPPER_LOWER_SPECS: string;
    SPECS_VALUE: string;
    ACKTIMEOUT: number;
    CLOSEOUTTIMEOUT: number;
    TEMPLATE_ID: string;
    SYSTEM: string;
    UNIT: string;

    constructor(body: Request["body"] | null);

    constructor(
        body: Request["body"] | null,
        LOCATION_CODE: string,
        LOCATION_NAME: string,
        PROJECT_NAME: string,
        ANALYSIS: string,
        ANALYTE: string,
        UPPER_LOWER_SPECS: string,
        SPECS_VALUE: string,
        ACKTIMEOUT: number,
        CLOSEOUTTIMEOUT: number,
        TEMPLATE_ID: string,
        SYSTEM: string,
        ACTIVE: number | undefined,
        UNIT: string,
        OBJECTID: number | undefined,
        GLOBALID: string | null,
    );

    constructor(
        body: Request["body"] | null,
        LOCATION_CODE?: string,
        LOCATION_NAME?: string,
        PROJECT_NAME?: string,
        ANALYSIS?: string,
        ANALYTE?: string,
        UPPER_LOWER_SPECS?: string,
        SPECS_VALUE?: string,
        ACKTIMEOUT?: number,
        CLOSEOUTTIMEOUT?: number,
        TEMPLATE_ID?: string,
        SYSTEM?: string,
        ACTIVE?: number | undefined,
        UNIT?: string,
        OBJECTID?: number | undefined,
        GLOBALID?: string | null,
    ) {
        if(body) {
            super(body.OBJECTID, body.ACTIVE);
            this.LOCATION_CODE = body.LOCATION_CODE;
            this.LOCATION_NAME = body.LOCATION_NAME;
            this.PROJECT_NAME = body.PROJECT_NAME;
            this.ANALYSIS = body.ANALYSIS;
            this.ANALYTE = body.ANALYTE;
            this.UPPER_LOWER_SPECS = body.UPPER_LOWER_SPECS;
            this.SPECS_VALUE = body.SPECS_VALUE;
            this.ACKTIMEOUT = body.ACKTIMEOUT;
            this.CLOSEOUTTIMEOUT = body.CLOSEOUTTIMEOUT;
            this.TEMPLATE_ID = body.TEMPLATE_ID;
            this.SYSTEM = body.SYSTEM;
            this.UNIT = body.UNIT;
            this.GLOBALID = body.GLOBALID;
        } else {
            super(OBJECTID, ACTIVE);
            this.LOCATION_CODE = LOCATION_CODE ? LOCATION_CODE : "";
            this.LOCATION_NAME = LOCATION_NAME ? LOCATION_NAME : "";
            this.PROJECT_NAME = PROJECT_NAME ? PROJECT_NAME : "";
            this.ANALYSIS = ANALYSIS ? ANALYSIS : "";
            this.ANALYTE = ANALYTE ? ANALYTE : "";
            this.UPPER_LOWER_SPECS = UPPER_LOWER_SPECS ? UPPER_LOWER_SPECS : "";
            this.SPECS_VALUE = SPECS_VALUE ? SPECS_VALUE : "";
            this.ACKTIMEOUT = ACKTIMEOUT ? ACKTIMEOUT : 1;
            this.CLOSEOUTTIMEOUT = CLOSEOUTTIMEOUT ? CLOSEOUTTIMEOUT : 1;
            this.TEMPLATE_ID = TEMPLATE_ID ? TEMPLATE_ID : "";
            this.SYSTEM = SYSTEM ? SYSTEM : "";
            this.UNIT = UNIT ? UNIT : "";
            this.GLOBALID = GLOBALID ? GLOBALID : null;
        }
    }

    static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds}`;
    static groupsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds_groups}`;

    set globalId(value: string | null) {
        this.GLOBALID = value;
    }

    async checkInactive(): Promise<IEditFeatureResult> {
        const response = await queryFeatures({
            url: this.featureUrl,
            where: `ACTIVE=0 AND LOCATION_CODE='${this.LOCATION_CODE}' AND ANALYSIS='${this.ANALYSIS}'`,
            authentication: gisCredentialManager,
        })

        if ("features" in response && response.features.length > 0) {
            this.GLOBALID = response.features[0].attributes.GLOBALID;
        }

        return await this.reactivateFeature(response);
    }



    /*async deleteThresholdRelClassRecord(relClassUrl: string): Promise<IEditFeatureResult | undefined> {
        const response = await queryFeatures({
            url: relClassUrl,
            where: `THRSHLD_ID='${this.GLOBALID}'`,
            outFields: "*",
            authentication: gisCredentialManager,
        })
        if("features" in response && response.features.length > 0) {
            const rids = response.features.map((feature) => feature.attributes.RID);
            if (!rids || rids.length === 0) {
                return undefined;
            }

            const deleteResponse = await deleteFeatures({
                url: relClassUrl,
                objectIds: rids,
                authentication: gisCredentialManager,
            });

            if (deleteResponse.deleteResults.length > 0 && deleteResponse.deleteResults[0].success) {
                return deleteResponse.deleteResults[0];
            } else {
                throw new Error(deleteResponse.deleteResults[0].error?.description);
            }
        } else {
            return Promise.resolve({ objectId: this.OBJECTID as number, success: true })
        }
    }*/
 }

export { WqimsThreshold };