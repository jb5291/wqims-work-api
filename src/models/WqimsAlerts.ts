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
  COLLECTDATE: string;
  SAMPLECOLLECTOR: string;
  ACODE: string;
  ANALYSEDDATE: string;
  ANALYSEDBY: string;
  ADDR1: string;
  ADDR5: string;
  GEOCODEMATCHEDADDRESS: string;
  RESULT: string;
  LOCOCODE: string;
  WARNING_STATUS: string;
  ANALYTE: string;
  STATUS: string;
  COMMENTS: string;
  ACTIVE: number | undefined;
  THRESHOLD_ID: string | null;
  TEMPLATE_ID: string | null;

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
    ADDR1: string,
    ADDR5: string,
    GEOCODEMATCHEDADDRESS: string,
    RESULT: string,
    LOCOCODE: string,
    WARNING_STATUS: string,
    ANALYTE: string,
    STATUS: string,
    COMMENTS: string,
    ACTIVE: number | undefined,
    THRESHOLD_ID: string | null,
    TEMPLATE_ID: string | null
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
    ADDR1?: string,
    ADDR5?: string,
    GEOCODEMATCHEDADDRESS?: string,
    RESULT?: string,
    LOCOCODE?: string,
    WARNING_STATUS?: string,
    ANALYTE?: string,
    STATUS?: string,
    COMMENTS?: string,
    ACTIVE?: number | undefined,
    THRESHOLD_ID?: string | null,
    TEMPLATE_ID?: string | null
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
      this.ADDR1 = body.ADDR1;
      this.ADDR5 = body.ADDR5;
      this.GEOCODEMATCHEDADDRESS = body.GEOCODEMATCHEDADDRESS;
      this.RESULT = body.RESULT;
      this.LOCOCODE = body.LOCOCODE;
      this.WARNING_STATUS = body.WARNING_STATUS;
      this.ANALYTE = body.ANALYTE;
      this.STATUS = body.STATUS;
      this.COMMENTS = body.COMMENTS;
      this.THRESHOLD_ID = body.THRESHOLD_ID;
      this.TEMPLATE_ID = body.TEMPLATE_ID;
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
      this.ADDR1 = ADDR1 ? ADDR1 : "";
      this.ADDR5 = ADDR5 ? ADDR5 : "";
      this.GEOCODEMATCHEDADDRESS = GEOCODEMATCHEDADDRESS ? GEOCODEMATCHEDADDRESS : "";
      this.RESULT = RESULT ? RESULT : "";
      this.LOCOCODE = LOCOCODE ? LOCOCODE : "";
      this.WARNING_STATUS = WARNING_STATUS ? WARNING_STATUS : "";
      this.ANALYTE = ANALYTE ? ANALYTE : "";
      this.STATUS = STATUS ? STATUS : "";
      this.COMMENTS = COMMENTS ? COMMENTS : "";
      this.THRESHOLD_ID = THRESHOLD_ID ? THRESHOLD_ID : null;
      this.TEMPLATE_ID = TEMPLATE_ID ? TEMPLATE_ID : null;
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
