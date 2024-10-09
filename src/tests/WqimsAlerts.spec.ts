import { queryFeatures } from "@esri/arcgis-rest-feature-service";
import { WqimsAlert } from "../models/WqimsAlerts";

jest.mock("@esri/arcgis-rest-feature-service");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");

describe("WqimsAlerts", () => {
  const mockAlert = new WqimsAlert({
    GLOBALID: "test",
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
    RESULT_ID: "test",
    ACTIVE: 0,
  })

  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("getActiveFeatures", () => {
    it("should return all active alerts w/o geometry", async () => {
      (queryFeatures as jest.Mock).mockResolvedValue({ features: [{ attributes: { ...mockAlert, ACTIVE: 1 } }] } as IQueryFeaturesResponse);

      const result = await WqimsAlert.getActiveFeatures();

      expect(queryFeatures).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ attributes: { ...mockAlert, ACTIVE: 1 } }]);
    });

    it("should reject the promise if the query fails", async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error("Test error"));

      await expect(WqimsAlert.getActiveFeatures()).rejects.toThrow("Test error");
    })
  })
});