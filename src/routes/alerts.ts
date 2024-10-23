import express from "express";
import OracleDB from "oracledb";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import { appLogger } from "../util/appLogger";
import { checkToken, logRequest, verifyAndRefreshToken } from "./auth";
import { WqimsAlert } from "../models/WqimsAlerts";

const alertsRouter = express.Router();

alertsRouter.use(cookieParser());

/**
 * @swagger
 * components:
 *  schemas:
 *    AlertData:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        SAMPLENUM:
 *          type: string
 *        LOCATION:
 *          type: string
 *        LOCCODE:
 *          type: string
 *        COLLECTDATE:
 *          type: number
 *        SAMPLECOLLECTOR:
 *          type: string
 *        ACODE:
 *          type: string
 *        ANALYTE:
 *          type: string
 *        ANALYSEDDATE:
 *          type: number
 *        ANALYSEDBY:
 *          type: string
 *        DATEVALIDATED:
 *          type: number
 *        VALIDATEDBY:
 *          type: string
 *        GEOCODEMATCHEDADDRESS:
 *          type: string
 *        RESULT:
 *          type: string
 *        WARNING_STATUS:
 *          type: string
 *        SYSTEM:
 *          type: string
 *        STATUS:
 *          type: string
 *        COMMENTS:
 *          type: string
 *        ACK_TIME:
 *          type: number
 *        ACK_BY:
 *          type: string
 *        CLOSED_TIME:
 *          type: number
 *        CLOSED_BY:
 *          type: string
 *        THRESHOLD_ID:
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
 *    ArcGISGetAlertsResponse:
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
 *                $ref: '#/components/schemas/AlertData'
 */

/**
 * @swagger
 * /alerts:
 *  get:
 *    summary: Get list of alerts per user
 *    description: Gets a list of alerts for user
 *    tags:
 *      - Alerts
 *    responses:
 *      '200':
 *        description: A list of alerts
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISGetAlertsResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
alertsRouter.get("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const userId = await checkToken(req, res) as string;
    if(!userId) { throw new Error("Invalid Token") }
    const userAlerts = await WqimsAlert.getUserAlerts(parseInt(userId));
    res.json(userAlerts.map((feature) => feature.attributes));  
  } catch (error) {
    console.log(error)
    if (error instanceof Error && error.message === "Invalid Token") {
        return res.status(401).send({
            error: error.message,
            message: "Unauthorized",
        });
    } else {
        return res.status(500).send({
            error: error instanceof Error ? error.message : "unknown error",
            message: "Alerts GET error",
        });
    }
  }
});

/**
 * @swagger
 * /alerts/all:
 *  get:
 *    summary: Get list of all alerts
 *    description: Gets a list of all alerts
 *    tags:
 *      - Alerts
 *    responses:
 *      '200':
 *        description: A list of all alerts
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISGetAlertsResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
alertsRouter.get("/all", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const allAlertsResponse = await WqimsAlert.getActiveFeatures();
    res.json(allAlertsResponse.map((feature) => feature.attributes));
  } catch (error) {
    appLogger.error("Alerts GET Error:", error instanceof Error ? error.stack : "unknown error");
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "Alerts GET error",
    });
  }
});

/**
 * @swagger
 * /alerts/status:
 *  post:
 *    summary: Update alert status
 *    description: Updates an alert status  based on alert sent in body
 *    tags:
 *      - Alerts
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AlertData'
 *    responses:
 *      '200':
 *        description: Alert Status changed successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/AlertsData'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
alertsRouter.post("/status", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const alert = new WqimsAlert(req.body);
    const userId = await checkToken(req, res) as string;
    await alert.updateStatus(parseInt(userId));
    res.json(alert);
  } catch (error) {
    appLogger.error("Alerts POST Error:", error instanceof Error ? error.stack : "unknown error");
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "Alerts POST error",
    });
  }
});

alertsRouter.get('/:id', verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const alert = await WqimsAlert.getAlert(alertId);
    if (alert) {
      res.json(alert.attributes);
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ message: 'Error fetching alert', error });
  }
});

export default alertsRouter;
