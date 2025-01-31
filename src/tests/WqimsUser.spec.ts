import { IQueryResponse } from "@esri/arcgis-rest-feature-service";
import { WqimsUser } from "../models/WqimsUser";
import { ArcGISService } from "../services/ArcGISService";

jest.mock("../services/ArcGISService");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");

describe("WqimsUser", () => {
  const mockUser = new WqimsUser({
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
    ACTIVE: 1,
    OBJECTID: 1,
    GLOBALID: "test",
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
})