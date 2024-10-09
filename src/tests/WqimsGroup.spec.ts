import { addFeatures, deleteFeatures, IFeature, IQueryFeaturesResponse, queryFeatures, queryRelated, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { WqimsGroup } from "../models/WqimsGroup";
import { authConfig } from "../util/secrets";
import { WqimsUser } from "../models/WqimsUser";
import { WqimsThreshold } from "../models/WqimsThreshold";

jest.mock("@esri/arcgis-rest-feature-service");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");

describe("WqimsGroup", () => {
  const mockGroup = new WqimsGroup({
    GROUPNAME: "test",
    ACTIVE: 1,
    OBJECTID: 1,
    GROUPID: "test",
    MEMBERS: [],
    THRESHOLDS: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("assignThresholds", () => {
    it("should assign threshold to specified group", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: true }] });
      const groupIds = [mockGroup.GROUPID as string];

      const result = await WqimsGroup.assignThresholds(groupIds, "{some id}");

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the add operation was unsuccessful", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: false }] });

      await expect(WqimsGroup.assignThresholds([mockGroup.GROUPID as string], "{some id}")).rejects.toThrow("Add failed");
    })

    it('should reject the promise if the add operation throws an error', async () => {
      (addFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(WqimsGroup.assignThresholds([mockGroup.GROUPID as string], "{some id}")).rejects.toThrow("test error");
    })
  })

  describe("assignMembers", () => {
    it("should assign user to specified group", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: true }] });
      const groupIds = [mockGroup.GROUPID as string];

      const result = await WqimsGroup.assignMembers(groupIds, "{some id}");

      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the add operation was unsuccessful", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: false }] });
      const groupIds = [mockGroup.GROUPID as string];

      await expect(WqimsGroup.assignMembers([mockGroup.GROUPID as string], "{some id}")).rejects.toThrow("Add failed");
    });

    it('should reject the promise if the add operation throws an error', async () => {
      (addFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(WqimsGroup.assignMembers([mockGroup.GROUPID as string], "{some id}")).rejects.toThrow("test error");
    });
  })

  describe("assignItemsToGroup", () => {
    let expectedResponse: WqimsGroup;
    beforeEach(() => {
      expectedResponse = new WqimsGroup(
        {
          GROUPNAME: "test",
          ACTIVE: 1,
          OBJECTID: 1,
          GROUPID: "test",
          MEMBERS: [ new WqimsUser({ 
            ACTIVE: 1,
            GLOBALID: "{some user id}",
            OBJECTID: 1,
            DEPARTMENT: "test",
            POSITION: "test",
            DIVISION: "test",
            PHONENUMBER: "test",
            EMAIL: "test",
            ROLE: "test",
            RAPIDRESPONSETEAM: 0,
            SECONDARYPHONENUMBER: "test",
            STARTTIME: "test",
            ENDTIME: "test",
            featureUrl: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.users}`,
          })],
          THRESHOLDS: [new WqimsThreshold({ 
            ACTIVE: 1,
            GLOBALID: "{some threshold id}",
            OBJECTID: 1,
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
            UNIT: "test",
            featureUrl: `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.thresholds}`,
          })] as WqimsThreshold[],
          featureUrl:  `${authConfig.arcgis.feature_url}/${authConfig.arcgis.layers.groups}`,
        }
      );
    })

    it("should assign items to specified group", async () => {
      (queryRelated as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ 
          relatedRecordGroups: [ { 
            relatedRecords: [{
              attributes: {
                ACTIVE: 1,
                GLOBALID: "{some user id}",
                OBJECTID: 1,
                DEPARTMENT: "test",
                POSITION: "test",
                DIVISION: "test",
                PHONENUMBER: "test",
                EMAIL: "test",
                ROLE: "test",
                RAPIDRESPONSETEAM: 0,
                SECONDARYPHONENUMBER: "test",
                STARTTIME: "test",
                ENDTIME: "test",
              }
            }]
          }]
        }))
        .mockImplementationOnce(() => Promise.resolve({ 
          relatedRecordGroups: [ { 
            relatedRecords: [{ 
              attributes: {
                ACTIVE: 1,
                GLOBALID: "{some threshold id}",
                OBJECTID: 1,
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
                UNIT: "test",
              }
            }]
          }]
        }));


      const result = await WqimsGroup.assignItemsToGroup([{ attributes: mockGroup }] as IFeature[]);

      expect(result).toEqual([expectedResponse]);
    });

    it("should reject the promise if getGroupItems throws an error", async () => {
      (queryRelated as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(WqimsGroup.assignItemsToGroup([{ attributes: mockGroup }] as IFeature[])).rejects.toEqual({ error: "test error", message: "Group GET error" });
    })
  })

  describe("checkInactive", () => {
    it("should find inactive groups and reactivate them", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { OBJECTID: 1 } }] } as IQueryFeaturesResponse);
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.checkInactive();

      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the query fails", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.checkInactive()).rejects.toThrow("test error");
    });
  })

  describe("updateFeature", () => {
    it("should update the group name", async () => {
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.updateFeature();

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the update operation is unsuccessful", async () => {
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: false, error: { description: "Update failed"} }] });

      await expect(mockGroup.updateFeature()).rejects.toEqual("Update failed");
    })

    it("should reject the promise if the update operation throws an error", async () => {
      (updateFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.updateFeature()).rejects.toThrow("test error");
    });
  })

  describe("softDeleteFeature", () => {
    it("should soft delete the group by setting active to 0", async () => {
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.softDeleteFeature();

      expect(mockGroup.ACTIVE).toEqual(0);
      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the update operation is unsuccessful", async () => {
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: false, error: { description: "Update failed"} }] });

      await expect(mockGroup.softDeleteFeature()).rejects.toEqual("Update failed");
    })

    it("should reject the promise if the update operation throws an error", async () => {
      (updateFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.softDeleteFeature()).rejects.toThrow("test error");
    });
  })

  describe("addGroupItems", () => {
    it("should add items to a group", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })]);

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the add operation is unsuccessful", async () => {
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ objectId: 1, success: false, error: { description: "Add failed"} }] });

      await expect(mockGroup.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })])).rejects.toEqual("Add failed");
    })

    it("should reject the promise if the add operation throws an error", async () => {
      (addFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.addGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })])).rejects.toThrow("test error");
    });
  })

  describe("deleteGroupItems", () => {
    it("should remove an item's relationship to the specified group", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] });
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: true }] });

      const result = await mockGroup.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })]);

      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the delete operation is unsuccessful", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] });
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: false, error: { description: "Delete failed"} }] });

      await expect(mockGroup.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })])).rejects.toEqual("Delete failed");
    })

    it("should reject the promise if the delete operation throws an error", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] });
      (deleteFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })])).rejects.toThrow("test error");
    });

    it("should reject the promise if the query operation fails", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.deleteGroupItems(WqimsGroup.thresholdsRelationshipClassUrl, [new WqimsThreshold({ GLOBALID: "{some threshold id}" })])).rejects.toThrow("test error");
    });
  })

  describe("getGroupItems", () => {
    it("should return specified group items (thresholds or members)", async () => {
      (queryRelated as jest.Mock).mockResolvedValue({ relatedRecordGroups: [{ relatedRecords: [{ attributes: { GLOBALID: "{some threshold id}" } }] }] });

      const result = await mockGroup.getGroupItems(1);

      expect(result).toEqual([{ attributes: { GLOBALID: "{some threshold id}" } }]);
    })

    it("should reject the promise if the query operation fails", async () => {
      (queryRelated as jest.Mock).mockRejectedValue(new Error("test error"));

      await expect(mockGroup.getGroupItems(1)).rejects.toEqual({"error": "test error", "message": "Group GET error"});
    });
  })
})