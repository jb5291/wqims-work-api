import { IFeature, queryRelated, queryFeatures, IQueryRelatedResponse, IRelatedRecordGroup, IQueryFeaturesOptions, IQueryFeaturesResponse } from "@esri/arcgis-rest-feature-service";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { WqimsGroup } from "./WqimsGroup";
import { WqimsUser } from "./WqimsUser";
import { gisCredentialManager } from "../routes/auth";
import { appLogger } from "../util/appLogger";

class WqimsAlert  extends WqimsObject {
  GLOBALID: string | null;
  SAMPLENUM: string;
  LOCATION: string;
  LOCCODE: string;
  COLLECTDATE: number;
  SAMPLECOLLECTOR: string;
  ACODE: string;
  ANALYTE: string;
  ANALYSEDDATE: number;
  ANALYSEDBY: string;
  DATEVALIDATED: number;
  VALIDATEDBY: string;
  GEOCODEMATCHEDADDRESS: string;
  RESULT: string;
  WARNING_STATUS: string;
  STATUS: string;
  COMMENTS: string;
  ACK_TIME: number;
  ACK_BY: string;
  CLOSED_TIME: number;
  CLOSED_BY: string;
  THRESHOLD_ID: string | null;
  TEMPLATE_ID: string | null;
  RESULT_ID: string | null;
  ACTIVE!: number;

  constructor(body: Request["body"] | null);
  constructor(
    body: Request["body"] | null,
    OBJECTID: number | undefined,
    GLOBALID: string | null,
    SAMPLENUM: string,
    LOCATION: string,
    COLLECTDATE: number,
    SAMPLECOLLECTOR: string,
    ACODE: string,
    ANALYSEDDATE: number,
    ANALYSEDBY: string,
    DATEVALIDATED: number,
    VALIDATEDBY: string,
    GEOCODEMATCHEDADDRESS: string,
    RESULT: string,
    LOCCODE: string,
    WARNING_STATUS: string,
    ANALYTE: string,
    STATUS: string,
    COMMENTS: string,
    ACK_TIME: number,
    ACK_BY: string,
    CLOSED_TIME: number,
    CLOSED_BY: string,
    THRESHOLD_ID: string | null,
    TEMPLATE_ID: string | null,
    RESULT_ID: string | null,
    ACTIVE: number
  );

