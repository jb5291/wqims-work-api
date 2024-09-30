import { authConfig } from "../util/secrets";
import { WqimsObject } from "./Wqims";
import { Request } from "express";

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
            ] = args;
        }
        this.featureUrl = WqimsChecklist.featureUrl;
    }

    // static featureUrl = `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.checklists}`;
}