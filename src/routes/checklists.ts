import express from 'express'
import OracleDB, { Connection} from 'oracledb'

import { WQIMS_DB_CONFIG } from '../util/secrets'
import { appLogger, actionLogger } from '../util/appLogger'
import { verifyAndRefreshToken, logRequest } from './auth';
import WqimsChecklist, { IChecklistItem } from '../models/WqimsChecklist';
import { IEditFeatureResult } from '@esri/arcgis-rest-feature-service';

const checklistsRouter = express.Router();

/**
 * @swagger
 * components:
 *  schemas:
 *    AddChecklistTemplate:
 *      type: object
 *      properties:
 *        GLOBALID: { type: string     }
 *        TEMPLATE_NAME: { type: string }
 *        CREATED_AT: { type: number }
 *        UPDATED_AT: { type: number }
 *    AddChecklistItem:
 *      type: object
 *      properties:
 *        GLOBALID: { type: string }
 *        TEMPLATE_ID: { type: string }
 *        DESCRIPTION: { type: string }
 *        ORDER_: { type: number }
 *        CREATED_AT: { type: number }
 *        UPDATED_AT: { type: number }
 *        COMPLETED_BY: { type: string }
 *        COMPLETED_AT: { type: number }
 *        STATUS: { type: string }
 *    IChecklistTemplate:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number }
 *        GLOBALID: { type: string }
 *        TEMPLATE_NAME: { type: string }
 *        CREATED_AT: { type: number }
 *        UPDATED_AT: { type: number }
 *        items: { type: array, items: { $ref: '#/components/schemas/IChecklistItem' } }
 *    editChecklistTemplate:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number }
 *        GLOBALID: { type: string }
 *        TEMPLATE_NAME: { type: string }
 *        CREATED_AT: { type: number }
 *        UPDATED_AT: { type: number }
 *        itemChanges:
 *          type: object
 *          properties:
 *            add: { type: array, items: { $ref: '#/components/schemas/IChecklistItem' } }
 *            delete: { type: array, items: { $ref: '#/components/schemas/IChecklistItem' } }
 *            update: { type: array, items: { $ref: '#/components/schemas/IChecklistItem' } }
 *    IChecklistItem:
 *      type: object
 *      properties:
 *        OBJECTID: { type: number }
 *        GLOBALID: { type: string }
 *        TEMPLATE_ID: { type: string }
 *        DESCRIPTION: { type: string }
 *        ORDER_: { type: number }
 *        CREATED_AT: { type: number }
 *        UPDATED_AT: { type: number }
 *        COMPLETED_BY: { type: string }
 *        COMPLETED_AT: { type: number }
 *        STATUS: { type: string }
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
 *    ArcGISGetChecklistTemplatesResponse: 
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
 *                ref: '#/components/schemas/IChecklistTemplate' 
 */

/**
     * @swagger
     * /checklists:
     *  get:
     *    summary: Get all checklist templates
     *    description: Get all checklist templates
     *    tags:
     *      - Checklists
     *    responses:
     *      200:
     *        description: A list of checklist templates
     *        content:
     *          application/json:
     *            schema:
     *              $ref: '#/components/schemas/ArcGISGetChecklistTemplatesResponse'
     *      500:
     *        description: Internal Server Error
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Internal Server Error'
     */
checklistsRouter.get('/', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const getChecklistResult = await WqimsChecklist.getActiveFeatures();
    res.json(getChecklistResult.map(f => f.attributes));
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Checklists GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists GET error" });
    }
  }
})

/**
     * @swagger
     * /checklists:
     *   put:
     *     summary: Create a new checklist template
     *     description: Create a new checklist template
     *     tags:
     *       - Checklists
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           items:
     *             templateName: { type: string }
     *     responses:
     *       200:
     *         description: Successfully created a new checklist template
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/IChecklistTemplate'
     *       500:
     *         description: Internal Server Error
     *         content:
     *           application/json:
     *             schema:
     *               type: string
     *               example: 'Internal Server Error'
     */
checklistsRouter.put('/', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const template = new WqimsChecklist(req.body);
    const time = new Date().getTime();

    const result = await WqimsChecklist.addTemplateFeature(template.TEMPLATE_NAME, time);
    if(!result.success) { throw new Error("Error creating checklist template"); }
    template.OBJECTID = result.objectId;
    template.globalId = result.globalId as string;

    if (template.items.length) {
      const itemResults = await template.addItemsToTemplate();
      if(!itemResults) { throw new Error("Error creating checklist items"); }
    }

    const { featureUrl, ACTIVE, ...templateData } = template;
    res.json(templateData);
  } catch (error: unknown) {
    if(error instanceof Error) {
      appLogger.error("Checklists PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists PUT error" });
    }
  }
});

/**
 * @swagger
 * /checklists/{id}:
 *   delete:
 *     summary: Deletes a checklist template
 *     description: Deletes a checklist template
 *     tags:
 *       - Checklists
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the checklist template to Delete
 *     responses:
 *       200:
 *         description: Successfully deleted the checklist template
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               example: 'Internal Server Error'
 */
