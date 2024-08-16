import { IFeature, queryRelated, queryFeatures, IQueryRelatedResponse, IRelatedRecordGroup } from "@esri/arcgis-rest-feature-service";
import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";
import { WqimsGroup } from "./WqimsGroup";
import { WqimsUser } from "./WqimsUser";

class WqimsAlerts extends WqimsObject {
  GLOBALID: string | null;
  SAMPLENUM: string;
  LOCATION: string;
  LOCCODE: string;
  COLLECTDATE: string;
  SAMPLECOLLECTOR: string;
  ACODE: string;
  ANALYTE: string;
  ANALYSEDDATE: string;
  ANALYSEDBY: string;
  DATEVALIDATED: string;
  VALIDATEDBY: string;
  GEOCODEMATCHEDADDRESS: string;
  RESULT: string;
  WARNING_STATUS: string;
  STATUS: string;
  COMMENTS: string;
  ACK_TIME: string;
  ACK_BY: string;
  CLOSED_TIME: string;
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
    COLLECTDATE: string,
    SAMPLECOLLECTOR: string,
    ACODE: string,
    ANALYSEDDATE: string,
    ANALYSEDBY: string,
    DATEVALIDATED: string,
    VALIDATEDBY: string,
    GEOCODEMATCHEDADDRESS: string,
    RESULT: string,
    LOCCODE: string,
    WARNING_STATUS: string,
    ANALYTE: string,
    STATUS: string,
    COMMENTS: string,
    ACK_TIME: string,
    ACK_BY: string,
    CLOSED_TIME: string,
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
    COLLECTDATE?: string,
    SAMPLECOLLECTOR?: string,
    ACODE?: string,
    ANALYSEDDATE?: string,
    ANALYSEDBY?: string,
    DATEVALIDATED?: string,
    VALIDATEDBY?: string,
    GEOCODEMATCHEDADDRESS?: string,
    RESULT?: string,
    LOCCODE?: string,
    WARNING_STATUS?: string,
    ANALYTE?: string,
    STATUS?: string,
    COMMENTS?: string,
    ACK_TIME?: string,
    ACK_BY?: string,
    CLOSED_TIME?: string,
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
      this.COLLECTDATE = COLLECTDATE ? COLLECTDATE : "";
      this.SAMPLECOLLECTOR = SAMPLECOLLECTOR ? SAMPLECOLLECTOR : "";
      this.ACODE = ACODE ? ACODE : "";
      this.ANALYSEDDATE = ANALYSEDDATE ? ANALYSEDDATE : "";
      this.ANALYSEDBY = ANALYSEDBY ? ANALYSEDBY : "";
      this.DATEVALIDATED = DATEVALIDATED ? DATEVALIDATED : "";
      this.VALIDATEDBY = VALIDATEDBY ? VALIDATEDBY : "";
      this.GEOCODEMATCHEDADDRESS = GEOCODEMATCHEDADDRESS ? GEOCODEMATCHEDADDRESS : "";
      this.RESULT = RESULT ? RESULT : "";
      this.LOCCODE = LOCCODE ? LOCCODE : "";
      this.WARNING_STATUS = WARNING_STATUS ? WARNING_STATUS : "";
      this.ANALYTE = ANALYTE ? ANALYTE : "";
      this.STATUS = STATUS ? STATUS : "";
      this.COMMENTS = COMMENTS ? COMMENTS : "";
      this.ACK_TIME = ACK_TIME ? ACK_TIME : "";
      this.ACK_BY = ACK_BY ? ACK_BY : "";
      this.CLOSED_TIME = CLOSED_TIME ? CLOSED_TIME : "";
      this.CLOSED_BY = CLOSED_BY ? CLOSED_BY : "";
      this.THRESHOLD_ID = THRESHOLD_ID ? THRESHOLD_ID : null;
      this.TEMPLATE_ID = TEMPLATE_ID ? TEMPLATE_ID : null;
      this.RESULT_ID = RESULT_ID ? RESULT_ID : null;
    }
  }

  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.alerts}`;

  async getUserAlerts(userId: number) {
    const userGroupsResponse: IQueryRelatedResponse = await queryRelated({
      url: WqimsUser.featureUrl,
      outFields: ["OBJECTID"],
      objectIds: [userId],
      relationshipId: 1,
    });

    if ("relatedRecordGroups" in userGroupsResponse) {
      const userAlertQueryResponse = userGroupsResponse.relatedRecordGroups.map(
        (relatedRecordGroup: IRelatedRecordGroup) => {
          if (
            "relatedRecords" in relatedRecordGroup &&
            relatedRecordGroup.relatedRecords &&
            relatedRecordGroup.relatedRecords.length > 0
          ) {
            const thresholdGroupsResponse = queryRelated({
              url: WqimsGroup.featureUrl,
              outFields: "*",
              objectIds: relatedRecordGroup.relatedRecords.map((feature: IFeature) => feature.attributes.OBJECTID),
            });

              /*const alertsQuery = queryFeatures({

              });*/
          }
        }
      );
    } else {
      throw new Error("Error getting data");
    }
  }
}
