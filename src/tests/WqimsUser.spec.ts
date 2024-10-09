import { addFeatures, deleteFeatures, IQueryFeaturesResponse, IQueryResponse, queryFeatures, queryRelated, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { appLogger } from "../util/appLogger";
import { WqimsUser } from "../models/WqimsUser";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";

jest.mock("@esri/arcgis-rest-feature-service");
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

      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { ...inactiveUser,  ACTIVE: 1 } }] } as IQueryFeaturesResponse);
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }]});

      inactiveUser.checkInactive();

      expect(queryFeatures).toHaveBeenCalledTimes(1);
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

      (queryFeatures as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(inactiveUser.checkInactive()).rejects.toThrow("Error getting data");
    });
  })

  describe("getRoleIds", () => {
    it("should return a list of Wqims Roles", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { ROLEID: 1, ROLE: "Admin" } }] } as IQueryFeaturesResponse);

      const roles = await mockUser.getRoleIds();

      expect(roles).toEqual([{ ROLEID: 1, ROLE: "Admin" }]);
    })

    it("should return an error if no role features are found", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [] } as IQueryFeaturesResponse);

      await expect(mockUser.getRoleIds()).rejects.toThrow("No features found");
    });

    it("should return an error if query features throws an error", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(mockUser.getRoleIds()).rejects.toThrow("Error getting data");
    });
  })

  describe("updateUserRole", () => {
    beforeEach(() => {
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecords: [] });
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1 }] });
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }] });
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] } as IQueryFeaturesResponse);

      mockUser.ROLE = "Admin";
    });

    it("should update the user's role", async () => {
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecords: [{ attributes: { RID: 1 } }] });
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }] });
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { RID: 1, ROLE: "Admin" } }] } as IQueryFeaturesResponse);
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1 }] });

      const result = await mockUser.updateUserRole();

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should return an error if the query fails", async () => {
      (queryRelated as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(mockUser.updateUserRole()).rejects.toThrow("Error getting data");
    });

    it("should return an error if the update fails", async () => {
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecords: [{ attributes: { RID: 1 } }] });
      (updateFeatures as jest.Mock).mockRejectedValue(new Error("Update failed"));

      await expect(mockUser.updateUserRole()).rejects.toThrow("Update failed");
    });

    it("should return an error if the add fails", async () => {
      (queryFeatures as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] }))
        .mockImplementationOnce(() => Promise.resolve({ features: []}));
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecordGroups: [] });
      (addFeatures as jest.Mock).mockRejectedValue(new Error("Add failed"));

      await expect(mockUser.updateUserRole()).rejects.toThrow("Add failed");
    });

    it("should return an error if the query related fails", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: []});
      (queryRelated as jest.Mock).mockRejectedValue(new Error("Error getting data"));

      await expect(mockUser.updateUserRole()).rejects.toThrow("Error getting data");
    });

    it('should return an error if an invalid role is provided', async () => {
      mockUser.ROLE = "Invalid";

      await expect(mockUser.updateUserRole()).rejects.toThrow("Invalid role");
    })

    it('should return an error if the update features is unsuccessful', async () => {
      (queryFeatures as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ features: [{ attributes: { RID: null, ROLE: "Editor" } }] }))
        .mockImplementationOnce(() => Promise.resolve({ features: [{ attributes: { RID: 1, ROLE: "Admin" } }] }));
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecordGroups: [] });
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: false }] });

      await expect(mockUser.updateUserRole()).rejects.toThrow("Update failed");
    })

    it('should return an error if the role id RID is invalid', async () => {
      (queryFeatures as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ features: [{ attributes: { RID: null, ROLE: "Editor" } }] }))
        .mockImplementationOnce(() => Promise.resolve({ features: [{ attributes: { RID: null, ROLE: "Admin" } }] }));
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecordGroups: [] });
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: false }] });

      await expect(mockUser.updateUserRole()).rejects.toThrow("No RID found");
    })
  })

  describe("removeRelationship", () => {
    it("should remove the relationship", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { RID: 1, ROLE: "Editor" } }] } as IQueryFeaturesResponse);
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: true }] });

      const result = await mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl);

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should return an error if the delete fails", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ attributes: { RID: 1, ROLE: "Editor" }, objectIds: [1] }  as IQueryResponse);
      (deleteFeatures as jest.Mock).mockRejectedValue(new Error("Delete failed"));

      await expect(mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl)).rejects.toThrow("Delete failed");
    });

    it("should return an error if the delete operation is unsuccessful", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ attributes: { RID: 1, ROLE: "Editor" }, objectIds: [1] }  as IQueryResponse);
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: false }] });

      await expect(mockUser.removeRelationship(WqimsUser.groupsRelationshipClassUrl)).rejects.toThrow("Delete failed");
    })
  })
})