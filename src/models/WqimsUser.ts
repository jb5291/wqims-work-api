import { WqimsObject } from "./Wqims";
import {
  addFeatures,
  IEditFeatureResult,
  IFeature,
  IRelatedRecordGroup,
  queryFeatures,
  queryRelated,
  updateFeatures,
} from "@esri/arcgis-rest-feature-service";
import { authConfig } from "../util/secrets";
import { gisCredentialManager } from "../routes/auth";
import { Request } from "express";
import axios from "axios";

type WqimsRole = {
  OBJECTID: number;
  ROLE: string;
  ADD_USER: number;
  EDIT_USER: number;
  DELETE_USER: number;
  ASSIGN_USER_ROLE: number;
  ADD_THRESHOLD: number;
  EDIT_THRESHOLD: number;
  DELETE_THRESHOLD: number;
  ADD_GROUP: number;
  ADD_GROUP_USER: number;
  ADD_GROUP_THRESHOLD: number;
  EDIT_GROUP: number;
  REMOVE_GROUP_USER: number;
  REMOVE_GROUP: number;
  REVIEW_ALERTS: number;
  ACKNOWLEDGE_ALERTS: number;
  GLOBALID: string;
};

class WqimsUser extends WqimsObject {
  body: Request["body"] | null;
  NAME: string;
  DEPARTMENT: string;
  POSITION: string;
  DIVISION: string;
  PHONENUMBER: string;
  EMAIL: string;
  ROLE: string;
  RAPIDRESPONSETEAM: number;
  SECONDARYPHONENUMBER: string;
  STARTTIME: string;
  ENDTIME: string;
  GLOBALID: string | null;

  constructor(body: Request["body"]);

  constructor(
    body: Request["body"] | null,
    NAME: string,
    DEPARTMENT: string,
    POSITION: string,
    DIVISION: string,
    PHONENUMBER: string,
    EMAIL: string,
    ROLE: string,
    RAPIDRESPONSETEAM: number,
    SECONDARYPHONENUMBER: string,
    STARTTIME: string,
    ENDTIME: string,
    ACTIVE: number | undefined,
    GLOBALID: string | null,
    OBJECTID: number | undefined
  );

