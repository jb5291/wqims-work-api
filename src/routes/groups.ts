import express from 'express';
import OracleDB from 'oracledb';

import { WQIMS_DB_CONFIG } from "../util/secrets";
import { appLogger } from '../util/appLogger';

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
 *    IGroupData:
 *      type: array
 *      items:
 *        - type: string
 *        - type: string
 *        - type: integer
 *        - type: array
 *          items:
 *          - type: string
 */

OracleDB.createPool(dbConf)
  .then(pool => {
    appLogger.info('Connection pool created');

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
     *                $ref: '#/components/schemas/IGroupData'
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.get('/', async (req, res) => {
      let connection;
      try {
        connection = await pool.getConnection();

        const groupDataResult: any = await getGroups(connection);
        const groupIds = groupDataResult.map((row: any) => row[0]);

        const memberIdsResult: any = await getMemberIds(groupIds, connection);

        const groups: any = groupDataResult.map((group: any) => ({
          groupId: group[0],
          objectId: group[1],
          groupName: group[2],
          members: memberIdsResult[group[0]] || []
        }));
        
        res.json(groups);
      }
      catch (err) {
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
     *    description: adds a group from DSNGIST wqims.notificationGroups
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
     *              memberIds:
     *                type: array
     *                items:
     *                  - type: string
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
      let connection;
      try {
        connection = await pool.getConnection();

        const groupData = req.body.groupName;
        const memberData: string[] = req.body.memberIds.length ? req.body.memberIds : [];

        const addGroupResults: any = await addGroup(groupData, connection);

        const addedGroup: any = {
          groupName: groupData,
          groupId: addGroupResults.groupId,
          objectId: addGroupResults.objectId,
          members: []
        }

        if(memberData.length) {
          const addMemberResults: any = await addGroupMemberIds(addedGroup.groupId, memberData, connection)

          addedGroup.members = addMemberResults;
        } 
          
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
     * /notificationGroups/{groupId}:
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
    groupsRouter.put('/:id', async (req, res) => {
      let connection;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const memberData: string[] = req.body.memberIds.length ? req.body.memberIds : [];

        const addMemberResults: any = await addGroupMemberIds(groupId, memberData, connection)
          
        res.json(addMemberResults);
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
      let connection;
      try {
        connection = await pool.getConnection();
        const groupId = req.params.id.toUpperCase();
    
        const deleteGrpExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} where groupid = '${groupId}'`;
        const deleteUsrGrpsExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID = '${groupId}'`;
        // const deleteThrshldGrpsExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} where groupId = '${groupId}'`;

        const deleteGrpResult = await connection.execute(deleteGrpExpr)
        const deleteUsrGrpsResult = await connection.execute(deleteUsrGrpsExpr);
        // const deleteThrshldGrpsResult = await connection.execute(deleteThrshldGrpsExpr);
        

        connection.commit();
        res.json([deleteGrpResult, deleteUsrGrpsResult]);
      }
      catch (err) {
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
     * /notificationGroups/{groupId}:
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
    groupsRouter.post('/:id', async (req, res) => {
      let connection;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const memberData: string[] = req.body.memberIds.length ? req.body.memberIds : [];

        const deleteMemberResults: any = await removeGroupMemberIds(groupId, memberData, connection)
          
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
     *              memberIdsToDelete:
     *                type: array
     *                items:
     *                  type: string
     */
    groupsRouter.patch('/:id', async (req, res) => {
      let connection;
      try {
        connection = await pool.getConnection();

        const groupId = req.params.id;
        const groupData = req.body.groupName;
        const membersToAdd: string[] = req.body.memberIdsToAdd.length ? req.body.memberIdsToAdd : [];
        const membersToDelete: string[] = req.body.memberIdsToDelete.length ? req.body.memberIdsToDelete : [];

        const updateGroupResults: any = await updateGroup(groupId, groupData, connection);
        let addedMemberResults: any = [];
        let deletedMemberResults: any = [];

        const updatedGroup: any = {
          groupName: groupData,
          groupId: groupId,
          objectId: updateGroupResults.objectId,
          members: []
        }

        if(membersToAdd.length) {
          addedMemberResults = await addGroupMemberIds(groupId, membersToAdd, connection)
        } 

        if(membersToDelete.length) {
          deletedMemberResults = await removeGroupMemberIds(groupId, membersToDelete, connection)
        }
          
        res.json([updatedGroup, addedMemberResults, deletedMemberResults]);
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
  })
  .catch(error => {
    appLogger.error("Error creating connection pool:", error)
  })

function getGroups(connection:any) {
  return new Promise((resolve, reject) => {
    const query = `select groupid, objectid, groupName FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl}`
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

function getMemberIds(groupIds: string[], connection: any) {
  const namedParams = groupIds.map((id: string, index: any) => `:groupId${index}`).join(','); 
  const bindParams: any = {}
  groupIds.forEach((id, index) => { bindParams[`groupId${index}`] = id});
  return new Promise((resolve, reject) => {
    const query = `select USER_ID, GROUP_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID IN (${namedParams})`

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

function addGroup(groupName: string, connection: any) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} (OBJECTID, GROUPNAME, GROUPID) values (sde.gdb_util.next_rowid('${WQIMS_DB_CONFIG.username}', '${WQIMS_DB_CONFIG.notificationGrpsTbl}'), :value1, sde.gdb_util.next_globalid()) returning GROUPID, OBJECTID into :outGid, :outOid`;

    const options = {
      autoCommit: true,
      bindDefs: [
        {type: OracleDB.STRING},
        {type: OracleDB.STRING}
      ],
      outFormat: OracleDB.OUT_FORMAT_OBJECT
    }
    connection.execute(query, 
    {
      value1: groupName,
      outGid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
      outOid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
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
          groupName: groupName,
          groupId: ids.outGid?.[0],
          objectId: ids.outOid?.[0],
          members: []
        }
        resolve(resultRecord);
      }
    });
  })
}

function addGroupMemberIds(groupId: string, memberIds: string[], connection: any) {
  return new Promise((resolve, reject) => {
    const query = `insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} (USER_ID, GROUP_ID) values (:memberId, :groupId)`
    const binds = memberIds.map((memberId) => [memberId, groupId]);
    const options = {
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

function removeGroupMemberIds(groupId: string, memberIds: string[], connection: any) {
  return new Promise((resolve, reject) => {
    const query = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID=:groupId and USER_ID=:memberId`
    const binds = memberIds.map((memberId) => [groupId, memberId]);
    const options = {
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

function updateGroup(groupId: string, groupName: string, connection: any) {
  return new Promise((resolve, reject) => {
    const query = `update ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} set GROUPNAME=:groupName where GROUPID=:groupId`
    connection.execute(query, { groupName, groupId }, (err: any, result: any) => {
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
export default groupsRouter; 