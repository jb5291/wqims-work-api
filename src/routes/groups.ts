import express from 'express';
import OracleDB, { Connection } from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";
import { appLogger, actionLogger } from '../util/appLogger';

const groupsRouter = express.Router();
const dbConf = {
  user: WQIMS_DB_CONFIG.username,
  password: WQIMS_DB_CONFIG.password,
  connectString: WQIMS_DB_CONFIG.connection_string
};
/**
 * @swagger
 * components:
 *  schemas:
 *    GroupData:
 *      type: array
 *      items:
 *        - type: string
 *        - type: string
 *        - type: integer
 *        - type: array
 *          items:
 *          - type: string
 *        - type: array
 *          items:
 *          - type: string
 */

OracleDB.createPool(dbConf)
  .then(pool => {
    appLogger.info('Connection pool created for notification groups');

    /**
     * @swagger
     * /notificationGroups:
     *  get:
     *    summary: Get list of groups
     *    description: Gets a list of groups from DSNGIST wqims.notificationGroups and user ids from users_groups
     *    tags: 
     *      - Notification Groups 
     *    responses:
     *      '200':
     *        description: A list of groups
     *        content:
     *          application/json:
     *            schema:
     *              type: array
     *              items:
     *                $ref: '#/components/schemas/GroupData'
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.get('/', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();

        const groupDataResult: any = await getActiveGroups(connection);
        const groupIds = groupDataResult.map((row: any) => row[0]);

        if(groupIds.length === 0) {
          res.json([]);
          return;
        }
        
        const memberIdsResult: any = await getMemberIds(groupIds, connection);

        const thresholdIdsResult: any = await getThresholdIds(groupIds, connection);

        const groups: any = groupDataResult.map((group: any) => ({
          groupId: group[0],
          objectId: group[1],
          groupName: group[2],
          members: memberIdsResult[group[0]] || [],
          thresholds: thresholdIdsResult[group[0]] || []
        }));
        
        res.json(groups);
      }
      catch (err) {
        appLogger.error(err);
        res.status(502).json({ error: 'DB Connection Error'});
      }
      finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups:
     *  put:
     *    summary: adds group to group list
     *    description: adds a group to DSNGIST wqims.notificationGroups
     *    tags: 
     *      - Notification Groups 
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              groupname:
     *                type: string
     *              members:
     *                type: array
     *                items:
     *                  object:
     *              
     *    responses:
     *      '201':
     *        description: Group added successfully
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *              properties:
     *                groupName:
     *                  type: string
     *                groupId:
     *                  type: string
     *                objectId:
     *                  type: string
     *                members:
     *                  type: array
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.put('/', async (req, res) => {
      let connection: Connection | null = null;
      let result: any;
      let addedGroup: any;
      try {
        connection = await pool.getConnection();

        const groupName = req.body.groupName;
        const members: any = req.body.members.length ? req.body.members : [];
        const thresholds: any = req.body.thresholds.length ? req.body.thresholds : [];

        const inactiveGroup: any = await findInactiveGroup(groupName, connection);

        if(inactiveGroup.length) {
          result = await addInactiveGroup(inactiveGroup[0], connection);
          addedGroup = {
            groupName: groupName,
            groupId: result[0],
            objectID: result[1],
            members: members,
            thresholds: thresholds
          }
        }
        else {
          result = await addGroup(groupName, connection);
          addedGroup = {
            groupName: groupName,
            groupId: result.GROUPID,
            objectId: result.OBJECTID,
            members: members,
            thresholds: thresholds
          }
        }

        

        if(members.length) {
          const inactiveGroupMembers: any = await findInactiveGroupMembers(addedGroup.groupId, members.map((member: any) => member.globalid), connection);

          if(inactiveGroupMembers.hasOwnProperty(addedGroup.groupId) && inactiveGroupMembers[addedGroup.groupId].length > 1) {
            await addInactiveGroupMembers(addedGroup.groupId, inactiveGroupMembers[addedGroup.groupId], connection);
            if(inactiveGroupMembers[addedGroup.groupId].length < members.length) {
              await addGroupMemberIds(addedGroup.groupId, members.filter((member: any) => !inactiveGroupMembers[addedGroup.groupId].includes(member.globalid)).map((member: any) => member.globalid), connection)
            }
          }
          else {
            await addGroupMemberIds(addedGroup.groupId, members.map((member: any) => member.globalid), connection)
          }
        }

        if(thresholds.length) {
          const inactiveGroupThresholds: any = await findInactiveGroupThresholds(addedGroup.groupId, thresholds.map((threshold: any) => threshold.GLOBALID), connection);

          if(inactiveGroupThresholds.hasOwnProperty(addedGroup.groupId) && inactiveGroupThresholds[addedGroup.groupId].length) {
            await addInactiveGroupThresholds(addedGroup.groupId, inactiveGroupThresholds[addedGroup.groupId], connection);
            if(inactiveGroupThresholds[addedGroup.groupId].length < thresholds.length) {
              await addThresholdIds(addedGroup.groupId, thresholds.filter((threshold: any) => !inactiveGroupThresholds[addedGroup.groupId].includes(threshold.GLOBALID)).map((threshold: any) => threshold.GLOBALID), connection)
            }
          }
          else {
            await addThresholdIds(addedGroup.groupId, thresholds.map((t: any) => t.GLOBALID), connection)
          }
        }
         
        const memberNames = members.map((m:any)=>m.name).join(', ');
        const thresholdNames = members.map((t:any)=>t.ANALYTE+'-'+t.UPPER_LOWER_SPECS+'-'+t.LOCATION_CODE).join(', ');
        actionLogger.info(`Group Added ${groupName}, members: ${memberNames}, thresholds: ${thresholdNames}`);
        res.json(addedGroup);

      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error'});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });
    
    /**
     * @swagger
     * /notificationGroups/{groupId}/members:
     *  put:
     *    summary: adds member to specified group
     *    description: adds a member to DSNGIST wqims.users_groups
     *    tags: 
     *      - Notification Groups 
     *    parameters:
     *      - in: path
     *        name: groupId
     *        schema:
     *          type: string
     *        required: true
     *        description: global ID of the group
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              memberIds:
     *                type: array
     *                items:
     *                  - type: string
     *    responses:
     *      '201':
     *        description: Member added successfully
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *              properties:
     *                groupName:
     *                  type: string
     *                groupId:
     *                  type: string
     *                objectId:
     *                  type: string
     *                members:
     *                  type: array
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.put('/:id/members', async (req, res) => {
      let connection: Connection | null = null;
      let result: any;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const memberData: string[] = req.body.memberIds.length ? req.body.memberIds : [];

        const inactiveGroupMembers: any = await findInactiveGroupMembers(groupId, memberData, connection);

        if(inactiveGroupMembers.length || inactiveGroupMembers[groupId].length) {
          await addInactiveGroupMembers(groupId, inactiveGroupMembers[groupId], connection);
          if(inactiveGroupMembers[groupId].length < memberData.length) {
            await addGroupMemberIds(groupId, memberData.filter((member: any) => !inactiveGroupMembers[groupId].includes(member)).map((member: any) => member), connection)
          }
        }
        else {
          await addGroupMemberIds(groupId, memberData, connection)
        }
          
        res.json(memberData);
      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error'});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups/assignThreshold:
     *  post:
     *    summary: adds specified threshold to groups
     *    description: adds a threshold to DSNGIST wqims.thresholds_groups
     *    tags: 
     *      - Notification Groups 
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              thresholdId:
     *                type: string
     *              groupIds:
     *                type: array
     *                items:
     *                  - type: string
     *    responses:
     *      '201':
     *        description: Thresholds added successfully
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *              properties:
     *                groupName:
     *                  type: string
     *                groupId:
     *                  type: string
     *                objectId:
     *                  type: string
     *                members:
     *                  type: array
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.post('/assignThreshold', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();

        const groupIds: string[] = req.body.groupIds ? req.body.groupIds : [];
        const thresholdId: string = req.body.thresholdId;
        if(thresholdId === undefined || thresholdId === null || thresholdId === '')
          throw new Error('Threshold ID is required');

        const inactiveGroupThresholds: any = await findInactiveThresholdInGroups(groupIds, thresholdId, connection);

        if(inactiveGroupThresholds.hasOwnProperty(thresholdId) && inactiveGroupThresholds[thresholdId].length > 1) {
          await addInactiveThresholdInGroups(inactiveGroupThresholds[thresholdId], thresholdId,  connection);
          if(inactiveGroupThresholds[thresholdId].length < groupIds.length) {
            await addThresholdIdToGroups(groupIds.filter((group: any) => !inactiveGroupThresholds[thresholdId].includes(group)).map((group: any) => group), thresholdId, connection)
          }
        }
        else {
          await addThresholdIdToGroups(groupIds, thresholdId, connection)
        }

          
        res.status(201).json(thresholdId + 'added to ' + groupIds);
      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error'});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups/{groupId}:
     *  delete:
     *    summary: deletes group from group list
     *    description: deletes a group from DSNGIST wqims.notificationGroups and all related records in users_groups and thresholds_groups
     *    tags: 
     *      - Notification Groups 
     *    parameters:
     *      - in: path
     *        name: groupId
     *        schema:
     *          type: string
     *        required: true
     *        description: global ID of the group
     *    responses:
     *      '200':
     *        description: Group deleted successfully
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.delete('/:id', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();
        const groupId = req.params.id;
        const groups: any = await getActiveGroups(connection);
        const group = groups.find((g:any)=>g.groupid === groupId);
        
        const deleteGrpExpr = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} set ACTIVE=0 where groupid = '${groupId}'`;
        const deleteUsrGrpsExpr = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} set ACTIVE=0 where GROUP_ID = '${groupId}'`;
        const deleteThrshldGrpsExpr = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} set ACTIVE=0 where GROUP_ID = '${groupId}'`;

        const deleteGrpResult = await connection.execute(deleteGrpExpr)
        const deleteUsrGrpsResult = await connection.execute(deleteUsrGrpsExpr);
        const deleteThrshldGrpsResult = await connection.execute(deleteThrshldGrpsExpr);
        

        connection.commit();
        actionLogger.info(`Group deactivated ${groupId}`);
        res.json([deleteGrpResult, deleteUsrGrpsResult, deleteThrshldGrpsResult]);
      }
      catch (err) {
        res.status(502).json({ error: 'DB Connection Error: ' + err});
      }
      finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups/{groupId}/members:
     *  post:
     *    summary: deletes member from group
     *    description: deletes a member from DSNGIST wqims.users_groups
     *    tags: 
     *      - Notification Groups 
     *    parameters:
     *      - in: path
     *        name: groupId
     *        schema:
     *          type: string
     *        required: true
     *        description: global ID of the group
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              memberIds:
     *                type: array
     *                items:
     *                  - type: string
     *    responses:
     *      '200':
     *        description: members deleted successfully
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.post('/:id/members', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const memberData: string[] = req.body.memberIds.length ? req.body.memberIds : [];
        const members: any = await getActiveMembers(groupId, connection);

        const groupName = await getActiveGroups(connection).then((groups: any) => groups.find((g:any)=>g.groupid === groupId).groupName);
        const deletedMembers:any = members.filter((m:any)=>memberData.includes(m[0])).map((m:any)=>m[1]).join(', ');

        const deleteMemberResults: any = await deactivateGroupMemberIds(groupId, memberData, connection);
          
        actionLogger.info(`Members deleted ${deletedMembers} from ${groupName}`);
        res.json(deleteMemberResults);
      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error'});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups/{groupId}/deleteThreshold:
     *  post:
     *    summary: deletes threshold from group
     *    description: deletes a threshold from DSNGIST wqims.thresholds_groups
     *    tags: 
     *      - Notification Groups 
     *    parameters:
     *      - in: path
     *        name: groupId
     *        schema:
     *          type: string
     *        required: true
     *        description: global ID of the group
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              thresholdIds:
     *                type: array
     *                items:
     *                  - type: string
     *    responses:
     *      '200':
     *        description: threshold deleted successfully
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.post('/:id/deleteThreshold', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const groupName = await getActiveGroups(connection).then((groups: any) => groups.find((g:any)=>g.groupid === groupId).groupName);
        const thresholdData: string[] = req.body.thresholdIds.length ? req.body.thresholdIds : [];
        const thresholds: any = await getActiveThresholds(groupId, connection);
        const deletedThresholds:any = thresholds.filter((t:any)=>thresholdData.includes(t[1])).map((t:any)=>t[2]+'-'+t[3]+'-'+t[4]).join(', ');

        const deactivateThresholdResults: any = await deactivateThresholdIds(groupId, thresholdData, connection)
          
        actionLogger.info(`Thresholds deleted ${deletedThresholds} from ${groupName}`);
        res.json(deactivateThresholdResults);
      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error'});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });

    /**
     * @swagger
     * /notificationGroups/{groupId}:
     * patch:
     *    summary: updates group in group list
     *    description: updates a group from DSNGIST wqims.notificationGroups
     *    tags:
     *      - Notification Groups
     *    parameters:
     *      - in: path
     *        name: groupId
     *        schema:
     *          type: string
     *        required: true
     *        description: global ID of the group
     *    requestBody:
     *      required: true
     *      content:
     *        application/json:
     *          schema:
     *            type: object
     *            properties:
     *              groupName:
     *                type: string
     *              memberIdsToAdd:
     *                type: array
     *                items:
     *                  type: string
     *              memberIdsToDeactivate:
     *                type: array
     *                items:
     *                  type: string
     */
    groupsRouter.patch('/:id', async (req, res) => {
      let connection: Connection | null = null;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const groupData = req.body.group;
        const membersToAdd: string[] = req.body.memberIdsToAdd.length ? req.body.memberIdsToAdd : [];
        const membersToDeactivate: string[] = req.body.memberIdsToDeactivate.length ? req.body.memberIdsToDeactivate : [];
        const thresholdsToAdd: string[] = req.body.thresholdIdsToAdd.length ? req.body.thresholdIdsToAdd : [];
        const thresholdsToDeactivate: string[] = req.body.thresholdIdsToDeactivate.length ? req.body.thresholdIdsToDeactivate : [];
        let memberEmailsDeactivated: string = '';
        let thresholdInfoDeactivated: string = '';

        const updateGroupResults: any = await updateGroup(groupId, groupData.groupName.trim(), connection);

        if(membersToAdd.length) {
          const inactiveGroupMembers: any = await findInactiveGroupMembers(groupId, membersToAdd, connection);

          if(inactiveGroupMembers.hasOwnProperty(groupId) && inactiveGroupMembers[groupId].length) {
            await addInactiveGroupMembers(groupId, inactiveGroupMembers[groupId], connection);
            if(inactiveGroupMembers[groupId].length < membersToAdd.length) {
              await addGroupMemberIds(groupId, membersToAdd.filter((member: any) => !inactiveGroupMembers[groupId].includes(member)).map((member: any) => member), connection)
            }
          }
          else {
            await addGroupMemberIds(groupId, membersToAdd, connection)
          }
        } 

        if(membersToDeactivate.length) {
          memberEmailsDeactivated = await getActiveMembers(groupId, connection).then((members: any) => members.filter((m:any)=>membersToDeactivate.includes(m[0])).map((m:any)=>m[1]).join(', '));
          await deactivateGroupMemberIds(groupId, membersToDeactivate, connection)
        }

        if(thresholdsToAdd.length) {
          const inactiveGroupThresholds: any = await findInactiveGroupThresholds(groupId, thresholdsToAdd, connection);

          if(inactiveGroupThresholds.hasOwnProperty(groupId) && inactiveGroupThresholds[groupId].length) {
            await addInactiveGroupThresholds(groupId, inactiveGroupThresholds[groupId], connection);
            if(inactiveGroupThresholds[groupId].length < thresholdsToAdd.length) {
              await addThresholdIds(groupId, thresholdsToAdd.filter((threshold: any) => !inactiveGroupThresholds[groupId].includes(threshold)).map((threshold: any) => threshold), connection)
            }
          }
          else {
            await addThresholdIds(groupId, thresholdsToAdd, connection)
          }
        }

        if(thresholdsToDeactivate.length) {
          thresholdInfoDeactivated = await getActiveThresholds(groupId, connection).then((thresholds: any) => thresholds.filter((t:any)=>thresholdsToDeactivate.includes(t[1])).map((t:any)=>t[2]+'-'+t[3]+'-'+t[4]).join(', '));
          await deactivateThresholdIds(groupId, thresholdsToDeactivate, connection)
        }

        const updatedGroup: any = {
          groupName: groupData,
          groupId: groupId,
          objectId: updateGroupResults.objectId,
          members: groupData.members.filter((member: any) => !membersToDeactivate.includes(member.globalid)),
          thresholds: groupData.thresholds.filter((threshold: any) => !thresholdsToDeactivate.includes(threshold.globalid))
        }

        const memberEmailsAdded = await getActiveMembers(groupId, connection).then((members: any) => members.filter((m:any)=>membersToAdd.includes(m[0])).map((m:any)=>m[1]).join(', '));
        const thresholdInfoAdded = await getActiveThresholds(groupId, connection).then((thresholds: any) => thresholds.filter((t:any)=>thresholdsToAdd.includes(t[1])).map((t:any)=>t[2]+'-'+t[3]+'-'+t[4]).join(', '));
          
        actionLogger.info(`Group Updated: ${groupData.groupName}, members added: ${memberEmailsAdded}, members deactivated: ${memberEmailsDeactivated}, thresholds added: ${thresholdInfoAdded}, thresholds deactivated: ${thresholdInfoDeactivated}`)
        res.json(updatedGroup);
      } catch (err) {
        res.status(502).json({ error: 'DB Connection Error: ' + err});
      } finally {
        if(connection) {
          connection.release((err: any) => {
            if(err) {
              appLogger.error("Error releasing connection: " + err)
            }
          });
        }
      }
    });
  })
  .catch(error => {
    appLogger.error("Error creating connection pool:", error)
  })