checklistsRouter.delete('/:id', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    // const checklist = new WqimsChecklist(req.body);
    const id = req.params.id;
    // const deleteItemsResult = await WqimsChecklist.removeRelationshipFromTemplate(parseInt(id));
    // if(!deleteItemsResult.success) { throw new Error(deleteItemsResult.error?.description || "Error deleting checklist items"); }
  
    const updateResult = await WqimsChecklist.deleteFeature(WqimsChecklist.featureUrl, parseInt(id));
    if(!updateResult.success) { throw new Error(updateResult.error?.description || "Error deactivating checklist template"); }
  
    res.json(updateResult);
  } catch (error) {
    if(error instanceof Error) {
      appLogger.error("Checklists PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists PUT error" });
    }
  }
})

/**
 * @swagger
 * /checklists:
 *   patch:
 *     summary: Update a checklist template, updates checklist items
 *     description: Update a checklist template name, or updated items
 *     tstags:
 *       - Checklists
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/editChecklistTemplate'
 *     responses:
 *       200:
 *         description: Successfully updated the checklist template
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IChecklistTemplate'
 *       500:
 *         description: Internal Server Error
 */
checklistsRouter.patch('/', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const { itemChanges, ...checklistTemplate } = req.body;
    const timestamp = new Date().getTime();
    const itemsToDelete = itemChanges.delete;
    const itemsToAdd = itemChanges.add;
    const itemsToUpdate = itemChanges.update;
    let itemUpdatesResults: IChecklistItem[] = [];
    let itemAddResults: IEditFeatureResult[] = [];
    let itemDeleteResults: IEditFeatureResult[] = [];

    checklistTemplate.UPDATED_AT = timestamp;

    const templateResult = await WqimsChecklist.updateTemplateFeature(checklistTemplate);
    if(!templateResult) { throw new Error("Error updating checklist template"); }

    if(itemsToAdd.length) {
      itemAddResults = await WqimsChecklist.addItemFeatures(itemsToAdd);
      if(!itemAddResults) { throw new Error("Error adding checklist items"); }
    }

    if (itemsToDelete.length) {
      itemDeleteResults = await WqimsChecklist.removeItemFeatures(itemsToDelete);
      if(!itemDeleteResults) { throw new Error("Error deleting checklist items"); }
    }

    if (itemsToUpdate.length) {
      itemUpdatesResults = await WqimsChecklist.updateItemFeatures(itemsToUpdate);
      if(!itemUpdatesResults) { throw new Error("Error updating checklist items"); }
    }

    res.json({...templateResult, items: itemUpdatesResults.map(item => {
      return { ...item }
    })});
  } catch (error) {
    if(error instanceof Error) {
      appLogger.error("Checklists PATCH Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists PATCH error" });
    }
  }
});

/**
 * @swagger
 * /checklists/{id}:
 *   get:
 *     summary: Get all checklist items for a template
 *     description: Get all checklist items for a template
 *     tags:
 *       - Checklists
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The object id of the checklist template to get items for
 *     responses:
 *       200:
 *         description: A list of checklist items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IChecklistItem'
 *       500:
 *         description: Internal Server Error
 */
checklistsRouter.get('/:id', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const getChecklistItemsResult = await WqimsChecklist.getChecklistItems(parseInt(req.params.id));
    res.json(getChecklistItemsResult.map(f => f.attributes));
  } catch (error) {
    if(error instanceof Error) {
      appLogger.error("Checklists GET Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists GET error" });
    }
  }
})

/**
 * @swagger
 * /checklists/items:
 *   put:
 *     summary: Create a new checklist item
 *     description: Create a new checklist item
 *     tags:
 *       - Checklists
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddChecklistItem'
 *     responses:
 *       200:
 *         description: Successfully created a new checklist item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IChecklistItem'
 *       500:
 *         description: Internal Server Error
 */
checklistsRouter.put('/items', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  const  checklistItem = new WqimsChecklist(req.body);
  const timestamp = new Date().getTime();

  checklistItem.CREATED_AT = timestamp;
  checklistItem.UPDATED_AT = timestamp;

  const result = await checklistItem.addItemFeature();
  if(!result.success) { throw new Error(result.error?.description || "Error creating checklist item"); }
  const { ACTIVE, featureUrl, ...checklistItemData } = checklistItem;
  res.json(checklistItemData);
});

/**
 * @swagger
 * /checklists/items/{itemId}:
 *   delete:
 *     summary: Deletes a checklist item
 *     description: Deletes a checklist item
 *     tags:
 *       - Checklists
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the checklist item to Delete
 *     responses:
 *       200:
 *         description: Successfully deleted the checklist item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArcGISEditFeatureResponse'
 *       500:
 *         description: Internal Server Error
 */
checklistsRouter.delete('/items/:itemId', /* verifyAndRefreshToken, logRequest, */ async (req, res) => {
  try {
    const updateResult = await WqimsChecklist.deleteFeature(WqimsChecklist.itemFeaturesUrl, parseInt(req.params.itemId));
    if(!updateResult.success) { throw new Error(updateResult.error?.description || "Error deactivating checklist item"); }
    res.json(updateResult);
  } catch (error) {
    if(error instanceof Error) {
      appLogger.error("Checklists PUT Error:", error.stack);
      res.status(500).send({ error: error.message, message: "Checklists PUT error" });
    }
  }
});


export default checklistsRouter;