  constructor(
    body: Request["body"] | null,
    NAME?: string,
    DEPARTMENT?: string,
    POSITION?: string,
    DIVISION?: string,
    PHONENUMBER?: string,
    EMAIL?: string,
    ROLE?: string,
    RAPIDRESPONSETEAM?: number,
    SECONDARYPHONENUMBER?: string,
    STARTTIME?: string,
    ENDTIME?: string,
    ACTIVE?: number | undefined,
    GLOBALID?: string | null,
    OBJECTID?: number | undefined
  ) {
    if (body) {
      super(body.OBJECTID, body.ACTIVE);
      this.NAME = body.NAME;
      this.DEPARTMENT = body.DEPARTMENT;
      this.POSITION = body.POSITION;
      this.DIVISION = body.DIVISION;
      this.PHONENUMBER = body.PHONENUMBER;
      this.EMAIL = body.EMAIL;
      this.ROLE = body.ROLE;
      this.RAPIDRESPONSETEAM = body.RAPIDRESPONSETEAM;
      this.SECONDARYPHONENUMBER = body.SECONDARYPHONENUMBER;
      this.STARTTIME = body.STARTTIME;
      this.ENDTIME = body.ENDTIME;
      this.GLOBALID = body.GLOBALID;
    } else {
      super(OBJECTID, ACTIVE);
      this.NAME = !NAME ? "" : NAME;
      this.DEPARTMENT = !DEPARTMENT ? "" : DEPARTMENT;
      this.POSITION = !POSITION ? "" : POSITION;
      this.DIVISION = !DIVISION ? "" : DIVISION;
      this.PHONENUMBER = !PHONENUMBER ? "" : PHONENUMBER;
      this.EMAIL = !EMAIL ? "" : EMAIL;
      this.ROLE = !ROLE ? "" : ROLE;
      this.RAPIDRESPONSETEAM = !RAPIDRESPONSETEAM ? 0 : RAPIDRESPONSETEAM;
      this.SECONDARYPHONENUMBER = !SECONDARYPHONENUMBER ? "" : SECONDARYPHONENUMBER;
      this.STARTTIME = !STARTTIME ? "" : STARTTIME;
      this.ENDTIME = !ENDTIME ? "" : ENDTIME;
      this.GLOBALID = GLOBALID ? GLOBALID : null;
    }
  }

  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`;
  static groupsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;
  static rolesRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_roles}`;
  static rolesUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.roles}`;

  set globalId(value: string | null) {
    this.GLOBALID = value;
  }

  /**
   * Reactivates a feature by querying for inactive records and updating the active status.
   *
   * @returns {Promise<IEditFeatureResult>} The result of the feature update operation.
   */
  async checkInactive(): Promise<IEditFeatureResult> {
    const response = await queryFeatures({
      url: this.featureUrl,
      where: `ACTIVE=0 AND EMAIL='${this.EMAIL}'`,
      authentication: gisCredentialManager,
    });

    // need to make phone number nullable on the table side
    this.PHONENUMBER = this.PHONENUMBER ? this.PHONENUMBER : "none";
    
    if ("features" in response && response.features.length > 0) {
      this.GLOBALID = response.features[0].attributes.GLOBALID;
    }

    return await this.reactivateFeature(response);
  }

  /**
   * Retrieves all roles from the roles feature service.
   *
   * @returns {Promise<WqimsRole[]>} A promise that resolves to an array of WqimsRole objects.
   * @throws {Error} If no features are found in the response.
   */
  async getRoleIds(): Promise<WqimsRole[]> {
    const response = await queryFeatures({
      url: WqimsUser.rolesUrl,
      where: "1=1",
      outFields: "*",
      authentication: gisCredentialManager,
    });

    if ("features" in response) {
      return response.features.map((feature: IFeature) => feature.attributes as WqimsRole);
    } else {
      throw new Error("No features found");
    }
  }

  /**
   * Updates the role of a given user.
   *
   * @returns {Promise<IEditFeatureResult | undefined>} A promise that resolves to the result of the update operation.
   * @throws {Error} If the role is invalid or if no related records are found.
   */
  async updateUserRole(): Promise<IEditFeatureResult | undefined> {
    const objectId: number = this.OBJECTID || 0;
    const allowedRoles: string[] = ["Admin", "Editor", "Viewer"];
    if (!allowedRoles.includes(this.ROLE)) {
      return Promise.reject("Invalid role");
    }

    const response = await queryRelated({
      url: this.featureUrl,
      objectIds: [this.objectId],
      outFields: ["*"],
      relationshipId: 0,
      authentication: gisCredentialManager,
    });

    const roles: WqimsRole[] = await this.getRoleIds();
    const relatedRecordGroup: IRelatedRecordGroup = response.relatedRecordGroups?.[0];
    const relatedRecord: IFeature | undefined = relatedRecordGroup?.relatedRecords?.[0];

    // return early if no update is needed
    if (relatedRecord?.attributes.ROLE === this.ROLE.toLowerCase()) {
      return { objectId, success: true };
    }

    // need the RID in the relationship class table
    const userRolesQueryResponse = await queryFeatures({
      url: WqimsUser.rolesRelationshipClassUrl,
      where: `USER_ID='${this.GLOBALID}'`,
      outFields: "*",
      authentication: gisCredentialManager,
    });

    // update previous role if features exist
    if ("features" in userRolesQueryResponse && userRolesQueryResponse.features.length > 0) {
      const rid = userRolesQueryResponse.features?.[0]?.attributes.RID; // expect one
      if (!rid) {
        return Promise.reject("No related records found in related record group.");
      }
      const userRolesUpdateResponse = await updateFeatures({
        url: WqimsUser.rolesRelationshipClassUrl,
        features: [
          {
            attributes: {
              RID: rid,
              USER_ID: this.GLOBALID,
              ROLE_ID: roles.find((role: WqimsRole) => role.ROLE === this.ROLE.toLowerCase())?.GLOBALID,
            },
          },
        ],
        authentication: gisCredentialManager,
      });

      if (userRolesUpdateResponse.updateResults[0].success) {
        return userRolesUpdateResponse.updateResults[0];
      }
    } else {
      // create new role
      const roleAddResponse = await addFeatures({
        url: WqimsUser.rolesRelationshipClassUrl,
        authentication: gisCredentialManager,
        features: [
          {
            attributes: {
              USER_ID: this.GLOBALID,
              ROLE_ID: roles.find((role: WqimsRole) => role.ROLE === this.ROLE.toLowerCase())?.GLOBALID,
            },
          },
        ],
      });
      if (roleAddResponse.addResults[0].success) {
        return roleAddResponse.addResults[0];
      }
      return Promise.reject(roleAddResponse.addResults[0]?.error?.description);
    }
  }

  async addEverbridgeContact() {
    const startHour = this.STARTTIME.includes('PM') ? parseInt(this.STARTTIME.split(':')[0]) + 12 : parseInt(this.STARTTIME.split(':')[0]);
    const startMinute = parseInt(this.STARTTIME.split(':')[1].split(' ')[0]);

    const endHour = this.ENDTIME.includes('PM') ? parseInt(this.ENDTIME.split(':')[0]) + 12 : parseInt(this.ENDTIME.split(':')[0]);
    const endMinute = parseInt(this.ENDTIME.split(':')[1].split(' ')[0]);

    // options for adding an eb contact
    // more info here: https://developers.everbridge.net/home/reference/ebs-create-contact
    const options = {
      method: 'POST',
      url: `${authConfig.everbridge.rest_url}/contacts/${authConfig.everbridge.organization_id}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Basic ' + Buffer.from(`${authConfig.everbridge.username}:${authConfig.everbridge.password}`).toString('base64')
      },
      data: {
        firstName: this.NAME.split(" ")[0],
        lastName: this.NAME.split(" ")[1],
        recordTypeId: parseInt(authConfig.everbridge.record_id),
        groupsName: ["GIS-TEST-Water-Quality-Alerts"],
        externalId: this.GLOBALID ? this.GLOBALID : "",
        paths: [
          {
            waitTime: 0,
            pathId: parseInt(authConfig.everbridge.sms_id),
            countryCode: "US",
            value:
              !this.PHONENUMBER || this.PHONENUMBER === "" || this.PHONENUMBER === "none"
                ? this.SECONDARYPHONENUMBER.replace(/\-/g, "")
                : this.PHONENUMBER.replace(/\-/g, ""),
            quietTimeFrames: [
              // would depend on hours of operation
              {
                name: "Hours of Operation M-F",
                days: [1, 2, 3, 4, 5],
                fromHour: endHour,
                fromMin: endMinute,
                toHour: startHour,
                toMin: startMinute,
              },
            ],
          },
          {
            waitTime: 0,
            pathId: parseInt(authConfig.everbridge.email_id),
            countryCode: "US",
            value: this.EMAIL,
          },
        ],
        timezoneId: "America/New_York",
      }
    };

    axios.request(options)
      .then(function (response) {
        console.log(response.data)
      })
      .catch(function (error) {
        console.error(error);
      })
  }

  async deleteEverbridgeContact() {
    const options = {
      url: `${authConfig.everbridge.rest_url}/contacts/${authConfig.everbridge.organization_id}/${this.GLOBALID}?idType=externalId`,
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: 'Basic ' + Buffer.from(`${authConfig.everbridge.username}:${authConfig.everbridge.password}`).toString('base64')
      },
    }

    axios.request(options)
      .then(function (response) {
        console.log(response.data)
      })
      .catch(function (error) {
        console.error(error);
      })
  }

  async updateEverbridgeContact() {
    const startHour = this.STARTTIME.includes('PM') ? parseInt(this.STARTTIME.split(':')[0]) + 12 : parseInt(this.STARTTIME.split(':')[0]);
    const startMinute = parseInt(this.STARTTIME.split(':')[1].split(' ')[0]);

    const endHour = this.ENDTIME.includes('PM') ? parseInt(this.ENDTIME.split(':')[0]) + 12 : parseInt(this.ENDTIME.split(':')[0]);
    const endMinute = parseInt(this.ENDTIME.split(':')[1].split(' ')[0]);

    const options = {
      method: 'PUT',
      url: `${authConfig.everbridge.rest_url}/contacts/${authConfig.everbridge.organization_id}/${this.GLOBALID}?idType=externalId`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Basic ' + Buffer.from(`${authConfig.everbridge.username}:${authConfig.everbridge.password}`).toString('base64')
      },
      data: {
        firstName: this.NAME.split(" ")[0],
        lastName: this.NAME.split(" ")[1],
        recordTypeId: parseInt(authConfig.everbridge.record_id),
        groupsName: ["GIS-TEST-Water-Quality-Alerts"],
        paths: [
          {
            waitTime: 0,
            pathId: parseInt(authConfig.everbridge.sms_id),
            countryCode: "US",
            value:
              !this.PHONENUMBER || this.PHONENUMBER === ""
                ? this.SECONDARYPHONENUMBER.replace(/\-/g, "")
                : this.PHONENUMBER.replace(/\-/g, ""),
            quietTimeFrames: [
              {
                name: "Hours of Operation M-F",
                days: [1, 2, 3, 4, 5],
                fromHour: endHour,
                fromMin: endMinute,
                toHour: startHour,
                toMin: startMinute,
              },
            ],
          },
          {
            waitTime: 0,
            pathId: parseInt(authConfig.everbridge.email_id),
            countryCode: "US",
            value: this.EMAIL,
          },
        ],
        timezoneId: "America/New_York",
      }
    };

    axios.request(options)
      .then(function (response) {
        console.log(response.data)
      })
      .catch(function (error) {
        console.error(error);
      })
  }
}

export { WqimsUser };
