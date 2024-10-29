import { addFeatures, deleteFeatures, IQueryFeaturesResponse, queryFeatures, updateFeatures } from "@esri/arcgis-rest-feature-service";
import { appLogger } from "../util/appLogger";
import WqimsChecklist, { IChecklistItem } from "../models/WqimsChecklist";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";

jest.mock("@esri/arcgis-rest-feature-service");
jest.mock("../routes/auth");
jest.mock("../util/appLogger");

describe("WqimsChecklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("getActiveFeatures", () => {
    it("should return active templates and their items", async () => {
      const mockTemplateResponse: IQueryFeaturesResponse = {
        features: [
          {
            attributes: {
              TEMPLATE_NAME: "Template 1",
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "123",
            }
          },
          {
            attributes: {
              TEMPLATE_NAME: "Template 2",
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "456",
            }
          }
        ]
      };

      const mockItemsResponse: IQueryFeaturesResponse = {
        features: [
          {
            attributes: {
              DESCRIPTION: "Item 1",
              ORDER_: 1,
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "789",
              TEMPLATE_ID: "123",
              STATUS: "active",
              COMPLETED_BY: "user1",
              COMPLETED_AT: 0
            }
          },
          {
            attributes: {
              DESCRIPTION: "Item 2",
              ORDER_: 2,
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "012",
              TEMPLATE_ID: "123",
              STATUS: "active",
              COMPLETED_BY: "user2",
              COMPLETED_AT: 0
            }
          },
          {
            attributes: {
              DESCRIPTION: "Item 3",
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "345",
              TEMPLATE_ID: "456",
              STATUS: "active",
              COMPLETED_BY: "user3",
              COMPLETED_AT: 0
            }
          }
        ]
      };

      const mockResponse = {
        features: [
          {
            attributes: {
              TEMPLATE_NAME: "Template 1",
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "123",
              items: [
                {
                  DESCRIPTION: "Item 1",
                  ORDER_: 1,
                  CREATED_AT: 0,
                  UPDATED_AT: 0,
                  GLOBALID: "789",
                  TEMPLATE_ID: "123",
                  STATUS: "active",
                  COMPLETED_BY: "user1",
                  COMPLETED_AT: 0
                },
                {
                  DESCRIPTION: "Item 2",
                  ORDER_: 2,
                  CREATED_AT: 0,
                  UPDATED_AT: 0,
                  GLOBALID: "012",
                  TEMPLATE_ID: "123",
                  STATUS: "active",
                  COMPLETED_BY: "user2",
                  COMPLETED_AT: 0
                }
              ]
            }
          },
          {
            attributes: {
              TEMPLATE_NAME: "Template 2",
              CREATED_AT: 0,
              UPDATED_AT: 0,
              GLOBALID: "456",
              items: [
                {
                  DESCRIPTION: "Item 3",
                  CREATED_AT: 0,
                  UPDATED_AT: 0,
                  GLOBALID: "345",
                  TEMPLATE_ID: "456",
                  STATUS: "active",
                  COMPLETED_BY: "user3",
                  COMPLETED_AT: 0
                }
              ]
            }
          }
        ]
      };
        
      (queryFeatures as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(mockTemplateResponse))
        .mockImplementationOnce(() => Promise.resolve(mockItemsResponse));

      const result = await WqimsChecklist.getActiveFeatures();

      expect(result).toEqual(mockResponse.features);
      expect(queryFeatures).toHaveBeenCalledTimes(2);
    });
    
    it('should return an error message if the first query fails', async () => {
      (queryFeatures as jest.Mock).mockRejectedValue(new Error('Failed to query templates'));
      const error = {
        error: 'Failed to query templates',
        message: "Checklist GET error"
      }
      //const result = await WqimsChecklist.getActiveFeatures();
      await expect(WqimsChecklist.getActiveFeatures()).rejects.toEqual({
        error: 'Failed to query templates',
        message: "Checklist GET error"
      })
      
      expect(appLogger.error).toHaveBeenCalledWith('Checklist GET Error:', expect.any(String));
    });
    it('should return an error message if the first query returns no data', async () => {
      (queryFeatures as jest.Mock).mockReturnValue([]);

      await expect(WqimsChecklist.getActiveFeatures()).rejects.toEqual({
        error: "Error getting data",
        message: "Checklist GET error"
      });
      expect(appLogger.error).toHaveBeenCalledWith('Checklist GET Error:', expect.any(String));
    });
  })

  // currently templates and items are 1-m, so items just get deleted when the template is deleted
  // describe("removeRelationshipFromTemplate", () => {
  // })

  describe("deleteFeature", () => {
    it("should delete a feature", async () => {
      const mockDeleteResult: IEditFeatureResult = { objectId: 1, success: true };

      (deleteFeatures as jest.Mock).mockResolvedValue({ deleteResults: [mockDeleteResult] });

      const result = await WqimsChecklist.deleteFeature("url", 1);

      expect(deleteFeatures).toHaveBeenCalled();
      expect(result).toEqual(mockDeleteResult);
    })

    it("should throw an error if the delete operation fails", async () => {
      (deleteFeatures as jest.Mock).mockRejectedValue(new Error("Delete failed"));

      await expect(WqimsChecklist.deleteFeature("url", 1)).rejects.toEqual({
        error: "Delete failed",
        message: "Checklist DELETE error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  });

  describe ("AddTemplateFeature", () => {
    it("should add a template feature", async() => {
      const mockAddResult: IEditFeatureResult = { objectId: 1, success: true };
      const mockTemplate = {
        TEMPLATE_NAME: "Template 1",
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "123",
      };

      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [mockAddResult] });

      const result = await WqimsChecklist.addTemplateFeature(mockTemplate.TEMPLATE_NAME, 0);

      expect(addFeatures).toHaveBeenCalled();
      expect(result).toEqual(mockAddResult);
    })

    it("should throw and error if the add operation fails", async () => {
      (addFeatures as jest.Mock).mockRejectedValue(new Error("Add failed"));

      await expect(WqimsChecklist.addTemplateFeature("url", 1)).rejects.toEqual({
        error: "Add failed",
        message: "Checklist PUT error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })

  describe("updateTemplateFeature", () => {
    it('should update a template feature', async () => {
      const mockUpdateResult: IEditFeatureResult = { objectId: 1, success: true };
      const mockTemplate = {
        TEMPLATE_NAME: "Template 1",
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "123",
      };
  
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [mockUpdateResult] });
  
      const result = await WqimsChecklist.updateTemplateFeature(mockTemplate);
  
      expect(updateFeatures).toHaveBeenCalled();
      expect(result).toEqual(mockTemplate);
    })

    it('should throw an error if updateFeatures is unsuccessful', async () => {
      const mockUpdateResult: IEditFeatureResult = { objectId: 1, success: false };
      const mockTemplate = {
        TEMPLATE_NAME: "Template 1",
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "123",
      };
  
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: [mockUpdateResult] });
  
      await expect(WqimsChecklist.updateTemplateFeature(mockTemplate)).rejects.toEqual({
        error: "Error updating template",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    })

    it('should throw an error if updateFeatures throws an error', async () => {
      (updateFeatures as jest.Mock).mockRejectedValue(new Error("Update failed"));

      await expect(WqimsChecklist.updateTemplateFeature({})).rejects.toEqual({
        error: "Update failed",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })

  describe("updateItemFeatures", () => {
    it('should update an item feature', async () => {
      const mockUpdateResult: IEditFeatureResult[] = [{ objectId: 1, success: true }, { objectId: 2, success: true }];
      const mockItems = [
        {
          DESCRIPTION: "Item 1",
          ORDER_: 1,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "789",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user1",
          COMPLETED_AT: 0,
        },
        {
          DESCRIPTION: "Item 2",
          ORDER_: 2,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "012",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user2",
          COMPLETED_AT: 0,
        }
      ] as IChecklistItem[];
  
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: mockUpdateResult });
  
      const result = await WqimsChecklist.updateItemFeatures(mockItems);
  
      expect(updateFeatures).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });

    it('should throw an error if updateFeatures is unsuccessful', async () => {
      const mockUpdateResult: IEditFeatureResult[] = [{ objectId: 1, success: true }, { objectId: 2, success: false }];
      const mockItems = [
        {
          DESCRIPTION: "Item 1",
          ORDER_: 1,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "789",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user1",
          COMPLETED_AT: 0,
        },
        {
          DESCRIPTION: "Item 2",
          ORDER_: 2,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "012",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user2",
          COMPLETED_AT: 0,
        }
      ] as IChecklistItem[];
  
      (updateFeatures as jest.Mock).mockResolvedValue({ updateResults: mockUpdateResult });

      await expect(WqimsChecklist.updateItemFeatures(mockItems)).rejects.toEqual({
        error: "Error updating items",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should throw an error if updateFeatures throws an error', async () => {
      (updateFeatures as jest.Mock).mockRejectedValue(new Error("Update failed"));

      await expect(WqimsChecklist.updateItemFeatures([])).rejects.toEqual({
        error: "Update failed",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })

  describe("addItemsToTemplate", () => {
    it('should add items to a template', async () => {
      const mockAddResult: IEditFeatureResult[] = [{ objectId: 1, success: true }, { objectId: 2, success: true }];
      const mockItems = [
        {
          DESCRIPTION: "Item 1",
          ORDER_: 1,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "789",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user1",
          COMPLETED_AT: 0,
        },
        {
          DESCRIPTION: "Item 2",
          ORDER_: 2,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "012",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user2",
          COMPLETED_AT: 0,
        }
      ] as IChecklistItem[];
  
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: mockAddResult });
  
      // const result = await WqimsChecklist.addItemsToTemplate(mockItems);
  
      expect(addFeatures).toHaveBeenCalled();
      // expect(result).toEqual(mockAddResult);
    });

    it('should throw an error if addFeatures is unsuccessful', async () => {
      const mockAddResult: IEditFeatureResult[] = [{ objectId: 1, success: true }, { objectId: 2, success: false }];
      const mockItems = [
        {
          DESCRIPTION: "Item 1",
          ORDER_: 1,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "789",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user1",
          COMPLETED_AT: 0,
        },
        {
          DESCRIPTION: "Item 2",
          ORDER_: 2,
          CREATED_AT: 0,
          UPDATED_AT: 0,
          GLOBALID: "012",
          TEMPLATE_ID: "123",
          STATUS: "active",
          COMPLETED_BY: "user2",
          COMPLETED_AT: 0,
        }
      ] as IChecklistItem[];
  
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: mockAddResult });

      // await expect(WqimsChecklist.addItemsToTemplate(mockItems)).rejects.toEqual({
      //   error: "Error adding items",
      //   message: "Checklist PUT error",
      // });
    });

    it('should throw an error if addFeatures throws an error', async () => {
      (addFeatures as jest.Mock).mockRejectedValue(new Error("Add failed"));

      // await expect(WqimsChecklist.addItemsToTemplate([])).rejects.toEqual({
      //   error: "Add failed",
      //   message: "Checklist PUT error"
      // })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })

  describe("addItemFeature", () => {
    it("should add an item feature", async () => {
      const mockAddResult: IEditFeatureResult = { objectId: 1, success: true };
      const mockItem = {
        DESCRIPTION: "Item 1",
        ORDER_: 1,
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "789",
        TEMPLATE_ID: "123",
        STATUS: "active",
        COMPLETED_BY: "user1",
        COMPLETED_AT: 0,
      };
      const mockTemplate = new WqimsChecklist({ TEMPLATE_NAME: "Template 1", CREATED_AT: 0, UPDATED_AT: 0, GLOBALID: "123", items: [mockItem] });

      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [mockAddResult] });

      const result = await mockTemplate.addItemFeature();

      expect(addFeatures).toHaveBeenCalled();
      expect(result).toHaveProperty("globalId");
    })

    it('should throw an error if the add operation is unsuccessful', async () => {
      const mockTemplate = new WqimsChecklist({ TEMPLATE_NAME: "Template 1", CREATED_AT: 0, UPDATED_AT: 0, GLOBALID: "123", items: [] });
      
      (addFeatures as jest.Mock).mockResolvedValue({ addResults: [{ globalId: 'test', objectId: 1, success: false }] });

      await expect(mockTemplate.addItemFeature()).rejects.toEqual({
        error: "Error adding item",
        message: "Checklist PUT error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });

    it("should throw and error if the add operation throws an error", async () => {
      const mockTemplate = new WqimsChecklist({ TEMPLATE_NAME: "Template 1", CREATED_AT: 0, UPDATED_AT: 0, GLOBALID: "123", items: [] });
      (addFeatures as jest.Mock).mockRejectedValue(new Error("Add failed"));

      await expect(mockTemplate.addItemFeature()).rejects.toEqual({
        error: "Add failed",
        message: "Checklist PUT error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })
})