import { WqimsObject } from "./Wqims";
import {
  addFeatures,
  deleteFeatures,
  IEditFeatureResult,
  IFeature, IQueryFeaturesResponse,
  IQueryResponse,
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

/**
 * Class representing a WqimsUser.
 * @extends WqimsObject
 */
class WqimsUser extends WqimsObject {
  NAME!: string;
  DEPARTMENT!: string;
  POSITION!: string;
  DIVISION!: string;
  PHONENUMBER!: string;
  EMAIL!: string;
  ROLE!: string;
  RAPIDRESPONSETEAM!: number;
  SECONDARYPHONENUMBER!: string;
  STARTTIME!: string;
  ENDTIME!: string;
  GLOBALID!: string | null;

  /**
   * Creates an instance of WqimsUser.
   * @param body - The request body.
   * @param args - Additional arguments.
   */
  constructor(body: Request["body"] | null, ...args: any[]) {
    super(body?.OBJECTID, body?.ACTIVE);
    Object.assign(this, body || {});
    if (!body) {
      [
        this.NAME,
        this.DEPARTMENT,
        this.POSITION,
        this.DIVISION,
        this.PHONENUMBER,
        this.EMAIL,
        this.ROLE,
        this.RAPIDRESPONSETEAM,
        this.SECONDARYPHONENUMBER,
        this.STARTTIME,
        this.ENDTIME,
        this.GLOBALID,
      ] = args;
    }
    this.featureUrl = WqimsUser.featureUrl;
  }

  /**
   * The URL of the feature service.
   */
  static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`;

  /**
   * The URL of the groups relationship class.
   */
  static groupsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;

  /**
   * The URL of the roles relationship class.
   */
  static rolesRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_roles}`;

  /**
   * The URL of the roles feature service.
   */
  static rolesUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.roles}`;

  /**
   * Sets the global ID.
   * @param value - The global ID.
   */
  set globalId(value: string | null) {
    this.GLOBALID = value;
  }

  /**
   * Reactivates a feature by querying for inactive records and updating the active status.
   * @returns {Promise<IEditFeatureResult>} The result of the feature update operation.
   */
  async checkInactive(): Promise<IEditFeatureResult> {
    const response = await queryFeatures({
      url: this.featureUrl,
      where: `ACTIVE=0 AND EMAIL='${this.EMAIL}'`,
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;

    this.PHONENUMBER = this.PHONENUMBER || "none";

    if (response.features?.length) {
      this.GLOBALID = response.features[0].attributes.GLOBALID;
    }

    return this.reactivateFeature(response);
  }

  /**
   * Retrieves all roles from the roles feature service.
   * @returns {Promise<WqimsRoles[]>}A promise that resolves to an array of WqimsRole objects.
   * @throws Will throw if no features are found in the response.
   */
  async getRoleIds(): Promise<WqimsRole[]> {
    const response = await queryFeatures({
      url: WqimsUser.rolesUrl,
      where: "1=1",
      outFields: "*",
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;

    if (response.features) {
      return response.features.map((feature: IFeature) => feature.attributes as WqimsRole);
    } else {
      throw new Error("No features found");
    }
  }

  /**
   * Updates the role of a given user.
   * @returns {Promise<IEditFeatureResult | undefined>} A promise that resolves to the result of the update operation.
   * @throws Will throw if the role is invalid or if no related records are found.
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
      relationshipId: parseInt(authConfig.arcgis.layers.userroles_rel_id),
      authentication: gisCredentialManager,
    });

    const roles: WqimsRole[] = await this.getRoleIds();
    const relatedRecordGroup: IRelatedRecordGroup = response.relatedRecordGroups?.[0];
    const relatedRecord: IFeature | undefined = relatedRecordGroup?.relatedRecords?.[0];

    if (relatedRecord?.attributes.ROLE === this.ROLE.toLowerCase()) {
      return { objectId, success: true };
    }

    const userRolesQueryResponse = await queryFeatures({
      url: WqimsUser.rolesRelationshipClassUrl,
      where: `USER_ID='${this.GLOBALID}'`,
      outFields: "*",
      authentication: gisCredentialManager,
    }) as IQueryFeaturesResponse;

    if (userRolesQueryResponse.features?.length) {
      const rid = userRolesQueryResponse.features[0].attributes.RID;
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

  /**
   * Removes relationship records from M2M tables
   * @param relClassUrl relationship class url
   * @returns {Promise<IEditFeatureResult | undefined>} A promise that resolves to the result of the remove relationship operation.
   */
  async removeRelationship(relClassUrl: string): Promise<IEditFeatureResult | undefined> {
    const queryRelResponse = await queryFeatures({
      url: relClassUrl,
      where: `USER_ID='${this.GLOBALID}'`,
      returnIdsOnly: true,
      authentication: gisCredentialManager,
    }) as IQueryResponse;

    if (queryRelResponse.objectIds?.length) {
      const deleteRelResponse = await deleteFeatures({
        url: relClassUrl,
        objectIds: queryRelResponse.objectIds,
        authentication: gisCredentialManager,
      });

      if (deleteRelResponse.deleteResults[0].success) {
        return deleteRelResponse.deleteResults[0];
      } else {
        return Promise.reject(deleteRelResponse.deleteResults[0]?.error?.description);
      }
    } else {
      return { objectId: this.OBJECTID || 0, success: true };
    }
  }

  /**
   * Adds a contact to Everbridge.
   */
  async addEverbridgeContact() {
    const { hour: startHour, minute: startMinute } = parseTime(this.STARTTIME);
    const { hour: endHour, minute: endMinute } = parseTime(this.ENDTIME);
    let options = {};

    this.PHONENUMBER = this.PHONENUMBER === "none" ? "" : this.PHONENUMBER;

    if (this.PHONENUMBER === "" && this.SECONDARYPHONENUMBER === "") {
      options = {
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
          externalId: this.GLOBALID || "",
          paths: [
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
    } else {
      options = {
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
          externalId: this.GLOBALID || "",
          paths: [
            {
              waitTime: 0,
              pathId: parseInt(authConfig.everbridge.sms_id),
              countryCode: "US",
              value: (this.PHONENUMBER || this.SECONDARYPHONENUMBER).replace(/-/g, ""),
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
    }

    axios.request(options)
        .then(response => console.log(response.data))
        .catch(error => console.error(error));
  }

  /**
   * Deletes a contact from Everbridge.
   */
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
        .then(response => console.log(response.data))
        .catch(error => console.error(error));
  }

  /**
   * Updates a contact in Everbridge.
   */
  async updateEverbridgeContact() {
    const { hour: startHour, minute: startMinute } = parseTime(this.STARTTIME);
    const { hour: endHour, minute: endMinute } = parseTime(this.ENDTIME);

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
        externalId: this.GLOBALID || "",
        paths: [
          {
            waitTime: 0,
            pathId: parseInt(authConfig.everbridge.sms_id),
            countryCode: "US",
            value: (this.PHONENUMBER || this.SECONDARYPHONENUMBER).replace(/-/g, ""),
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
        .then(response => console.log(response.data))
        .catch(error => console.error(error));
  }
}

/**
 * Parses a time string and converts it to 24-hour format.
 * @param time - The time string to parse.
 * @returns {{ hour: number, minute: number}} An object containing the hour and minute in 24-hour format.
 */
function parseTime(time: string): { hour: number, minute: number } {
  time = time || '12:00 AM';
  const [timePart, period] = time.split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

export { WqimsUser };