function getActiveGroups(connection:any) {
  return new Promise((resolve, reject) => {
    const query = `select groupid, objectid, groupName FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} where ACTIVE <> 0`
    connection.execute(query, [], (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result.rows)
      }
    });
  })
}

function findInactiveGroup(groupName: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select groupid, objectid, groupName FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} where groupName=:groupName and ACTIVE = 0`
    connection.execute(query, {groupName}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result.rows)
      }
    });
  });
}

function addInactiveGroup(inactiveGroup: any, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} set ACTIVE=1 where GROUPID=:GROUPID`
    connection.execute(query, {GROUPID: inactiveGroup[0]}, {autoCommit: true}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        inactiveGroup.ACTIVE = 1;
        resolve(inactiveGroup);
      }
    })
  })

}

function getMemberIds(groupIds: string[], connection: Connection) {
  const namedParams = groupIds.map((id: string, index: any) => `:groupId${index}`).join(','); 
  const bindParams: any = {}
  groupIds.forEach((id, index) => { bindParams[`groupId${index}`] = id});
  return new Promise((resolve, reject) => {
    const query = `select USER_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID IN (${namedParams}) and ACTIVE <> 0`

    connection.execute(query, bindParams, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const membersMap: any = {};
        result.rows.forEach((row: any) => {
          if(!membersMap[row[1]]) {
            membersMap[row[1]] = [];
          }
          membersMap[row[1]].push(row[0]);
        });
        resolve(membersMap)
      }
    });
  })
}

