import { WqimsObject } from "../models/Wqims";
import { ArcGISService } from "../services/ArcGISService";

jest.mock("../services/ArcGISService");
jest.mock("../util/appLogger");

class TestWqimsObject extends WqimsObject {
  static featureUrl = "test-url";
}

describe("WqimsObject", () => {
  let testObject: TestWqimsObject;

  beforeEach(() => {
    jest.clearAllMocks();
    testObject = new TestWqimsObject(1, 1);
  });

  describe("getActiveFeatures", () => {
    it("should return active features", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{ attributes: { ACTIVE: 1 } }]
      });

      const result = await TestWqimsObject.getActiveFeatures();
      expect(result).toEqual([{ attributes: { ACTIVE: 1 } }]);
    });

    it("should throw error when no features returned", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});
      await expect(TestWqimsObject.getActiveFeatures()).rejects.toThrow("Error getting data");
    });
  });

  describe("constructor and getters/setters", () => {
    it("should initialize with default values", () => {
      const obj = new TestWqimsObject();
      expect(obj.ACTIVE).toBe(1);
      expect(obj.OBJECTID).toBeUndefined();
    });

    it("should set values through constructor", () => {
      const obj = new TestWqimsObject(5, 0);
      expect(obj.OBJECTID).toBe(5);
      expect(obj.ACTIVE).toBe(0);
    });

    it("should set and get active status", () => {
      testObject.active = 0;
      expect(testObject.ACTIVE).toBe(0);
    });

    it("should set and get objectId", () => {
      testObject.objectId = 123;
      expect(testObject.objectId).toBe(123);
    });

    it("should handle null values in setters", () => {
      testObject.active = null as any;
      expect(testObject.ACTIVE).toBe(0);

      testObject.objectId = null as any;
      expect(testObject.objectId).toBe(0);
    });

    it("should handle undefined objectId in getter", () => {
      testObject.OBJECTID = undefined;
      expect(testObject.objectId).toBe(0);
    });
  });

  describe("addFeature", () => {
    it("should add feature with GLOBALID", async () => {
      const objWithGlobalId = new TestWqimsObject();
      (objWithGlobalId as any).globalId = null; // Add GLOBALID property

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await objWithGlobalId.addFeature();
      expect(result.objectId).toBe(1);
      expect((objWithGlobalId as any).globalId).toMatch(/^\{[A-F0-9-]+\}$/);
    });

    it("should add feature with GROUPID", async () => {
      const objWithGroupId = new TestWqimsObject();
      (objWithGroupId as any).GROUPID = null; // Add GROUPID property

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await objWithGroupId.addFeature();
      expect(result.objectId).toBe(1);
      expect((objWithGroupId as any).GROUPID).toMatch(/^\{[A-F0-9-]+\}$/);
    });

    it("should handle add feature error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Add failed"));
      await expect(testObject.addFeature()).rejects.toThrow("Add failed");
    });

    it("should handle feature with neither GLOBALID nor GROUPID", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await testObject.addFeature();
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should handle feature with GLOBALID", async () => {
      const objWithGlobalId = new TestWqimsObject();
      (objWithGlobalId as any).GLOBALID = null;

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ objectId: 1, success: true }]
      });

      const result = await objWithGlobalId.addFeature();
      expect(result.globalId).toBeDefined();
    });
  });

  describe("updateFeature", () => {
    it("should handle update feature error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Update failed"));
      await expect(testObject.updateFeature()).rejects.toThrow("Update failed");
    });

    it("should handle unsuccessful update", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: false, error: { description: "Update error" } }]
      });
      await expect(testObject.updateFeature()).rejects.toThrow("Update error");
    });
  });

  describe("softDeleteFeature", () => {
    it("should handle soft delete error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Delete failed"));
      await expect(testObject.softDeleteFeature()).rejects.toThrow("Delete failed");
    });
  });

  describe("reactivateFeature", () => {
    it("should handle reactivate feature error", async () => {
      const response = {
        features: [{ attributes: { OBJECTID: 1, ACTIVE: 0 } }]
      };
      
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Reactivate failed"));
      await expect(testObject.reactivateFeature(response)).rejects.toThrow("Reactivate failed");
    });

    it("should handle unsuccessful reactivation", async () => {
      const response = {
        features: [{ attributes: { OBJECTID: 1, ACTIVE: 0 } }]
      };

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: false, error: { description: "Reactivate error" } }]
      });
      await expect(testObject.reactivateFeature(response)).rejects.toThrow("Reactivate error");
    });

    it("should handle empty features array", async () => {
      const result = await testObject.reactivateFeature({ features: [] });
      expect(result).toEqual({
        objectId: -1,
        success: false,
        error: {
          code: 999,
          description: "No inactive record found"
        }
      });
    });

    it("should handle undefined features", async () => {
      const result = await testObject.reactivateFeature({});
      expect(result).toEqual({
        objectId: -1,
        success: false,
        error: {
          code: 999,
          description: "No inactive record found"
        }
      });
    });
  });

  describe("getObject", () => {
    it("should get object by ID", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{ attributes: { OBJECTID: 1, ACTIVE: 1 } }]
      });

      const result = await TestWqimsObject.getObject(1);
      expect(result).toEqual({ attributes: { OBJECTID: 1, ACTIVE: 1 } });
    });

    it("should return null when object not found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: []
      });

      const result = await TestWqimsObject.getObject(1);
      expect(result).toBeNull();
    });

    it("should handle get object error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Get failed"));
      await expect(TestWqimsObject.getObject(1)).rejects.toMatchObject({
        error: "Get failed",
        message: "GET object error"
      });
    });

    it("should handle undefined features in response", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});
      const result = await TestWqimsObject.getObject(1);
      expect(result).toBeNull();
    });

    it("should handle non-Error objects in error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce("String error");
      await expect(TestWqimsObject.getObject(1)).rejects.toMatchObject({
        error: "unknown error",
        message: "GET object error"
      });
    });
  });

  describe("error handling", () => {
    it("should handle non-Error objects in error logging", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce("String error");
      await expect(TestWqimsObject.getActiveFeatures()).rejects.toBe("String error");
    });

    it("should handle undefined error description", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        updateResults: [{ objectId: 1, success: false, error: {} }]
      });

      await expect(testObject.updateFeature()).rejects.toThrow("Update failed");
    });
  });
}); 