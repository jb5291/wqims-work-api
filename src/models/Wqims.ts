import {
    addFeatures,
    IEditFeatureResult,
    IFeature,
    IQueryFeaturesResponse,
    IQueryResponse,
    queryFeatures, updateFeatures
} from "@esri/arcgis-rest-feature-service";
import {gisCredentialManager} from "../routes/auth";
import {appLogger} from "../util/appLogger";
import {v4 as uuidv4} from "uuid";

class WqimsObject {
    OBJECTID: number | undefined;
    ACTIVE: number | undefined;
    readonly featureUrl: string;

    constructor(OBJECTID: number | undefined, ACTIVE: number | undefined) {
        if(!OBJECTID) { throw new Error("OBJECTID is required"); }
        if(!ACTIVE) { ACTIVE = 0 }
        this.OBJECTID = OBJECTID;
        this.ACTIVE = ACTIVE;
        this.featureUrl = (this.constructor as typeof WqimsObject).featureUrl;
    }

    static featureUrl: string;

    static async getActiveFeatures(): Promise<IFeature[]> {
        try {
            const response: IQueryFeaturesResponse | IQueryResponse = await queryFeatures({
                url: this.featureUrl,
                where: "ACTIVE=1",
                outFields: "*",
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

    set active(value: number | undefined) {
        this.ACTIVE = value;
    }

    set objectId(value: number | undefined) {
        this.OBJECTID = value;
    }

    get objectId(): number {
        return this.OBJECTID ? this.OBJECTID : 0;
    }

    /**
     * Adds a feature.
     * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the add operation.
     */
    async addFeature(): Promise<IEditFeatureResult> {
        if ("GLOBALID" in this) {
            this.GLOBALID = `{${uuidv4().toUpperCase()}}`;
        } else if ("GROUPID" in this) {
            this.GROUPID = `{${uuidv4().toUpperCase()}}`;
        }
        this.ACTIVE = 1;

        const { OBJECTID, ...objectWithoutOID } = this;
        const addResponse: {addResults: IEditFeatureResult[]} = await addFeatures({
            url: this.featureUrl,
            features: [{ attributes: objectWithoutOID }],
            authentication: gisCredentialManager,
        });

        this.OBJECTID = addResponse.addResults[0].objectId;
        return addResponse.addResults[0];
    }

    /**
     * Updates a feature.
     * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the update operation.
     */
    async updateFeature(): Promise<IEditFeatureResult> {
        const response: {updateResults: IEditFeatureResult[]} = await updateFeatures({
            url: this.featureUrl,
            authentication: gisCredentialManager,
            features: [{ attributes: this }],
        });

        return response.updateResults[0] as IEditFeatureResult;
    }

    /**
     * Soft deletes a feature.
     * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the soft delete operation.
     */
    async softDeleteFeature(): Promise<IEditFeatureResult> {
        this.ACTIVE = 0;
        const { featureUrl, ...objectWithoutUrl } = this;
        const response: {updateResults: IEditFeatureResult[]} = await updateFeatures({
            url: this.featureUrl,
            features: [{ attributes: objectWithoutUrl }],
            authentication: gisCredentialManager,
        });
        return response.updateResults[0] as IEditFeatureResult;
    }

    /**
     * Reactivates a feature. Should only be called by checkInactive.
     * @param {IQueryFeaturesResponse | IQueryResponse} response - The response from the query.
     * @returns {Promise<IEditFeatureResult>} A promise that resolves to the result of the reactivation operation.
     */
    async reactivateFeature(response: IQueryFeaturesResponse | IQueryResponse): Promise<IEditFeatureResult> {
        if ("features" in response && response.features.length > 0) {
            const existingObject = response.features[0].attributes;
            this.objectId = existingObject.OBJECTID;
            this.active = 1;

            const updateResponse: { updateResults: IEditFeatureResult[] } = await updateFeatures({
                url: this.featureUrl,
                features: [{attributes: this}],
                authentication: gisCredentialManager,
            });

            return updateResponse.updateResults[0] as IEditFeatureResult;
        } else {
            return { objectId: -1, success: false, error: { code: 999, description: "No inactive record found" } };
        }
    }
}

export { WqimsObject }