import { WqimsThreshold } from "../models/WqimsThreshold";
import { ArcGISService } from "../services/ArcGISService";

jest.mock("../services/ArcGISService");
jest.mock("../util/appLogger");

describe("WqimsThreshold", () => {
  let mockThreshold: WqimsThreshold;

  beforeEach(() => {
    jest.clearAllMocks();
    mockThreshold = new WqimsThreshold({
      OBJECTID: 1,
      ACTIVE: 1,
      GLOBALID: "test-id",
      LOCATION_CODE: "test-loc",
      LOCATION_NAME: "Test Location",
      PROJECT_NAME: "Test Project",
      ANALYSIS: "test-analysis",
      ANALYTE: "test-analyte",
      UPPER_LOWER_SPECS: "test-specs",
      SPECS_VALUE: 0,
      ACKTIMEOUT: 0,
      CLOSEOUTTIMEOUT: 0,
      TEMPLATE_ID: "test-template",
      SYSTEM: "test-system",
      UNIT: "test-unit"
    });
  });

  describe("constructor", () => {
    it("should initialize with default values when no body provided", () => {
      const threshold = new WqimsThreshold(null, 
        "test-id",
        "test-loc",
        "Test Location",
        "Test Project",
        "test-analysis",
        "test-analyte",
        "test-specs",
        0,
        0,
        0,
        "test-template",
        "test-system",
        "test-unit"
      );
      expect(threshold.GLOBALID).toBe("test-id");
      expect(threshold.ACTIVE).toBe(1);
    });

    it("should initialize with body values", () => {
      expect(mockThreshold.GLOBALID).toBe("test-id");
      expect(mockThreshold.LOCATION_CODE).toBe("test-loc");
    });
  });

  describe("checkInactive", () => {
    it("should find and reactivate inactive threshold", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          features: [{
            attributes: {
              GLOBALID: "test-id",
              ACTIVE: 0
            }
          }]
        })
        .mockResolvedValueOnce({
          updateResults: [{ objectId: 1, success: true }]
        });

      const result = await mockThreshold.checkInactive();
      expect(result.success).toBe(true);
      expect(mockThreshold.GLOBALID).toBe("test-id");
    });

    it("should handle no inactive threshold found", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ features: [] });

      const result = await mockThreshold.checkInactive();
      expect(result.success).toBe(false);
      expect(result.error?.description).toBe("No inactive record found");
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce(new Error("Query failed"));

      await expect(mockThreshold.checkInactive())
        .rejects.toThrow("Query failed");
    });
  });

  describe("removeRelationship", () => {
    it("should remove relationships successfully", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          objectIds: [1, 2]
        })
        .mockResolvedValueOnce({
          deleteResults: [{ objectId: 1, success: true }]
        });

      const result = await mockThreshold.removeRelationship(
        WqimsThreshold.groupsRelationshipClassUrl
      );
      expect(result.success).toBe(true);
    });

    it("should handle no relationships found", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ objectIds: [] });

      const result = await mockThreshold.removeRelationship(
        WqimsThreshold.groupsRelationshipClassUrl
      );
      expect(result.success).toBe(true);
      expect(result.objectId).toBe(mockThreshold.OBJECTID);
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce(new Error("Query failed"));

      await expect(mockThreshold.removeRelationship(
        WqimsThreshold.groupsRelationshipClassUrl
      )).rejects.toThrow("Query failed");
    });

    it("should handle delete error", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ objectIds: [1] })
        .mockResolvedValueOnce({
          deleteResults: [{
            objectId: 1,
            success: false,
            error: { description: "Delete failed" }
          }]
        });

      await expect(mockThreshold.removeRelationship(
        WqimsThreshold.groupsRelationshipClassUrl
      )).rejects.toThrow("Delete failed");
    });
  });

  describe("getThreshold", () => {
    it("should get threshold by ID", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{
          attributes: {
            OBJECTID: 1,
            GLOBALID: "test-id"
          }
        }]
      });

      const result = await WqimsThreshold.getThreshold(1);
      expect(result?.attributes.GLOBALID).toBe("test-id");
    });

    it("should return null when threshold not found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: []
      });

      const result = await WqimsThreshold.getThreshold(1);
      expect(result).toBeNull();
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce(new Error("Query failed"));

      await expect(WqimsThreshold.getThreshold(1))
        .rejects.toThrow("Query failed");
    });

    it("should handle undefined features", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});

      const result = await WqimsThreshold.getThreshold(1);
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should handle non-Error objects in error logging", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce("String error");

      await expect(mockThreshold.checkInactive())
        .rejects.toBe("String error");
    });

    it("should handle undefined error descriptions", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ objectIds: [1] })
        .mockResolvedValueOnce({
          deleteResults: [{ objectId: 1, success: false, error: {} }]
        });

      await expect(mockThreshold.removeRelationship(
        WqimsThreshold.groupsRelationshipClassUrl
      )).rejects.toThrow("Delete failed");
    });
  });
});