import { IQueryResponse } from "@esri/arcgis-rest-feature-service";
import { WqimsUser } from "../models/WqimsUser";
import { ArcGISService } from "../services/ArcGISService";
import axios from "axios";

jest.mock("../services/ArcGISService");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");
jest.mock('../util/secrets', () => ({
  authConfig: {
    arcgis: {
      username: 'test-user',
      password: 'test-pass',
      token_url: 'https://gisdev.wsscwater.com/portal/sharing/rest/generateToken',
      feature_url: 'https://gisdev.wsscwater.com/gis/rest/services/WQIMS/WQIMS_Tables/FeatureServer',
      layers: {
        users: '2',
        roles: '7',
        groups: '4',
        userroles_rel_id: '3',
        usergroups_rel_id: '2'
      }
    },
    everbridge: {
      username: 'test',
      password: 'test',
      organization_id: '123',
      rest_url: 'http://test.com',
      record_id: '1',
      sms_id: '1',
      email_id: '1'
    }
  }
}));

// Also mock axios at the top of the file
jest.mock('axios', () => ({
  request: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: { token: 'test-token', expires: 60 } })
}));

describe("WqimsUser", () => {
  let mockUser = new WqimsUser({
    NAME: "Test User",
    DEPARTMENT: "test",
    POSITION: "test",
    DIVISION: "test",
    PHONENUMBER: "1234567890",  // String format
    EMAIL: "test@wsscwater.com",
    ROLE: "Editor",
    RAPIDRESPONSETEAM: 0,
    SECONDARYPHONENUMBER: "1234567890",  // String format
    STARTTIME: "8:30 AM",
    ENDTIME: "5:00 PM",
    ACTIVE: 1,
    OBJECTID: 1,
    GLOBALID: "test-guid"
  });

  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("checkInactive", () => {
    it("should return a reactivated user", async () => {
      const inactiveUser = new WqimsUser({
        NAME: "test",
        DEPARTMENT: "test",
        POSITION: "test",
        DIVISION: "test",
        PHONENUMBER: 1234567890,
        EMAIL: "test@wsscwater.com",
        ROLE: "Editor",
        RAPIDRESPONSETEAM: 0,
        SECONDARYPHONENUMBER: 1234567890,
        STARTTIME: "8:30 AM",
        ENDTIME: "5:00 PM",
        ACTIVE: 0,
        OBJECTID: 1,
        GLOBALID: "test",
      });

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ 
        features: [{ attributes: { ...inactiveUser, ACTIVE: 1 } }] 
      });
      
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ 
        updateResults: [{ objectId: 1, success: true }]
      });

      await inactiveUser.checkInactive();

      expect(ArcGISService.request).toHaveBeenCalledTimes(2);
    })

    it("should return an error if the query fails", async () => {
      const inactiveUser = new WqimsUser({
        NAME: "test",
        DEPARTMENT: "test",
        POSITION: "test",
        DIVISION: "test",
        PHONENUMBER: 1234567890,
        EMAIL: "test.com",
        ROLE: "Editor",
        RAPIDRESPONSETEAM: 0,
        SECONDARYPHONENUMBER: 1234567890,
        STARTTIME: "8:30 AM",
        ENDTIME: "5:00 PM",
        ACTIVE: 0,
        OBJECTID: 1,
        GLOBALID: "test",
      });

      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(inactiveUser.checkInactive()).rejects.toThrow("Error getting data");
    });

    it("should handle case when no inactive user is found", async () => {
      const inactiveUser = new WqimsUser({
        NAME: "test",
        DEPARTMENT: "test",
        POSITION: "test",
        DIVISION: "test",
        PHONENUMBER: 1234567890,
        EMAIL: "test@wsscwater.com",
        ROLE: "Editor",
        RAPIDRESPONSETEAM: 0,
        SECONDARYPHONENUMBER: 1234567890,
        STARTTIME: "8:30 AM",
        ENDTIME: "5:00 PM",
        ACTIVE: 0,
        OBJECTID: 1,
        GLOBALID: "test",
      });

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ 
        features: [] // No inactive user found
      });

      const result = await inactiveUser.checkInactive();
      expect(result).toEqual({ 
        objectId: -1,
        success: false,
        error: {
          code: 999,
          description: "No inactive record found"
        }
      });
    });

    it("should set PHONENUMBER to 'none' if not provided", async () => {
      const inactiveUser = new WqimsUser({
        NAME: "test",
        DEPARTMENT: "test",
        POSITION: "test",
        DIVISION: "test",
        PHONENUMBER: undefined,
        EMAIL: "test@wsscwater.com",
        ROLE: "Editor",
        RAPIDRESPONSETEAM: 0,
        SECONDARYPHONENUMBER: 1234567890,
        STARTTIME: "8:30 AM",
        ENDTIME: "5:00 PM",
        ACTIVE: 0,
        OBJECTID: 1,
        GLOBALID: "test",
      });

      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: [{ attributes: { GLOBALID: 'test-id', ACTIVE: 1 } }] })
        .mockResolvedValueOnce({ updateResults: [{ objectId: 1, success: true }] });

      await inactiveUser.checkInactive();
      expect(inactiveUser.PHONENUMBER).toBe('none');
    });
  })

  describe("getRoleIds", () => {
    it("should return a list of Wqims Roles", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValue({ features: [{ attributes: { ROLEID: 1, ROLE: "Admin" } }] });

      const roles = await mockUser.getRoleIds();

      expect(roles).toEqual([{ ROLEID: 1, ROLE: "Admin" }]);
    })

    it("should return an error if no role features are found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValue({ features: [] });

      await expect(mockUser.getRoleIds()).rejects.toThrow("No features found");
    });

    it("should return an error if query features throws an error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(mockUser.getRoleIds()).rejects.toThrow("Error getting data");
    });
  })

  describe("updateUserRole", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockUser.ROLE = "Admin";
    });

    it("should update the user's role", async () => {
      // Mock the sequence of API calls
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [{ relatedRecords: [{ attributes: { RID: 1 } }] }] }) // queryRelatedRecords
        .mockResolvedValueOnce({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] }) // queryFeatures for roles
        .mockResolvedValueOnce({ features: [{ attributes: { RID: 1, ROLE: "Admin" } }] }) // getRoleIds
        .mockResolvedValueOnce({ updateResults: [{ objectId: 1, success: true }] }); // updateFeatures

      const result = await mockUser.updateUserRole();
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it('should return an error if an invalid role is provided', async () => {
      mockUser.ROLE = "Invalid";
      await expect(mockUser.updateUserRole()).rejects.toEqual("Invalid role");
    });

    it('should return an error if the update features is unsuccessful', async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [{ relatedRecords: [{ attributes: { RID: 1 } }] }] })
        .mockResolvedValueOnce({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] })
        .mockResolvedValueOnce({ features: [{ attributes: { ROLE: "admin", GLOBALID: "test-id" } }] })
        .mockResolvedValueOnce({ updateResults: [{ objectId: 1, success: false }] });

      await expect(mockUser.updateUserRole()).rejects.toThrow("Update failed");
    });

    it('should return an error if the role id RID is invalid', async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [{ relatedRecords: [{ attributes: { RID: null } }] }] })
        .mockResolvedValueOnce({ features: [{ attributes: { RID: null, ROLE: "Editor" } }] })
        .mockResolvedValueOnce({ features: [{ attributes: { ROLE: "admin", GLOBALID: "test-id" } }] });

      await expect(mockUser.updateUserRole()).rejects.toThrow("No RID found");
    });

    it("should handle case when no related records exist", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [] }) // queryRelatedRecords
        .mockResolvedValueOnce({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] }) // queryFeatures
        .mockResolvedValueOnce({ features: [{ attributes: { ROLE: "admin", GLOBALID: "test-id" } }] }) // getRoleIds
        .mockResolvedValueOnce({ updateResults: [{ objectId: 1, success: true }] }); // updateFeatures

      const result = await mockUser.updateUserRole();
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should handle add feature failure", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [] })
        .mockResolvedValueOnce({ features: [] })
        .mockResolvedValueOnce({ features: [{ attributes: { ROLE: "admin", GLOBALID: "test-id" } }] })
        .mockResolvedValueOnce({ 
          addResults: [{ 
            objectId: 1, 
            success: false, 
            error: { description: "Add failed" } 
          }]
        });

      await expect(mockUser.updateUserRole())
        .rejects.toEqual("Add failed");
    });

    it("should handle case when role matches existing role", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ 
          relatedRecordGroups: [{ 
            relatedRecords: [{ 
              attributes: { ROLE: "admin" } 
            }] 
          }] 
        });

      mockUser.ROLE = "Admin";
      const result = await mockUser.updateUserRole();
      expect(result).toEqual({ objectId: mockUser.OBJECTID, success: true });
    });
  })

  describe("removeRelationship", () => {
    it("should remove the relationship", async () => {
      const mockFeatures = [{ attributes: { RID: 1, ROLE: "Editor" } }];
      
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: mockFeatures }) // First call: query
        .mockResolvedValueOnce({ deleteResults: [{ objectId: 1, success: true }] }); // Second call: delete

      const result = await mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl);
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should return an error if the delete operation is unsuccessful", async () => {
      const mockFeatures = [{ attributes: { RID: 1, ROLE: "Editor" } }];
      
      // Need to reset the mock between tests
      jest.clearAllMocks();
      
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: mockFeatures }) // First call: query
        .mockResolvedValueOnce({ deleteResults: [{ objectId: 1, success: false }] }); // Second call: delete with failure

      await expect(mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl))
        .rejects.toThrow("Delete failed");
    });

    it("should return an error if no features are found", async () => {
      jest.clearAllMocks();
      
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: [] }); // Empty features array

      await expect(mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl))
        .rejects.toThrow("No features found");
    });
  })

  describe("Everbridge operations", () => {
    beforeEach(() => {
      jest.spyOn(axios, 'request').mockResolvedValue({ data: {} });
      // Create a new mock user with string phone numbers
      mockUser = new WqimsUser({
        NAME: "Test User",  // Make sure it has first and last name
        DEPARTMENT: "test",
        POSITION: "test",
        DIVISION: "test",
        PHONENUMBER: "1234567890",  // String format
        EMAIL: "test@wsscwater.com",
        ROLE: "Editor",
        RAPIDRESPONSETEAM: 0,
        SECONDARYPHONENUMBER: "1234567890",  // String format
        STARTTIME: "8:30 AM",
        ENDTIME: "5:00 PM",
        ACTIVE: 1,
        OBJECTID: 1,
        GLOBALID: "test-guid"
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should add contact to Everbridge", async () => {
      await mockUser.addEverbridgeContact();
      expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        data: expect.objectContaining({
          firstName: 'Test',
          lastName: 'User'
        })
      }));
    });

    it("should delete contact from Everbridge", async () => {
      await mockUser.deleteEverbridgeContact();
      expect(axios.request).toHaveBeenCalled();
    });

    it("should update contact in Everbridge", async () => {
      await mockUser.updateEverbridgeContact();
      expect(axios.request).toHaveBeenCalled();
    });

    it("should handle time parsing edge cases", async () => {
      mockUser.STARTTIME = "12:00 PM";
      mockUser.ENDTIME = "12:00 AM";
      
      await mockUser.updateEverbridgeContact();
      expect(axios.request).toHaveBeenCalled();
      
      const requestData = (axios.request as jest.Mock).mock.calls[0][0].data;
      expect(requestData.paths[0].quietTimeFrames[0].fromHour).toBe(0); // 12 AM = 0
      expect(requestData.paths[0].quietTimeFrames[0].toHour).toBe(12); // 12 PM = 12
    });
  });

  describe("getUser", () => {
    it("should return null when user is not found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ 
        features: [] 
      });

      const result = await WqimsUser.getUser(999);
      expect(result).toBeNull();
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Query failed"));

      await expect(WqimsUser.getUser(999)).rejects.toThrow("Query failed");
    });
  });
})