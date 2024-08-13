import {WqimsObject} from "./Wqims";
import {
    addFeatures,
    IEditFeatureResult,
    IQueryFeaturesResponse,
    IQueryResponse,
    queryFeatures, updateFeatures
} from "@esri/arcgis-rest-feature-service";
import { Request } from "express";
import {gisCredentialManager} from "../routes/auth";
import {authConfig} from "../util/secrets";

class WqimsGroup extends WqimsObject {
    GROUPNAME: string;
    GROUPID: string | null;
    MEMBERIDS: string[];
    THRESHOLDIDS: string[];

    /**
     * Constructs a new WqimsGroup instance.
     *
     * @param {Request["body"]} body - The request body.
     */
    constructor(body: Request["body"] | null);

    /**
     * Constructs a new WqimsGroup instance.
     *
     * @param {Request["body"]} body - The request body.
     * @param {string} GROUPNAME - The group name.
     * @param {number | undefined} ACTIVE - The active status.
     * @param {string[]} MEMBERIDS - The member IDs.
     * @param {string[]} THRESHOLDIDS - The threshold IDs.
     * @param {number | undefined} OBJECTID - The object ID.
     * @param {string | null} GROUPID - The group ID.
     */
    constructor(
        body: Request["body"] | null,
        GROUPNAME: string,
        ACTIVE: number | undefined,
        MEMBERIDS: string[],
        THRESHOLDIDS: string[],
        OBJECTID: number | undefined,
        GROUPID: string | null,
    );

    /**
     * Constructs a new WqimsGroup instance.
     *
     * @param {Request["body"]} body - The request body.
     * @param {string} GROUPNAME - The group name.
     * @param {number | undefined} ACTIVE - The active status.
     * @param {string[]} MEMBERIDS - The member IDs.
     * @param {string[]} THRESHOLDIDS - The threshold IDs.
     * @param {number | undefined} OBJECTID - The object ID.
     * @param {string | null} GROUPID - The group ID.
     */
    constructor(
        body: Request["body"] | null,
        GROUPNAME?: string,
        ACTIVE?: number | undefined,
        MEMBERIDS?: string[],
        THRESHOLDIDS?: string[],
        OBJECTID?: number | undefined,
        GROUPID?: string | null,
    ) {
        super(OBJECTID, ACTIVE);
        if(body) {
            this.GROUPNAME = body.GROUPNAME;
            this.MEMBERIDS = body.MEMBERIDS;
            this.THRESHOLDIDS = body.THRESHOLDIDS;
            this.GROUPID = body.GROUPID;
        } else {
            this.GROUPNAME = !GROUPNAME ? "" : GROUPNAME;
            this.MEMBERIDS = !MEMBERIDS ? [] : MEMBERIDS;
            this.THRESHOLDIDS = !THRESHOLDIDS ? [] : THRESHOLDIDS;
            this.GROUPID = !GROUPID ? null : GROUPID;
        }
    }

    static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.groups}`;
    static usersRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users_groups}`;
    static thresholdsRelationshipClassUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds_groups}`;

    /**
     * Sets the group ID.
     *
     * @param {string | null} value - The group ID.
     */
    set groupId(value: string | null) {
        this.GROUPID = value;
    }

    /**
     * Reactivates a feature by querying for inactive records and updating the active status.
     *
     * @returns {Promise<IEditFeatureResult>} The result of the feature update operation.
     */
    async checkInactive(): Promise<IEditFeatureResult> {
        const response = await queryFeatures({
            url: this.featureUrl,
            where: `ACTIVE=0 AND GROUPNAME='${this.GROUPNAME}'`,
            authentication: gisCredentialManager,
        });

        if ("features" in response && response.features.length > 0) {
            this.GROUPID = response.features[0].attributes.GLOBALID;
        }

        return await this.reactivateFeature(response);
    }

    /**
     * Updates a feature.
     *
     * @returns {Promise<IEditFeatureResult>} The result of the update operation.
     */
    async updateFeature(): Promise<IEditFeatureResult> {
        const { MEMBERIDS, THRESHOLDIDS, ...groupWithoutItems } = this;

        const response = await updateFeatures({
            url: this.featureUrl,
            features: [{ attributes: groupWithoutItems }],
            authentication: gisCredentialManager,
        });

        return response.updateResults[0] as IEditFeatureResult;
    }

    /**
     * Soft deletes a feature by setting its active status to 0.
     *
     * @returns {Promise<IEditFeatureResult>} The result of the soft delete operation.
     */
    async softDeleteFeature(): Promise<IEditFeatureResult> {
        this.ACTIVE = 0;
        const { MEMBERIDS, THRESHOLDIDS, ...groupWithoutItems } = this;
        const response = await updateFeatures({
            url: this.featureUrl,
            features: [{ attributes: groupWithoutItems }],
            authentication: gisCredentialManager,
        });
        return response.updateResults[0] as IEditFeatureResult;
    }

    /**
     * Adds group items to a relationship class.
     *
     * @param {string} relClassUrl - The relationship class URL.
     * @returns {Promise<IEditFeatureResult>} The result of the add operation.
     */
    async addGroupItems(relClassUrl: string): Promise<IEditFeatureResult> {
        switch(relClassUrl) {
            case WqimsGroup.thresholdsRelationshipClassUrl:
                const addGroupThrshldResult = await addFeatures({
                    url: relClassUrl,
                    authentication: gisCredentialManager,
                    features: this.THRESHOLDIDS.map((id: string) => {
                        return {
                            attributes: {
                                GROUP_ID: this.GROUPID,
                                THRSHLD_ID: id
                            }
                        }
                    }),
                })

                return addGroupThrshldResult.addResults[0];
            case WqimsGroup.usersRelationshipClassUrl:
                const addGroupUserResult = await addFeatures({
                    url: relClassUrl,
                    authentication: gisCredentialManager,
                    features: this.MEMBERIDS.map((id: string) => {
                        return {
                            attributes: {
                                GROUP_ID: this.GROUPID,
                                USER_ID: id
                            }
                        }
                    }),
                })

                return addGroupUserResult.addResults[0];
            default:
                return { objectId: -1, success: false, error: { code: 999, description: "Invalid relationship class URL" } };
        }
    }

}

export { WqimsGroup };