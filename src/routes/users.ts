import express from "express";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";
import { appLogger } from "../util/appLogger";
import { default as graph } from "../util/graph";
import { WqimsUser } from "../models/WqimsUser";
import { logRequest, verifyAndRefreshToken } from "./auth";
import cookieParser from "cookie-parser";

const usersRouter = express.Router();
usersRouter.use(cookieParser());

/**
 * @swagger
 * components:
 *  schemas:
 *    AddUserData: // Schema for adding a new user
 *      type: object
 *      properties:
 *        NAME: { type: string } // Name of the user
 *        DEPARTMENT: { type: string } // Department of the user
 *        POSITION: { type: string } // Position of the user
 *        DIVISION: { type: string } // Division of the user
 *        PHONENUMBER: { type: string } // Phone number of the user
 *        EMAIL: { type: string } // Email address of the user
 *        ROLE: { type: string } // Role of the user
 *        RAPIDRESPONSETEAM: { type: integer } // Indicates if the user is part of the rapid response team
 *        SECONDARYPHONENUMBER: { type: string, nullable: true } // Secondary phone number of the user
 *        STARTTIME: { type: string, nullable: true } // Start time of the user's shift
 *        ENDTIME: { type: string, nullable: true } // End time of the user's shift
 *        ACTIVE: { type: integer, nullable: true } // Active status of the user
 *    UserData: // Schema for user data
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } // Object ID of the user
 *        GLOBALID: { type: string } // Global ID of the user
 *        NAME: { type: string }
 *        DEPARTMENT: { type: string }
 *        POSITION: { type: string }
 *        DIVISION: { type: string }
 *        PHONENUMBER: { type: string }
 *        EMAIL: { type: string }
 *        ROLE: { type: string }
 *        RAPIDRESPONSETEAM: { type: integer }
 *        SECONDARYPHONENUMBER: { type: string, nullable: true }
 *        STARTTIME: { type: string, nullable: true }
 *        ENDTIME: { type: string, nullable: true }
 *        ACTIVE: { type: integer, nullable: true }
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
 *    ArcGISGetUsersResponse: // Schema for the response of getting users from ArcGIS
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
 *                ref: '#/components/schemas/UserData' // Reference to UserData schema
 */

/**
 * @swagger
 * /users:
 *  get:
 *    summary: Get list of active users
 *    description: Gets a list of groups from DSNGIST wqims.users
 *    tags: [Users]
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
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /users:
 *  put:
 *    summary: Add a new user to users
 *    description: Adds a new user to users table
 *    tags: [Users]
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
      const userAddResult = await user.addFeature();
      if (!userAddResult?.success) throw new Error("Error adding user");
    }
    const userRoleEditResult = await user.updateUserRole();
    if (!userRoleEditResult?.success) throw new Error("Error updating user role");
    await user.addEverbridgeContact();
    res.json(user);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /users:
 *  post:
 *    summary: Deactivates a user from users table
 *    description: Deactivates a user from users based on user provided in body
 *    tags: [Users]
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
usersRouter.post("/", verifyAndRefreshToken, logRequest, async (req, res) => {
  try {
    const user = new WqimsUser(req.body);
    user.PHONENUMBER = user.PHONENUMBER || "none";
    const updateResult = await user.softDeleteFeature();
    if (updateResult.success) {
      await user.deleteEverbridgeContact();
      res.json(updateResult);
    } else {
      throw new Error(updateResult.error?.description || "Error deactivating user");
    }
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

/**
 * @swagger
 * /users:
 *  patch:
 *    summary: Update a user in users table
 *    description: Updates a user in table based on the user provided in body
 *    tags: [Users]
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
    const user = new WqimsUser(req.body);
    const updateResult = await user.updateFeature();
    if (!updateResult.success) throw new Error(updateResult.error?.description || "Error updating user");
    const roleResponse = await user.updateUserRole();
    if (!roleResponse?.success) throw new Error(roleResponse?.error?.description || "Error updating user role");
    await user.updateEverbridgeContact();
    res.json(updateResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

usersRouter.use("/search", async (req, res) => {
  try {
    const searchQuery = req.query.filter as string;
    const users = await graph.getADUsers(searchQuery);
    res.send(users);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Group POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Group POST error" });
    } else {
      appLogger.error("Group POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Group POST error" });
    }
  }
});

export default usersRouter;