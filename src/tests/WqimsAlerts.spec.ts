import { WqimsAlert } from "../models/WqimsAlerts";
import { ArcGISService } from "../services/ArcGISService";

jest.mock("../services/ArcGISService");
jest.mock("../util/appLogger");

describe("WqimsAlerts", () => {
  let mockAlert: WqimsAlert;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert = new WqimsAlert({
      OBJECTID: 1,
      ACTIVE: 1,
      GLOBALID: "test-id",
      SAMPLENUM: "test",
      LOCATION: "test",
      LOCCODE: "test",
      COLLECTDATE: 0,
      SAMPLECOLLECTOR: "test",
      ACODE: "test",
      ANALYTE: "test",
      ANALYSEDDATE: 0,
      ANALYSEDBY: "test",
      DATEVALIDATED: 0,
      VALIDATEDBY: "test",
      GEOCODEMATCHEDADDRESS: "test",
      RESULT: "test",
      WARNING_STATUS: "test",
      STATUS: "test",
      COMMENTS: "test",
      ACK_TIME: 0,
      ACK_BY: "test",
      CLOSED_TIME: 0,
      CLOSED_BY: "test",
      THRESHOLD_ID: "test",
      TEMPLATE_ID: "test",
      RESULT_ID: "test"
    });
  });

  describe("constructor", () => {
    it("should initialize with default values when no body provided", () => {
      const alert = new WqimsAlert(null,
        "test-id",
        "test-sample",
        "test-location",
        0, // COLLECTDATE
        "test-collector",
        "test-code",
        0, // ANALYSEDDATE
        "test-analyst",
        0, // DATEVALIDATED
        "test-validator",
        "test-address",
        "test-result",
        "test-loccode",
        "test-warning",
        "test-analyte",
        "test-status",
        "test-comments",
        0, // ACK_TIME
        "test-ack",
        0, // CLOSED_TIME
        "test-closed",
        "test-threshold",
        "test-template",
        "test-result-id"
      );

      expect(alert.GLOBALID).toBe("test-id");
      expect(alert.ACTIVE).toBe(1);
    });

    it("should initialize with body values", () => {
      expect(mockAlert.GLOBALID).toBe("test-id");
      expect(mockAlert.SAMPLENUM).toBe("test");
    });
  });

  describe("getActiveFeatures", () => {
    it("should return all active alerts w/o geometry", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{ attributes: { ...mockAlert, ACTIVE: 1 } }]
      });

      const result = await WqimsAlert.getActiveFeatures();
      expect(result).toEqual([{ attributes: { ...mockAlert, ACTIVE: 1 } }]);
    });

    it("should reject the promise if the query fails", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Test error"));

      await expect(WqimsAlert.getActiveFeatures()).rejects.toThrow("Test error");
    });
  });

  describe("getUserAlerts", () => {
    it("should return alerts for user's groups", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ // User groups query
          relatedRecordGroups: [{
            relatedRecords: [{ attributes: { OBJECTID: 1 } }]
          }]
        })
        .mockResolvedValueOnce({ // Group thresholds query
          relatedRecordGroups: [{
            relatedRecords: [{ attributes: { GLOBALID: "test-threshold" } }]
          }]
        })
        .mockResolvedValueOnce({ // Alerts query
          features: [{ attributes: mockAlert }]
        });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([{ attributes: mockAlert }]);
    });

    it("should return empty array when user has no groups", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        relatedRecordGroups: []
      });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });

    it("should return empty array when groups have no thresholds", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          relatedRecordGroups: [{
            relatedRecords: [{ attributes: { OBJECTID: 1 } }]
          }]
        })
        .mockResolvedValueOnce({
          relatedRecordGroups: []
        });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });

    it("should handle empty user groups", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        relatedRecordGroups: []
      });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });

    it("should handle empty group thresholds", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          relatedRecordGroups: [{
            relatedRecords: [{ attributes: { OBJECTID: 1 } }]
          }]
        })
        .mockResolvedValueOnce({
          relatedRecordGroups: []
        });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });

    it("should handle undefined relatedRecordGroups", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });

    it("should handle undefined relatedRecords", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        relatedRecordGroups: [{}]
      });

      const result = await WqimsAlert.getUserAlerts(1);
      expect(result).toEqual([]);
    });
  });

  describe("updateStatus", () => {
    const mockDate = 1234567890000;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(mockDate);
    });

    it("should update alert to Acknowledged status", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          features: [{ attributes: { NAME: "Test User" } }]
        })
        .mockResolvedValueOnce({
          updateResults: [{ objectId: 1, success: true }]
        });

      mockAlert.STATUS = "Acknowledged";
      const result = await mockAlert.updateStatus(1);
      
      expect(mockAlert.ACK_TIME).toBe(mockDate);
      expect(mockAlert.ACK_BY).toBe("Test User");
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should update alert to Closed status", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          features: [{ attributes: { NAME: "Test User" } }]
        })
        .mockResolvedValueOnce({
          updateResults: [{ objectId: 1, success: true }]
        });

      mockAlert.STATUS = "Closed";
      const result = await mockAlert.updateStatus(1);
      
      expect(mockAlert.CLOSED_TIME).toBe(mockDate);
      expect(mockAlert.CLOSED_BY).toBe("Test User");
      expect(result).toEqual({ objectId: 1, success: true });
    });

    it("should handle user not found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: []
      });

      await expect(mockAlert.updateStatus(1))
        .rejects.toThrow("User not found");
    });

    it("should handle invalid status", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{ attributes: { NAME: "Test User" } }]
      });

      mockAlert.STATUS = "Invalid";
      await expect(mockAlert.updateStatus(1))
        .rejects.toThrow("Invalid status");
    });

    it("should handle update failure", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          features: [{ attributes: { NAME: "Test User" } }]
        })
        .mockResolvedValueOnce({
          updateResults: [{ 
            success: false, 
            error: { description: "Update failed" } 
          }]
        });

      mockAlert.STATUS = "Acknowledged";
      await expect(mockAlert.updateStatus(1))
        .rejects.toThrow("Update failed");
    });

    it("should handle undefined features in user query", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});

      await expect(mockAlert.updateStatus(1))
        .rejects.toThrow("User not found");
    });
  });

  describe("getAlert", () => {
    it("should return alert by ID", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: [{ attributes: mockAlert }]
      });

      const result = await WqimsAlert.getAlert(1);
      expect(result).toEqual({ attributes: mockAlert });
    });

    it("should return null when alert not found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: []
      });

      const result = await WqimsAlert.getAlert(1);
      expect(result).toBeNull();
    });

    it("should handle undefined features", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({});

      const result = await WqimsAlert.getAlert(1);
      expect(result).toBeNull();
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce(new Error("Query failed"));

      await expect(WqimsAlert.getAlert(1))
        .rejects.toThrow("Query failed");
    });
  });

  describe("error handling", () => {
    it("should handle non-Error objects in error logging", async () => {
      (ArcGISService.request as jest.Mock)
        .mockRejectedValueOnce("String error");

      await expect(WqimsAlert.getActiveFeatures())
        .rejects.toBe("String error");
    });

    it("should handle undefined error descriptions", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          features: [{ attributes: { NAME: "Test User" } }]
        })
        .mockResolvedValueOnce({
          updateResults: [{ success: false, error: {} }]
        });

      mockAlert.STATUS = "Acknowledged";
      await expect(mockAlert.updateStatus(1))
        .rejects.toThrow("Update failed");
    });
  });
});