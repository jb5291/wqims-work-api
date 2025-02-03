import express from "express";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";
import { appLogger } from "../util/appLogger";
import { default as graph } from "../util/graph";
import { WqimsUser } from "../models/WqimsUser";
import cookieParser from "cookie-parser";
import { verifyAndRefreshToken, logRequest } from "./auth";

const usersRouter = express.Router();
usersRouter.use(cookieParser());

/**
 * @swagger
 * components:
 *  schemas:
 *    AddUserData: 
 *      type: object
 *      properties:
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
 *    IUserData: 
 *      type: object
 *      properties:
 *        OBJECTID: { type: number } 
 *        GLOBALID: { type: string } 
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
 *    ArcGISEditFeatureResponse: 
 *      type: object
 *      properties:
 *        addResults: 
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              objectId: { type: number } 
 *              globalId: { type: string } 
 *              success: { type: boolean } 
 *              error:
 *                type: object
 *                properties:
 *                  code: { type: number } 
 *                  description: { type: string } 
 *    ArcGISGetUsersResponse: 
 *      type: object
 *      properties:
 *        objectIdFieldName: { type: string } 
 *        globalIdFieldName: { type: string } 
 *        hasZ: { type: boolean } 
 *        hasM: { type: boolean } 
 *        fields: 
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              name: { type: string } 
 *              alias: { type: string } 
 *              type: { type: string } 
 *              length: { type: number } 
 *        features: 
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              attributes:
 *                type: schema
 *                ref: '#/components/schemas/IUserData' 
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
usersRouter.get("/", /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const getUserResult = await WqimsUser.getActiveFeatures();
    res.json(getUserResult.map((user) => user.attributes));
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Users GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Users GET error" });
    } else {
      appLogger.error("Users GET Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "Users GET error" });
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
 *              $ref: '#/components/schemas/IUserData'
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
      appLogger.error("User PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "User PUT error" });
    } else {
      appLogger.error("User PUT Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "User PUT error" });
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
 *            $ref: '#/components/schemas/IUserData'
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
    if(!updateResult.success) throw new Error(updateResult.error?.description || "Error deactivating user");

    const deleteRoleResult = await user.removeRelationship(WqimsUser.rolesRelationshipClassUrl) as IEditFeatureResult;
    if (!deleteRoleResult.success) throw new Error(deleteRoleResult.error?.description || "Error deleting user role");

    const deleteGroupMembershipResult = await user.removeRelationship(WqimsUser.groupsRelationshipClassUrl) as IEditFeatureResult;
    if (!deleteGroupMembershipResult.success) throw new Error(deleteGroupMembershipResult.error?.description || "Error deleting user");

    await user.deleteEverbridgeContact();

    res.json(updateResult);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("User POST Error:", error.stack);
      res.status(500).send({ error: error.message, message: "User POST error" });
    } else {
      appLogger.error("User POST Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "User POST error" });
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
 *            $ref: '#/components/schemas/IUserData'
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
      appLogger.error("User PATCH Error:", error.stack);
      res.status(500).send({ error: error.message, message: "User PATCH error" });
    } else {
      appLogger.error("User PATCH Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "User PATCH error" });
    }
  }
});

/**
 * @swagger
 * /users/search:
 *  get:
 *    summary: Search users in Active Directory
 *    description: Searches for users in AD based on query string
 *    tags:
 *      - Users
 *    parameters:
 *      - in: query
 *        name: filter
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: List of matching users
 *      '500':
 *        description: Internal Server Error
 */
usersRouter.get("/search", async (req, res) => {
  try {
    const searchQuery = req.query.filter as string;
    const users = await graph.getADUsers(searchQuery);
    res.send(users);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("User SEARCH Error:", error.stack);
      res.status(500).send({ error: error.message, message: "User SEARCH error" });
    } else {
      appLogger.error("User SEARCH Error:", "unknown error");
      res.status(500).send({ error: "unknown error", message: "User SEARCH error" });
    }
  }
});

/**
 * @swagger
 * /users/{id}:
 *  get:
 *    summary: Get user by ID
 *    description: Retrieves a specific user by their ID
 *    tags:
 *      - Users
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: User data retrieved successfully
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/UserData'
 *      '404':
 *        description: User not found
 *      '500':
 *        description: Internal Server Error
 */
usersRouter.get('/:id', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await WqimsUser.getUser(userId);
    
    if (user) {
      res.json(user.attributes);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      message: 'Error fetching user', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default usersRouter;
