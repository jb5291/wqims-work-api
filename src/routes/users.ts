import express from "express";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";

import { appLogger } from "../util/appLogger";
import graphHelper from "../util/graph";
import { WqimsUser } from "../models/WqimsUser";
import { logRequest, verifyAndRefreshToken } from "./auth";
import cookieParser from "cookie-parser";

const usersRouter = express.Router();
usersRouter.use(cookieParser());

/**
 * @swagger
 * components:
 *  schemas:
 *    AddUserData:
 *      type: object
 *      properties:
 *        NAME:
 *          type: string
 *        DEPARTMENT:
 *          type: string
 *        POSITION:
 *          type: string
 *        DIVISION:
 *          type: string
 *        PHONENUMBER:
 *          type: string
 *        EMAIL:
 *          type: string
 *        ROLE:
 *          type: string
 *        RAPIDRESPONSETEAM:
 *           type: integer
 *        SECONDARYPHONENUMBER:
 *           type: string
 *           nullable: true
 *        STARTTIME:
 *           type: string
 *           nullable: true
 *        ENDTIME:
 *           type: string
 *           nullable: true
 *        ACTIVE:
 *           type: integer
 *           nullable: true
 *    UserData:
 *      type: object
 *      properties:
 *        OBJECTID:
 *          type: number
 *        GLOBALID:
 *          type: string
 *        NAME:
 *          type: string
 *        DEPARTMENT:
 *          type: string
 *        POSITION:
 *          type: string
 *        DIVISION:
 *          type: string
 *        PHONENUMBER:
 *          type: string
 *        EMAIL:
 *          type: string
 *        ROLE:
 *          type: string
 *        RAPIDRESPONSETEAM:
 *           type: integer
 *        SECONDARYPHONENUMBER:
 *           type: string
 *           nullable: true
 *        STARTTIME:
 *           type: string
 *           nullable: true
 *        ENDTIME:
 *           type: string
 *           nullable: true
 *        ACTIVE:
 *           type: integer
 *           nullable: true
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
 *    ArcGISGetUsersResponse:
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
 *                ref: '#/components/schemas/UserData'
 */

/**
 * @swagger
 * /users:
 *  get:
 *    summary: Get list of active users
 *    description: Gets a list of groups from DSNGIST wqims.users
 *    tags:
 *      - Users
 *    responses:
 *      '200':
 *        description: A list of users
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/ArcGISGetUsersResponse'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
usersRouter.get("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const getUserResult = await WqimsUser.getActiveFeatures();
    res.json(getUserResult);
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
 * /users:
 *  put:
 *    summary: Add a new user to users
 *    description: Adds a new user to users table
 *    tags:
 *      - Users
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/AddUserData'
 *    responses:
 *      '200':
 *        description: User added successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/UserData'
 *      '500':
 *        description: Internal Server Error
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example: 'Internal Server Error'
 */
usersRouter.put("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const user = new WqimsUser(req.body);

    const updateResult = await user.checkInactive();
    if (!updateResult.success) {
      // true if user was reactivated
      const userAddResult = await user.addFeature();
      if (!userAddResult?.success) throw new Error("Error adding user");
    }
    const userRoleEditResult = await user.updateUserRole();
    if (!userRoleEditResult?.success) throw new Error("Error updating user role");

    res.json(user);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User PUT Error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User PUT error",
    });
  }
});

/**
 * @swagger
 * /users:
 *  post:
 *    summary: Deactivates a user from users table
 *    description: Deactivates a user from users based on user provided in body
 *    tags:
 *      - Users
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/UserData'
 *    responses:
 *      '200':
 *        description: User deactivated successfully
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
usersRouter.post(
  "/", verifyAndRefreshToken, logRequest, async (req, res) => {
    try {
      const user: WqimsUser = new WqimsUser(req.body);

      const updateResult = await user.softDeleteFeature();
      if (updateResult.success) {
        //await user.deleteUserRelClassRecord(WqimsUser.rolesRelationshipClassUrl);
        //await user.deleteUserRelClassRecord(WqimsUser.groupsRelationshipClassUrl);
        res.json(updateResult);
      } else {
        throw new Error(updateResult.error?.description || "Error deactivating user");
      }
    } catch (error) {
      const stack = error instanceof Error ? error.stack : "unknown error";
      appLogger.error("User POST error:", stack);
      res.status(500).send({
        error: error instanceof Error ? error.message : "unknown error",
        message: "User POST error",
      });
    }
  }
);

/**
 * @swagger
 * /users:
 *  patch:
 *    summary: Update a user in users table
 *    description: Updates a user in table based on the user provided in body
 *    tags:
 *      - Users
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/UserData'
 *    responses:
 *      '200':
 *        description: User updated successfully
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
usersRouter.patch("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const user: WqimsUser = new WqimsUser(req.body);

    const updateResult: IEditFeatureResult = await user.updateFeature();
    if (!updateResult.success) {
      throw new Error(updateResult.error?.description || "Error updating user");
    }

    const roleResponse = await user.updateUserRole();
    if (!roleResponse?.success) {
      throw new Error(roleResponse?.error?.description || "Error updating user role");
    }
    res.json(updateResult);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : "unknown error";
    appLogger.error("User PATCH error:", stack);
    res.status(500).send({
      error: error instanceof Error ? error.message : "unknown error",
      message: "User PATCH error",
    });
  }
});

usersRouter.use("/search", async (req, res) => {
  try {
    const searchQuery = req.query.filter as string;
    const users = await graphHelper.getADUsers(searchQuery);
    res.send(users);
  } catch (error) {
    appLogger.error(error);
    res.status(500).send({ error: error instanceof Error ? error.message : "Unknown error searching for users" });
  }
});
export default usersRouter;