function getThresholdIds(groupIds: string[], connection: Connection) {
  const namedParams = groupIds.map((id: string, index: any) => `:groupId${index}`).join(','); 
  const bindParams: any = {}
  groupIds.forEach((id, index) => { bindParams[`groupId${index}`] = id});
  return new Promise((resolve, reject) => {
    const query = `select THRSHLD_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} where GROUP_ID IN (${namedParams}) and ACTIVE <> 0`

    connection.execute(query, bindParams, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const thresholdsMap: any = {};
        result.rows.forEach((row: any) => {
          if(!thresholdsMap[row[1]]) {
            thresholdsMap[row[1]] = [];
          }
          thresholdsMap[row[1]].push(row[0]);
        });
        resolve(thresholdsMap)
      }
    });
  })
}

function addGroup(groupName: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} (OBJECTID, GROUPNAME, GROUPID, ACTIVE) values (sde.gdb_util.next_rowid('${WQIMS_DB_CONFIG.username}', '${WQIMS_DB_CONFIG.notificationGrpsTbl}'), :groupName, sde.gdb_util.next_globalid(), 1) returning GROUPID, OBJECTID into :outGid, :outOid`;

    const options = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING},
        {type: OracleDB.NUMBER}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, 
    {
      groupName: groupName,
      outGid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
      outOid: {type: OracleDB.NUMBER, dir: OracleDB.BIND_OUT},
    },
    options,
    (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const ids = result.outBinds as any;
        const resultRecord: any = {
          GROUPNAME: groupName,
          GROUPID: ids.outGid?.[0],
          OBJECTID: ids.outOid?.[0],
          MEMBERS: [],
          THRESHOLDS: []
        }
        resolve(resultRecord);
      }
    });
  })
}

function addGroupMemberIds(groupId: string, memberIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} (USER_ID, GROUP_ID, ACTIVE) values (:memberId, :groupId, 1)`
    const binds = memberIds.map((memberId) => [memberId, groupId]);
    const options: any = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.executeMany(query, binds, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function deactivateGroupMemberIds(groupId: string, memberIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} set ACTIVE=0 where GROUP_ID=:groupId and USER_ID=:memberId `
    const binds = memberIds.map((memberId) => [groupId, memberId]);
    const options: any = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.executeMany(query, binds, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function updateGroup(groupId: string, groupName: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} set GROUPNAME=:groupName where GROUPID=:groupId`
    connection.execute(query, { groupName, groupId }, {autoCommit: true}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function addThresholdIds(groupId: string, thresholdIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} (THRSHLD_ID, GROUP_ID, ACTIVE) values (:thresholdId, :groupId, 1)`
    const binds = thresholdIds.map((thresholdId) => [thresholdId, groupId]);
    const options: any = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.executeMany(query, binds, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function deactivateThresholdIds(groupId: string, thresholdIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} set ACTIVE=0 where GROUP_ID=:groupId and THRSHLD_ID=:thresholdId`
    const binds = thresholdIds.map((thresholdId) => [groupId, thresholdId]);
    const options: any = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.executeMany(query, binds, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function findInactiveGroupMembers(groupId: string, memberIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select USER_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID=:groupId and USER_ID in (${memberIds.map((id: string, index: any) => `:memberId${index}`).join(',')}) and ACTIVE = 0`
    const bindParams: any = {groupId}
    memberIds.forEach((id, index) => { bindParams[`memberId${index}`] = id});
    connection.execute(query, bindParams, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const membersMap: any = {};
        result.rows.forEach((row: any) => {
          if(!membersMap[row[1]]) {
            membersMap[row[1]] = [];
          }
          membersMap[row[1]].push(row[0]);
        });
        resolve(membersMap)
      }
    });
  })
}

function findInactiveGroupThresholds(groupId: string, thresholdIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select THRSHLD_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} where GROUP_ID=:groupId and THRSHLD_ID in (${thresholdIds.map((id: string, index: any) => `:thresholdId${index}`).join(',')}) and ACTIVE = 0`
    const bindParams: any = {groupId}
    thresholdIds.forEach((id, index) => { bindParams[`thresholdId${index}`] = id});
    connection.execute(query, bindParams, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const thresholdsMap: any = {};
        result.rows.forEach((row: any) => {
          if(!thresholdsMap[row[1]]) {
            thresholdsMap[row[1]] = [];
          }
          thresholdsMap[row[1]].push(row[0]);
        });
        resolve(thresholdsMap)
      }
    });
  })
}