  constructor(
    body: Request["body"] | null,
    OBJECTID?: number | undefined,
    GLOBALID?: string | null,
    SAMPLENUM?: string,
    LOCATION?: string,
    COLLECTDATE?: number,
    SAMPLECOLLECTOR?: string,
    ACODE?: string,
    ANALYSEDDATE?: number,
    ANALYSEDBY?: string,
    DATEVALIDATED?: number,
    VALIDATEDBY?: string,
    GEOCODEMATCHEDADDRESS?: string,
    RESULT?: string,
    LOCCODE?: string,
    WARNING_STATUS?: string,
    ANALYTE?: string,
    STATUS?: string,
    COMMENTS?: string,
    ACK_TIME?: number,
    ACK_BY?: string,
    CLOSED_TIME?: number,
    CLOSED_BY?: string,
    THRESHOLD_ID?: string | null,
    TEMPLATE_ID?: string | null,
    RESULT_ID?: string | null,
    ACTIVE?: number
  ) {
    if (body) {
      super(body.OBJECTID, body.ACTIVE);
      this.GLOBALID = body.GLOBALID;
      this.SAMPLENUM = body.SAMPLENUM;
      this.LOCATION = body.LOCATION;
      this.COLLECTDATE = body.COLLECTDATE;
      this.SAMPLECOLLECTOR = body.SAMPLECOLLECTOR;
      this.ACODE = body.ACODE;
      this.ANALYSEDDATE = body.ANALYSEDDATE;
      this.ANALYSEDBY = body.ANALYSEDBY;
      this.DATEVALIDATED = body.DATEVALIDATED;
      this.VALIDATEDBY = body.VALIDATEDBY;
      this.GEOCODEMATCHEDADDRESS = body.GEOCODEMATCHEDADDRESS;
      this.RESULT = body.RESULT;
      this.LOCCODE = body.LOCCODE;
      this.WARNING_STATUS = body.WARNING_STATUS;
      this.ANALYTE = body.ANALYTE;
      this.STATUS = body.STATUS;
      this.COMMENTS = body.COMMENTS;
      this.ACK_TIME = body.ACK_TIME;
      this.ACK_BY = body.ACK_BY;
      this.CLOSED_TIME = body.CLOSED_TIME;
      this.CLOSED_BY = body.CLOSED_BY;
      this.THRESHOLD_ID = body.THRESHOLD_ID;
      this.TEMPLATE_ID = body.TEMPLATE_ID;
      this.RESULT_ID = body.RESULT_ID;
    } else {
      super(OBJECTID, ACTIVE);
      this.GLOBALID = GLOBALID ? GLOBALID : null;
      this.SAMPLENUM = SAMPLENUM ? SAMPLENUM : "";
      this.LOCATION = LOCATION ? LOCATION : "";
      this.COLLECTDATE = COLLECTDATE ? COLLECTDATE : 0;
      this.SAMPLECOLLECTOR = SAMPLECOLLECTOR ? SAMPLECOLLECTOR : "";
      this.ACODE = ACODE ? ACODE : "";
      this.ANALYSEDDATE = ANALYSEDDATE ? ANALYSEDDATE : 0;
      this.ANALYSEDBY = ANALYSEDBY ? ANALYSEDBY : "";
      this.DATEVALIDATED = DATEVALIDATED ? DATEVALIDATED : 0;
      this.VALIDATEDBY = VALIDATEDBY ? VALIDATEDBY : "";
      this.GEOCODEMATCHEDADDRESS = GEOCODEMATCHEDADDRESS ? GEOCODEMATCHEDADDRESS : "";
      this.RESULT = RESULT ? RESULT : "";
      this.LOCCODE = LOCCODE ? LOCCODE : "";
      this.WARNING_STATUS = WARNING_STATUS ? WARNING_STATUS : "";
      this.ANALYTE = ANALYTE ? ANALYTE : "";
      this.STATUS = STATUS ? STATUS : "";
      this.COMMENTS = COMMENTS ? COMMENTS : "";
      this.ACK_TIME = ACK_TIME ? ACK_TIME : 0;
      this.ACK_BY = ACK_BY ? ACK_BY : "";
      this.CLOSED_TIME = CLOSED_TIME ? CLOSED_TIME : 0;
      this.CLOSED_BY = CLOSED_BY ? CLOSED_BY : "";
      this.THRESHOLD_ID = THRESHOLD_ID ? THRESHOLD_ID : null;
      this.TEMPLATE_ID = TEMPLATE_ID ? TEMPLATE_ID : null;
      this.RESULT_ID = RESULT_ID ? RESULT_ID : null;
    }
  }

  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.alerts}`;

  static async getActiveFeatures(): Promise<IFeature[]> {
    try {
      const response = await queryFeatures({
        url: this.featureUrl,
        where: "ACTIVE=1",
        outFields: "*",
        returnGeometry: false,
        authentication: gisCredentialManager,
      });

      if ("features" in response) {
        return response.features;
      } else {
        throw new Error("Error getting data");
      }
    } catch (error) {
      const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("User GET Error:", stack);
      throw {
        error: error instanceof Error ? error.message : "unknown error",
        message: "User GET error",
      };
    }
  }

  static async getUserAlerts(userId: number): Promise<IFeature[]> {
    const thresholdGlobalIDs: number[] = [];
    const userGroupsResponse: IQueryRelatedResponse = await queryRelated({
      url: WqimsUser.featureUrl,
      outFields: ["OBJECTID"],
      objectIds: [userId],
      relationshipId: 1,
      authentication: gisCredentialManager,
    });

    // assume one record group per user
    if ("relatedRecordGroups" in userGroupsResponse && 
      userGroupsResponse.relatedRecordGroups.length===0 ||
      ("relatedRecords" in userGroupsResponse.relatedRecordGroups[0] && 
        userGroupsResponse.relatedRecordGroups[0].relatedRecords &&
        userGroupsResponse.relatedRecordGroups[0].relatedRecords.length===0)
      ) {
      return [];
    }

    const groupObjectIds = userGroupsResponse.relatedRecordGroups[0].relatedRecords?.map((feature: IFeature) => feature.attributes.OBJECTID);

    const groupThresholdsResponse = await queryRelated({
      url: WqimsGroup.featureUrl,
      outFields: ["GLOBALID"],
      objectIds: groupObjectIds,
      relationshipId: 2,
      authentication: gisCredentialManager,
    });
    
    if ("relatedRecordGroups" in groupThresholdsResponse && 
      groupThresholdsResponse.relatedRecordGroups.length > 0) {
      groupThresholdsResponse.relatedRecordGroups.forEach((group) => {
        if ("relatedRecords" in group && group.relatedRecords) {
          group.relatedRecords.forEach((feature: IFeature) => {
            thresholdGlobalIDs.push(feature.attributes.GLOBALID);
          });
        }
      });
    }
    if (thresholdGlobalIDs.length === 0) {
      return [];
    }
    const alertsResponse = await queryFeatures({
      url: this.featureUrl,
      outFields: "*",
      returnGeometry: false,
      where: `THRESHOLD_ID IN (${thresholdGlobalIDs.map((id) => `'${id}'`).join(",")})`,
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;
    return alertsResponse.features;
  }

  async acknowledgeAlert(userId: number) {
    try {
      const userResponse = await queryFeatures({
        url: WqimsUser.featureUrl,
        outFields: ["NAME"],
        where: `OBJECTID=${userId}`,
        returnGeometry: false,
        authentication: gisCredentialManager,
      });

      if(!("features" in userResponse) || userResponse.features.length === 0) {
        throw new Error("User not found");
      }

      this.ACK_TIME = new Date().getTime();
      this.ACK_BY = userResponse.features[0].attributes.NAME;
      this.STATUS = "Acknowledged";
      this.ACTIVE = 1;

      const response = await this.updateFeature();

      return response;
    } catch (error) {
      const stack: string | undefined = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("Alert Acknowledge Error:", stack);
      throw {
        error: error instanceof Error ? error.message : "unknown error",
        message: "Alert Acknowledge error",
      };
    }
  }
}

export { WqimsAlert }