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
 *      example:
 *        - ["group 1", "{01298aff-0e18-093d-01c9-740284ba098d}", 736]
 *        - ["group 2", "{23243d98-8c99-4cf7-9683-9404ac69e1a3}", 737]
 *    UserData:
 *      type: array
 *      items:
 *        - type: integer
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: string
 *        - type: integer
 *        - type: string
 *        - type: string
 *          nullable: true
 *        - type: string
 *          nullable: true
 *      example:
 *        - [1, "{D6C20167-1934-499C-BD60-20AA99C4145F}", "Bob", "Logistics", "Water", "2225554646", "bob@test.com", "Admin", 0, "tmobile", null, null]
 */

OracleDB.createPool(dbConf)
  .then(pool => {
    appLogger.info('Connection pool created');

    /**
     * @swagger
     * /notificationGroups:
     *  get:
     *    summary: Get list of groups
     *    description: Gets a list of groups from DSNGIST wqims.notificationGroups
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
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        }
    
        conn.execute(`select groupName, groupid, objectid FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl}`, [], (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(502).send('DB Connection Error');
          }
          res.json(result.rows);
    
          conn.release();
        });
      });
    });
    
    /**
     * @swagger
     * /notificationGroups/{groupId}:
     *  get:
     *    summary: Get list of members for group id
     *    description: Gets a list of members from DSNGIST wqims.users_groups, and returns users from wqims.users
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
     *        description: a list of group members
     *        content:
     *          application/json:
     *            schema:
     *              type: array
     *              items:
     *                memberId: string
     *      '502':
     *        description: Bad Gateway
     *        content:
     *          application/json:
     *            schema:
     *              type: string
     *              example: 'Bad Gateway: DB Connection Error'
     */
    groupsRouter.get('/:id', async (req, res) => {
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        }
        const groupId = req.params.id;

        conn.execute(`select USER_ID FROM ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where GROUP_ID=:groupId`,
        {
          groupId: groupId
        },
        { autoCommit: true },
        (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(502).send('DB Connection Error');
          }
          res.json(result.rows);

          conn.release();
        });
      });   
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
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        }
        const bodyData = req.body.groupname
        //console.log(req)
        conn.execute(`insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} (OBJECTID, GROUPNAME, GROUPID) values (sde.gdb_util.next_rowid('wqims', 'notificationGroups'), :value1, sde.gdb_util.next_globalid()) returning GROUPID, OBJECTID into :outGid, :outOid`, 
        {
          value1: bodyData,
          outGid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
          outOid: {type: OracleDB.STRING, dir: OracleDB.BIND_OUT},
        }, 
        { autoCommit: true},
        (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(502).send('DB Connection Error');
          }
          let ids = result.outBinds as any;
          const resultRecord: any = {
            groupName: bodyData,
            groupId: ids.outGid?.[0],
            objectId: ids.outOid?.[0],
            members: []
          }
          conn.release();
          return res.status(201).send(resultRecord);
        });
      });
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
     *              memberId:
     *                type: string
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
      pool.getConnection((err, conn) => {
        if(err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        }
        const groupId = req.params.id;
        const bodyData = req.body.memberId
        conn.execute(`insert into ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} (USER_ID, GROUP_ID, RID) values (:memberId, :groupId, sde.gdb_util.next_rowid('${WQIMS_DB_CONFIG.username}', '${WQIMS_DB_CONFIG.notificationGrpMembersTbl}'))`,
        {
          memberId: bodyData,
          groupId: groupId
        },
        { autoCommit: true },
        (err, result) => {
          if(err) {
            appLogger.error("Error executing query:", err);
            return res.status(502).send('DB Connection Error');
          }
          conn.release();
          return res.status(201).send(`User: ${bodyData} added to group: ${groupId}`)
        });
      });
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
     *      - in: query
     *        name: memberId
     *        schema:
     *          type: string
     *        description: member ID of the member
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
      if(req.query.hasOwnProperty('memberId')) {
        pool.getConnection((err, conn) => {
          if(err) {
            appLogger.error('Error getting connection: ', err);
            return res.status(502).send('DB Connection Error');
          }
          const groupId = req.params.id;
          const memberId = req.query.memberId as any;
          conn.execute(`delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where USER_ID=:memberId`,
          {
            memberId: memberId
          },
          { autoCommit: true },
          (err, result) => {
            if(err) {
              appLogger.error("Error executing query:", err);
              return res.status(502).send('DB Connection Error');
            }
            conn.release();
            return res.status(201).send(`User: ${memberId} deleted from group: ${groupId}`)
          });
        });
      } 
      else {
        try {
          const conn = await pool.getConnection();
          const groupId = req.params.id.toUpperCase();
      
          const deleteGrpExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpsTbl} where groupid = '${groupId}'`;
          const deleteUsrGrpsExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpMembersTbl} where groupId = '${groupId}'`;
          // const deleteThrshldGrpsExpr = `delete from ${WQIMS_DB_CONFIG.username}.${WQIMS_DB_CONFIG.notificationGrpThrshldTbl} where groupId = '${groupId}'`;
  
          const deleteGrpResult = await conn.execute(deleteGrpExpr)
          const deleteUsrGrpsResult = await conn.execute(deleteUsrGrpsExpr);
          // const deleteThrshldGrpsResult = await conn.execute(deleteThrshldGrpsExpr);
          
          conn.commit();
          conn.release();
          return res.status(200).send(`Group deleted successfully: ${groupId}`)
        } catch (err) {
          appLogger.error('Error getting connection: ', err);
          return res.status(502).send('DB Connection Error');
        } 
      }
    });
  })
  .catch(error => {
    appLogger.error("Error creating connection pool:", error)
  })

export default groupsRouter; 