function addInactiveGroupMembers(groupId: string, memberIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} set ACTIVE=1 where GROUP_ID=:groupId and USER_ID in (${memberIds.map((id: string, index: any) => `:memberId${index}`).join(',')})`
    const bindParams: any = {groupId}
    memberIds.forEach((id, index) => { bindParams[`memberId${index}`] = id});
    connection.execute(query, bindParams, {autoCommit: true}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

// adds group of inactive thresholds that will be reactivated to the specified group
function addInactiveGroupThresholds(groupId: string, thresholdIds: string[], connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} set ACTIVE=1 where GROUP_ID=:groupId and THRSHLD_ID in (${thresholdIds.map((id: string, index: any) => `:thresholdId${index}`).join(',')})`
    const bindParams: any = {groupId}
    thresholdIds.forEach((id, index) => { bindParams[`thresholdId${index}`] = id});
    connection.execute(query, bindParams, {autoCommit: true}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

// gets specified inactive threshold in groups 
function findInactiveThresholdInGroups(groupIds: string[], thresholdId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select THRSHLD_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} where GROUP_ID in (${groupIds.map((id: string, index: any) => `:groupId${index}`).join(',')}) and THRSHLD_ID=:thresholdId and ACTIVE = 0`

    const bindParams: any = {thresholdId}
    groupIds.forEach((id, index) => { bindParams[`groupId${index}`] = id});
    connection.execute(query, bindParams, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        const groupsMap: any = {};
        result.rows.forEach((row: any) => {
          if(!groupsMap[row[1]]) {
            groupsMap[row[1]] = [];
          }
          groupsMap[row[1]].push(row[0]);
        });
        resolve(groupsMap)
      }  
    })
  })
}

// adds the inactive threshold to specified groups
function addInactiveThresholdInGroups(groupIds: string[], thresholdId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} set ACTIVE=1 where GROUP_ID in (${groupIds.map((id: string, index: any) => `:groupId${index}`).join(',')}) and THRSHLD_ID=:thresholdId`

    const bindParams: any = {thresholdId}
    groupIds.forEach((id, index) => { bindParams[`groupId${index}`] = id});
    connection.execute(query, bindParams, {autoCommit: true}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result)
      }
    })
  })
}

