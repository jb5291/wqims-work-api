import { deleteFeatures, IQueryFeaturesResponse, IQueryResponse, queryFeatures, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { WqimsThreshold } from "../models/WqimsThreshold";

jest.mock("@esri/arcgis-rest-feature-service");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");

describe("WqimsThreshold", () => {
  const mockThreshold = new WqimsThreshold({
    GLOBALID: "test",
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
  })

  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("checkInactive", () => {
    it("should check for inactive thresholds and reactivate them", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { ...mockThreshold, ACTIVE: 1 } }] } as IQueryFeaturesResponse);
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [{ objectId: 1, success: true }]});

      const result = await mockThreshold.checkInactive();

      expect(queryFeatures).toHaveBeenCalledTimes(1);
      expect(updateFeatures).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should reject the promise if the query fails", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("Test error"));

      await expect(mockThreshold.checkInactive()).rejects.toThrow("Test error");
    })
  })

  describe("removeRelationship", () => {
    it("should remove threshold's relationship records", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] } as IQueryResponse);
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: true }] });

      const result = await mockThreshold.removeRelationship(WqimsThreshold.groupsRelationshipClassUrl);

      expect(queryFeatures).toHaveBeenCalledTimes(1);
      expect(deleteFeatures).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ objectId: 1, success: true });
    })

    it("should reject the promise if the delete operation is unsuccessful", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] } as IQueryResponse);
      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [{ objectId: 1, success: false, error: { description: "Test error" } }] });

      await expect(mockThreshold.removeRelationship(WqimsThreshold.groupsRelationshipClassUrl)).rejects.toEqual("Test error");
    })

    it("should reject the promise if the delete fails", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ objectIds: [1] } as IQueryResponse);
      (deleteFeatures as jest.Mock).mockRejectedValue(new Error("Test error"));

      await expect(mockThreshold.removeRelationship(WqimsThreshold.groupsRelationshipClassUrl)).rejects.toThrow("Test error");
    });

    it("should reject the promise if the query fails", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("Test error"));

      await expect(mockThreshold.removeRelationship(WqimsThreshold.groupsRelationshipClassUrl)).rejects.toThrow("Test error");
    });
  })
});