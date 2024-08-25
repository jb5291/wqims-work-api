import express from "express";
import { appLogger } from "../util/appLogger";
import { WqimsThreshold } from "../models/WqimsThreshold";
import { logRequest, verifyAndRefreshToken } from "./auth";
import { IFeature } from "@esri/arcgis-rest-request";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";

const thresholdsRouter = express.Router();

/**
 * @swagger
 * components:
 *  schemas:
 *    AddThresholdData: // Schema for adding a new threshold
 *      type: object
 *      properties:
 *        LOCATION_CODE: { type: string } // Code of the location
 *        LOCATION_NAME: { type: string } // Name of the location
 *        PROJECT_NAME: { type: string } // Name of the project
 *        ANALYSIS: { type: string } // Analysis code being measured
 *        ANALYTE: { type: string } // Analyte being measured
 *        UPPER_LOWER_SPECS: { type: string } // Specifications for upper and lower limits
 *        SPECS_VALUE: { type: number } // Value of the specifications
 *        ACKTIMEOUT: { type: number } // Acknowledgment timeout
 *        CLOSEOUTTIMEOUT: { type: number } // Closeout timeout
 *        TEMPLATE_ID: { type: string } // ID of the template
 *        SYSTEM: { type: string } // System name
 *        ACTIVE: { type: number } // Active status
 *        UNIT: { type: string } // Unit of measurement
 *    ThresholdData: // Schema for threshold data
 *      type: object
 *      properties:
 *        OBJECTID: { type: number }
 *        GLOBALID: { type: string }
 *        LOCATION_CODE: { type: string }
 *        LOCATION_NAME: { type: string }
 *        PROJECT_NAME: { type: string }
 *        ANALYSIS: { type: string }
 *        ANALYTE: { type: string }
 *        UPPER_LOWER_SPECS: { type: string }
 *        SPECS_VALUE: { type: number }
 *        ACKTIMEOUT: { type: number }
 *        CLOSEOUTTIMEOUT: { type: number }
 *        TEMPLATE_ID: { type: string }
 *        SYSTEM: { type: string }
 *        ACTIVE: { type: number }
 *        UNIT: { type: string }
 *    ArcGISEditFeatureResponse: // Schema for the response of editing a feature in ArcGIS
 *      type: object
 *      properties:
 *        addResults: // Array of results from adding a feature
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              objectId: { type: number } // Object ID of the added feature
 *              globalId: { type: string } // Global ID of the added feature
 *              success: { type: boolean } // Success status of the operation
 *              error:
 *                type: object
 *                properties:
 *                  code: { type: number } // Error code
 *                  description: { type: string } // Error description
 *    ArcGISGetThresholdsResponse: // Schema for the response of getting thresholds from ArcGIS
 *      type: object
 *      properties:
 *        objectIdFieldName: { type: string } // Field name for the object ID
 *        globalIdFieldName: { type: string } // Field name for the global ID
 *        hasZ: { type: boolean } // Indicates if the response has Z values
 *        hasM: { type: boolean } // Indicates if the response has M values
 *        fields: // Array of field definitions
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              name: { type: string } // Name of the field
 *              alias: { type: string } // Alias of the field
 *              type: { type: string } // Data type of the field
 *              length: { type: number } // Length of the field
 *        features: // Array of features
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              attributes:
 *                type: schema
 *                $ref: '#/components/schemas/ThresholdData' // Reference to ThresholdData schema
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
thresholdsRouter.get("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const getThresholdResult = await WqimsThreshold.getActiveFeatures();
    res.json(getThresholdResult.map((feature: IFeature) => feature.attributes));
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Threshold GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Threshold GET error" });
    } else {
      appLogger.error("Threshold GET Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Threshold GET error" });
    }
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
 *            schema:
 *              $ref: '#/components/schemas/ThresholdData'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
thresholdsRouter.put("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const threshold = new WqimsThreshold(req.body);
    const updateResult = await threshold.checkInactive();
    if (!updateResult.success) {
      const thresholdAddResult = await threshold.addFeature();
      if (!thresholdAddResult?.success) throw new Error(thresholdAddResult.error?.description);
    }
    res.json(threshold);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Threshold PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Threshold PUT Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /thresholds:
 *  post:
 *    summary: Deactivates threshold from thresholds list
 *    description: Deactivates a threshold
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
thresholdsRouter.post("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const threshold = new WqimsThreshold(req.body);

    const updateResult = await threshold.softDeleteFeature();
    if (!updateResult.success) throw new Error("Error deactivating threshold");

    const deleteGroupMembershipResult = await threshold.removeRelationship(WqimsThreshold.groupsRelationshipClassUrl) as IEditFeatureResult;
    if (!deleteGroupMembershipResult.success) throw new Error(deleteGroupMembershipResult.error?.description || "Error deleting group membership");

    res.json(updateResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Threshold POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Threshold POST error" });
    } else {
      appLogger.error("Threshold POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Threshold POST error" });
    }
  }
});

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
thresholdsRouter.patch("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const threshold = new WqimsThreshold(req.body);
    const updateResult = await threshold.updateFeature();
    if (!updateResult?.success) {
      throw new Error(updateResult.error?.description || "Error updating threshold");
    }
    res.json(threshold);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Threshold PATCH Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Threshold PATCH error" });
    } else {
      appLogger.error("Threshold PATCH Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Threshold PATCH error" });
    }
  }
});

export default thresholdsRouter;