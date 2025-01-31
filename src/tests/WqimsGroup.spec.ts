import { addFeatures, deleteFeatures, IFeature, IQueryFeaturesResponse, queryFeatures, queryRelated, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { WqimsGroup } from "../models/WqimsGroup";
import { authConfig } from "../util/secrets";
import { WqimsUser } from "../models/WqimsUser";
import { WqimsThreshold } from "../models/WqimsThreshold";
import { ArcGISService } from "../services/ArcGISService";

// Mock all external dependencies
jest.mock("../services/ArcGISService");
jest.mock("../util/appLogger");
jest.mock("../util/secrets", () => ({
  authConfig: {
    arcgis: {
      feature_url: 'https://gisdev.wsscwater.com/gis/rest/services/WQIMS/WQIMS_Tables/FeatureServer',
      layers: {
        users: '2',
        thresholds: '6',
        groups: '4',
        users_groups: '3',
        thresholds_groups: '5',
        usergroups_rel_id: '2',
        thresholdsgroups_rel_id: '4'
      }
    }
  }
}));

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Make unmocked API calls fail loudly
  (ArcGISService.request as jest.Mock).mockRejectedValue(
    new Error("Unexpected API call in test")
  );
});

describe("WqimsGroup", () => {
  let mockGroup: WqimsGroup;

  beforeEach(() => {
    mockGroup = new WqimsGroup({
      OBJECTID: 1,
      ACTIVE: 1,
      GROUPNAME: "test",
      GROUPID: "test",
      MEMBERS: [],
      THRESHOLDS: []
    });
  });

  describe("constructor", () => {
    it("should initialize with default values when no body provided", () => {
      const group = new WqimsGroup(null,
        "test-group",
        1,
        [new WqimsUser({ OBJECTID: 1 })],
        [new WqimsThreshold({ OBJECTID: 1 })]
      );

      expect(group.GROUPNAME).toBe("test-group");
      expect(group.ACTIVE).toBe(1);
      expect(group.MEMBERS.length).toBe(1);
      expect(group.THRESHOLDS.length).toBe(1);
    });

    it("should handle empty members and thresholds arrays", () => {
      const group = new WqimsGroup({
        GROUPNAME: "test",
        ACTIVE: 1,
        GROUPID: "test",
        MEMBERS: [],
        THRESHOLDS: []
      });

      expect(group.MEMBERS).toEqual([]);
      expect(group.THRESHOLDS).toEqual([]);
    });
  });

  describe("assignThresholds", () => {
    it("should assign threshold to specified group", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await WqimsGroup.assignThresholds(["test-group-id"], "test-threshold-id");
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the add operation was unsuccessful", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: false, error: { description: "Add failed" } }]
      });

      await expect(WqimsGroup.assignThresholds(["test-group-id"], "test-threshold-id"))
        .rejects.toThrow("Add failed");
    });

    it("should reject the promise if the add operation throws an error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("test error"));

      await expect(WqimsGroup.assignThresholds(["test-group-id"], "test-threshold-id"))
        .rejects.toThrow("test error");
    });
  });

  describe("assignMembers", () => {
    it("should assign user to specified group", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await WqimsGroup.assignMembers(
        ["test-group-id"], 
        "{test-user-id}"  // This is the GLOBALID value
      );
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the add operation was unsuccessful", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: false, error: { description: "Add failed" } }]
      });

      await expect(WqimsGroup.assignMembers(
        ["test-group-id"], 
        "{test-user-id}"
      )).rejects.toThrow("Add failed");
    });
  });

  describe("checkInactive", () => {
    it("should find inactive groups and reactivate them", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: [{ attributes: { GROUPID: "test-id", ACTIVE: 0 } }] })
        .mockResolvedValueOnce({ updateResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.checkInactive();
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the query fails", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("test error"));

      await expect(mockGroup.checkInactive()).rejects.toThrow("test error");
    });
  });

  describe("deleteGroupItems", () => {
    it("should remove an item's relationship to the specified group", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ objectIds: [1] })
        .mockResolvedValueOnce({ deleteResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.deleteGroupItems(
        WqimsGroup.thresholdsRelationshipClassUrl,
        [new WqimsThreshold({ GLOBALID: "test-id" })]
      );
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should handle no relationships found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ objectIds: [] });

      const result = await mockGroup.deleteGroupItems(
        WqimsGroup.thresholdsRelationshipClassUrl,
        [new WqimsThreshold({ GLOBALID: "test-id" })]
      );
      expect(result).toEqual({
        objectId: -1,
        success: true,
        error: {
          code: 404,
          description: "No relationships found"
        }
      });
    });

    it("should handle empty objectIds", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        objectIds: []
      });

      const result = await mockGroup.deleteGroupItems(
        WqimsGroup.usersRelationshipClassUrl,
        [new WqimsUser({ GLOBALID: "test-id" })]
      );
      expect(result).toEqual({
        objectId: -1,
        success: true,
        error: {
          code: 404,
          description: "No relationships found"
        }
      });
    });

    it("should handle delete failure", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          objectIds: [1]
        })
        .mockResolvedValueOnce({
          deleteResults: [{ 
            objectId: 1, 
            success: false, 
            error: { description: "Delete failed" } 
          }]
        });

      await expect(mockGroup.deleteGroupItems(
        WqimsGroup.usersRelationshipClassUrl,
        [new WqimsUser({ GLOBALID: "test-id" })]
      )).rejects.toThrow("Delete failed");
    });
  });

  describe("getGroupItems", () => {
    it("should return specified group items", async () => {
      (ArcGISService.request as jest.Mock).mockReset();
      
      (ArcGISService.request as jest.Mock).mockImplementation((url, method, params) => {
        if (params.relationshipId === 2) {
          return Promise.resolve({
            relatedRecordGroups: [{
              relatedRecords: [{
                attributes: {
                  GLOBALID: "test-id",
                  NAME: "Test User",
                  EMAIL: "test@email.com"
                }
              }]
            }]
          });
        }
        return Promise.resolve({ relatedRecordGroups: [] });
      });

      const result = await mockGroup.getGroupItems(2);
      expect(result).toEqual([{
        attributes: {
          GLOBALID: "test-id",
          NAME: "Test User",
          EMAIL: "test@email.com"
        }
      }]);
    });

    it("should handle undefined relatedRecordGroups", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});
      const result = await mockGroup.getGroupItems(1);
      expect(result).toEqual([]);
    });

    it("should handle undefined relatedRecords", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        relatedRecordGroups: [{}]
      });
      const result = await mockGroup.getGroupItems(1);
      expect(result).toEqual([]);
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Query failed"));
      await expect(mockGroup.getGroupItems(1)).rejects.toThrow("Query failed");
    });
  });

  describe("assignItemsToGroup", () => {
    let expectedResponse: WqimsGroup;

    beforeEach(() => {
      expectedResponse = new WqimsGroup({
        OBJECTID: 1,
        ACTIVE: 1,
        GROUPNAME: "test",
        GROUPID: "test",
        MEMBERS: [new WqimsUser({
          OBJECTID: 1,
          ACTIVE: 1,
          GLOBALID: "{some user id}",
          NAME: "Test User",
          DEPARTMENT: "test",
          POSITION: "test",
          DIVISION: "test",
          PHONENUMBER: "test",
          EMAIL: "test",
          ROLE: "test",
          RAPIDRESPONSETEAM: 0,
          SECONDARYPHONENUMBER: "test",
          STARTTIME: "test",
          ENDTIME: "test"
        })],
        THRESHOLDS: [new WqimsThreshold({
          OBJECTID: 1,
          ACTIVE: 1,
          GLOBALID: "{some threshold id}",
          LOCATION_CODE: "test",
          LOCATION_NAME: "test",
          PROJECT_NAME: "test",
          ANALYSIS: "test",
          ANALYTE: "test",
          UPPER_LOWER_SPECS: "test",
          SPECS_VALUE: 0,
          ACKTIMEOUT: 0,
          CLOSEOUTTIMEOUT: 0,
          TEMPLATE_ID: "test",
          SYSTEM: "test",
          UNIT: "test"
        })]
      });
    });

    it("should assign items to specified group", async () => {
      (ArcGISService.request as jest.Mock).mockReset();
      
      (ArcGISService.request as jest.Mock).mockImplementationOnce((url, method, params) => {
        return Promise.resolve({
          relatedRecordGroups: [{
            relatedRecords: [{
              attributes: expectedResponse.MEMBERS[0]
            }]
          }]
        });
      }).mockImplementationOnce((url, method, params) => {
        return Promise.resolve({
          relatedRecordGroups: [{
            relatedRecords: [{
              attributes: expectedResponse.THRESHOLDS[0]
            }]
          }]
        });
      });

      const result = await WqimsGroup.assignItemsToGroup([{ attributes: mockGroup }]);
      expect(result).toEqual([expectedResponse]);
    });

    it("should reject the promise if getGroupItems throws an error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("test error"));

      await expect(WqimsGroup.assignItemsToGroup([{ attributes: mockGroup }]))
        .rejects.toThrow("test error");
    });

    it("should handle empty input array", async () => {
      const result = await WqimsGroup.assignItemsToGroup([]);
      expect(result).toEqual([]);
    });

    it("should handle getGroupItems error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Query failed"));

      await expect(WqimsGroup.assignItemsToGroup([{ 
        attributes: { OBJECTID: 1 } 
      }])).rejects.toThrow("Query failed");
    });

    it("should handle undefined attributes", async () => {
      // Mock both group member and threshold queries to return empty results
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ relatedRecordGroups: [] })  // members query
        .mockResolvedValueOnce({ relatedRecordGroups: [] }); // thresholds query

      const result = await WqimsGroup.assignItemsToGroup([{ attributes: {} }]);
      expect(result).toEqual([
        expect.objectContaining({
          ACTIVE: 1,
          GROUPID: null,
          GROUPNAME: "",
          MEMBERS: [],
          THRESHOLDS: []
        })
      ]);
    });
  })

  describe("updateFeature", () => {
    it("should update the group name", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: true }]
      });

      const result = await mockGroup.updateFeature();
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the update operation is unsuccessful", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: false, error: { description: "Update failed" } }]
      });

      await expect(mockGroup.updateFeature())
        .rejects.toThrow("Update failed");
    });
  });

  describe("softDeleteFeature", () => {
    it("should soft delete the group by setting active to 0", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: true }]
      });

      const result = await mockGroup.softDeleteFeature();
      expect(mockGroup.ACTIVE).toEqual(0);
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the update operation is unsuccessful", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: false, error: { description: "Update failed" } }]
      });

      await expect(mockGroup.softDeleteFeature())
        .rejects.toThrow("Update failed");
    });
  });

  describe("addGroupItems", () => {
    it("should add items to a group", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await mockGroup.addGroupItems(
        WqimsGroup.thresholdsRelationshipClassUrl, 
        [new WqimsThreshold({ GLOBALID: "test-id" })]
      );
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the add operation is unsuccessful", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: false, error: { description: "Add failed" } }]
      });

      await expect(mockGroup.addGroupItems(
        WqimsGroup.thresholdsRelationshipClassUrl, 
        [new WqimsThreshold({ GLOBALID: "test-id" })]
      )).rejects.toThrow("Add failed");
    });

    it("should handle add failure", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ 
          objectId: 1, 
          success: false, 
          error: { description: "Add failed" } 
        }]
      });

      await expect(mockGroup.addGroupItems(
        WqimsGroup.usersRelationshipClassUrl,
        [new WqimsUser({ GLOBALID: "test-id" })]
      )).rejects.toThrow("Add failed");
    });

    it("should handle undefined error description", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: false, error: {} }]
      });

      await expect(mockGroup.addGroupItems(
        WqimsGroup.usersRelationshipClassUrl,
        [new WqimsUser({ GLOBALID: "test-id" })]
      )).rejects.toThrow("Add failed");
    });
  })

  describe("error handling", () => {
    it("should handle non-Error objects in error logging", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce("String error");
      await expect(mockGroup.getGroupItems(1)).rejects.toBe("String error");
    });

    it("should handle query error in deleteGroupItems", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Query failed"));
      await expect(mockGroup.deleteGroupItems(
        WqimsGroup.usersRelationshipClassUrl,
        [new WqimsUser({ GLOBALID: "test-id" })]
      )).rejects.toThrow("Query failed");
    });
  });
})