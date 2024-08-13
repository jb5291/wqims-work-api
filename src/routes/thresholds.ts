import express from 'express';

import { appLogger } from '../util/appLogger';
import {WqimsThreshold} from "../models/WqimsThreshold";

const thresholdsRouter = express.Router();

/**
 * @swagger
 * components:
 *  schemas:
 *    AddThresholdData:
 *      type: object
 *      properties:
 *        LOCATION_CODE:
 *          type: string
 *        LOCATION_NAME:
 *          type: string
 *        PROJECT_NAME:
 *          type: string
 *        ANALYSIS:
 *          type: string
 *        ANALYTE:
 *          type: string
 *        UPPER_LOWER_SPECS:
 *          type: string
 *        SPECS_VALUE:
 *          type: string
 *        ACKTIMEOUT:
 *          type: number
 *        CLOSEOUTTIMEOUT:
 *          type: number
 *        TEMPLATE_ID:
 *          type: string
 *        SYSTEM:
 *          type: string
 *        ACTIVE:
 *          type: number
 *        UNIT:
 *          type: string
 *    ThresholdData:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        LOCATION_CODE:
 *          type: string
 *        LOCATION_NAME:
 *          type: string
 *        PROJECT_NAME:
 *          type: string
 *        ANALYSIS:
 *          type: string
 *        ANALYTE:
 *          type: string
 *        UPPER_LOWER_SPECS:
 *          type: string
 *        SPECS_VALUE:
 *          type: string
 *        ACKTIMEOUT:
 *          type: number
 *        CLOSEOUTTIMEOUT:
 *          type: number
 *        TEMPLATE_ID:
 *          type: string
 *        SYSTEM:
 *          type: string
 *        ACTIVE:
 *          type: number
 *        UNIT:
 *          type: string
 *    ArcGISEditFeatureResponse:
 *      type: object
 *      properties:
 *        addResults:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              objectId:
 *                type: number
 *              globalId:
 *                type: string
 *              success:
 *                type: boolean
 *              error:
 *                type: object
 *                properties:
 *                  code:
 *                    type: number
 *                  description:
 *                    type: string
 *    ArcGISGetThresholdsResponse:
 *      type: object
 *      properties:
 *        objectIdFieldName:
 *          type: string
 *        globalIdFieldName:
 *          type: string
 *        hasZ:
 *          type: boolean
 *        hasM:
 *          type: boolean
 *        fields:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              name:
 *                type: string
 *              alias:
 *                type: string
 *              type:
 *                type: string
 *              length:
 *                type: number
 *        features:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              attributes:
 *                type: schema
 *                $ref: '#/components/schemas/ThresholdData'
 */

/**
 * @swagger
 * /thresholds:
 *  get:
 *    summary: Get list of thresholds
 *    description: Gets a list of groups from AGOL thresholds table
 *    tags:
 *      - Thresholds
 *    responses:
 *      '200':
 *        description: A list of thresholds
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISGetThresholdsResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
thresholdsRouter.get("/", /* logRequest, verifyAndRefreshToken,*/ async (req, res) => {
  try {
    const getThresholdResult = await WqimsThreshold.getActiveFeatures();
    res.json(getThresholdResult);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User GET Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User GET error",
    });
  }
});

/**
 * @swagger
 * /thresholds:
 *  put:
 *    summary: Add a new threshold
 *    description: Adds a new threshold to AGOL threshold table
 *    tags:
 *      - Thresholds
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AddThresholdData'
 *    responses:
 *      '200':
 *        description: Threshold added successfully
 *        content:
 *          application/json:
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
thresholdsRouter.put("/", /* logRequest, verifyAndRefreshToken,*/ async (req, res) => {
    try {
        const threshold: WqimsThreshold = new WqimsThreshold(req.body);

        const updateResult = await threshold.checkInactive();
        if(!updateResult.success) {
            const thresholdAddResult = await threshold.addFeature();
            if (!thresholdAddResult?.success) throw new Error("Error adding threshold")
        }

        res.json(threshold);
    } catch (error) {
        const stack = error instanceof Error ? error.stack : "unknown error";
        appLogger.error("Threshold PUT Error:", stack);
        res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "Threshold PUT error",
        });
    }
});

/**
 * @swagger
 * /thresholds:
 *  post:
 *    summary: deactivates threshold from thresholds list
 *    description: deactivates a threshold
 *    tags:
 *      - Thresholds
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/ThresholdData'
 *    responses:
 *      '200':
 *        description: Threshold deactivated successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
thresholdsRouter.post("/", async (req, res) => {
    try {
        const threshold: WqimsThreshold = new WqimsThreshold(req.body);

        const updateResult = await threshold.softDeleteFeature();
        if(!updateResult.success) throw new Error("Error deactivating threshold");

        //const thresholdGroupEditResult = await threshold.deleteThresholdRelClassRecord(WqimsThreshold.groupsRelationshipClassUrl);
        //if(thresholdGroupEditResult && !thresholdGroupEditResult.success) throw new Error("Error deleting threshold group record");

        res.json(updateResult);
    } catch (error) {
        const stack = error instanceof Error ? error.stack : "unknown error";
        appLogger.error("User POST error:", stack);
        res.status(500).send({
            error: error instanceof Error ? error.message : "unknown error",
            message: "User POST error",
        });
    }
})

/**
 * @swagger
 * /thresholds:
 *  patch:
 *    summary: Update a threshold in thresholds table
 *    description: Updates a threshold in table based on the threshold provided in body
 *    tags:
 *      - Thresholds
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/ThresholdData'
 *    responses:
 *      '200':
 *        description: Threshold updated successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
thresholdsRouter.patch('/', async (req, res) => {
    try {
        const threshold: WqimsThreshold = new WqimsThreshold(req.body);

        const updateResult = await threshold.updateFeature();
        if (!updateResult?.success) {
            throw new Error(updateResult.error?.description || "Error updating threshold");
        }

        res.json(threshold);
    } catch (error) {
        const stack= error instanceof Error ? error.stack : "unknown error";
        appLogger.error("User PATCH error:", stack);
        res.status(500).send({
            error: error instanceof Error ? error.message : "unknown error",
            message: "User PATCH error",
        });
    }
})

export default thresholdsRouter;