function addThresholdIdToGroups(groupIds: string[], thresholdId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} (THRSHLD_ID, GROUP_ID, ACTIVE) values (:thresholdId, :groupId, 1)`
    const binds = groupIds.map((groupId) => [thresholdId, groupId]);
    const options: any = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING, maxSize: 38},
        {type: OracleDB.STRING, maxSize: 38}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.executeMany(query, binds, options, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result);
      }
    })
  })
}

function getActiveMembers(groupId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select
                    ug.USER_ID,
                    u.EMAIL
                    from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} ug
                    join ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.usersTbl} u on ug.USER_ID = u.GLOBALID
                    where ug.GROUP_ID = :groupId and ug.ACTIVE <> 0`;
    connection.execute(query, {groupId}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result.rows)
      }
    });
  })
}

function getActiveThresholds(groupId: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    const query = `select
                    tg.THRSHLD_ID,
                    t.GLOBALID, t.ANALYTE, t.UPPER_LOWER_SPECS, t.LOCATION_CODE
                    from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} tg
                    join ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.thresholdTbl} t on tg.THRSHLD_ID = t.GLOBALID
                    where tg.GROUP_ID = :groupId and tg.ACTIVE <> 0`;
    connection.execute(query, {groupId}, (err: any, result: any) => {
      if(err) {
        appLogger.error("Error executing query:", err);
        reject(err)
      }
      else {
        resolve(result.rows)
      }
    });
  })
}
export default groupsRouter; 