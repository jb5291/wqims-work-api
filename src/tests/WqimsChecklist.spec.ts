import { ArcGISService } from "../services/ArcGISService";
import { appLogger } from "../util/appLogger";
import { IEditFeatureResult } from "@esri/arcgis-rest-feature-service";
import { IChecklistItem } from "../models/WqimsChecklist";
import WqimsChecklist from "../models/WqimsChecklist";

jest.mock("../services/ArcGISService");
jest.mock("../util/appLogger");

describe("WqimsChecklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })

  describe("getActiveFeatures", () => {
    it("should return active templates and their items", async () => {
      const mockResponse = {
        features: [{
          attributes: {
            CREATED_AT: 0,
            GLOBALID: "123",
            TEMPLATE_NAME: "Template 1",
            UPDATED_AT: 0,
            items: []
          }
        }]
      };

      const mockItemsResponse = {
        features: [{
          attributes: {
            COMPLETED_AT: 0,
            COMPLETED_BY: "user1",
            CREATED_AT: 0,
            DESCRIPTION: "Item 1",
            GLOBALID: "789",
            ORDER_: 1,
            STATUS: "active",
            TEMPLATE_ID: "123",
            UPDATED_AT: 0
          }
        }]
      };

      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockItemsResponse);

      const result = await WqimsChecklist.getActiveFeatures();
      expect(result).toEqual(mockResponse.features);
    });
    
    it('should return an error message if the first query fails', async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error('Failed to query templates'));
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
      (ArcGISService.request as jest.Mock).mockResolvedValue({});

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
      const mockDeleteResponse = {
        deleteResults: [{ objectId: 1, success: true }]
      };

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce(mockDeleteResponse);

      const result = await WqimsChecklist.deleteFeature("url", 1);
      expect(result).toEqual(mockDeleteResponse.deleteResults[0]);
    })

    it("should throw an error if the delete operation fails", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Delete failed"));

      await expect(WqimsChecklist.deleteFeature("url", 1))
        .rejects.toMatchObject({
          error: "Delete failed",
          message: "Checklist DELETE error"
        });
    });
  });

  describe ("AddTemplateFeature", () => {
    it("should add a template feature", async() => {
      const mockAddResponse = {
        addResults: [{ objectId: 1, success: true }]
      };

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce(mockAddResponse);

      const result = await WqimsChecklist.addTemplateFeature("Test Template", Date.now());
      expect(result).toEqual(mockAddResponse.addResults[0]);
    })

    it("should throw an error if add fails", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({
          addResults: [{ success: false, error: { description: "Add failed" } }]
        });

      await expect(WqimsChecklist.addTemplateFeature("Test", Date.now()))
        .rejects.toThrow("Add failed");
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
  
      (ArcGISService.request as jest.Mock).mockResolvedValue({ updateResults: [mockUpdateResult] });
  
      const result = await WqimsChecklist.updateTemplateFeature(mockTemplate);
  
      expect(ArcGISService.request).toHaveBeenCalled();
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
  
      (ArcGISService.request as jest.Mock).mockResolvedValue({ updateResults: [mockUpdateResult] });
  
      await expect(WqimsChecklist.updateTemplateFeature(mockTemplate)).rejects.toEqual({
        error: "Error updating template",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    })

    it('should throw an error if updateFeatures throws an error', async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Update failed"));

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
  
      (ArcGISService.request as jest.Mock).mockResolvedValue({ updateResults: mockUpdateResult });
  
      const result = await WqimsChecklist.updateItemFeatures(mockItems);
  
      expect(ArcGISService.request).toHaveBeenCalled();
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
  
      (ArcGISService.request as jest.Mock).mockResolvedValue({ updateResults: mockUpdateResult });

      await expect(WqimsChecklist.updateItemFeatures(mockItems)).rejects.toEqual({
        error: "Error updating items",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should throw an error if updateFeatures throws an error', async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Update failed"));

      await expect(WqimsChecklist.updateItemFeatures([])).rejects.toEqual({
        error: "Update failed",
        message: "Checklist PATCH error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });
  })

  describe("addItemsToTemplate", () => {
    it('should add items to a template', async () => {
      const mockItems = [{
        DESCRIPTION: "Item 1",
        ORDER_: 1,
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "789",
        TEMPLATE_ID: "123",
        STATUS: "active",
        COMPLETED_BY: "user1",
        COMPLETED_AT: 0,
      }] as IChecklistItem[];

      const mockAddResult: IEditFeatureResult[] = [{ objectId: 1, success: true }];
      const mockTemplate = new WqimsChecklist({ 
        TEMPLATE_NAME: "Template 1", 
        CREATED_AT: 0, 
        UPDATED_AT: 0, 
        GLOBALID: "123", 
        items: mockItems 
      });

      (ArcGISService.request as jest.Mock).mockResolvedValue({ addResults: mockAddResult });

      const result = await mockTemplate.addItemsToTemplate();
      expect(ArcGISService.request).toHaveBeenCalled();
      expect(result).toEqual(mockAddResult);
    });

    it('should throw an error if addFeatures is unsuccessful', async () => {
      const mockItems = [{
        DESCRIPTION: "Item 1",
        ORDER_: 1,
        CREATED_AT: 0,
        UPDATED_AT: 0,
        GLOBALID: "789",
        TEMPLATE_ID: "123",
        STATUS: "active",
        COMPLETED_BY: "user1",
        COMPLETED_AT: 0,
      }] as IChecklistItem[];

      const mockTemplate = new WqimsChecklist({ 
        TEMPLATE_NAME: "Template 1", 
        CREATED_AT: 0, 
        UPDATED_AT: 0, 
        GLOBALID: "123", 
        items: mockItems 
      });

      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Error adding items"));

      await expect(mockTemplate.addItemsToTemplate()).rejects.toEqual({
        error: "Error adding items",
        message: "Checklist PUT error"
      });
    });

    it('should throw an error if addFeatures throws an error', async () => {
      const mockTemplate = new WqimsChecklist({ 
        TEMPLATE_NAME: "Template 1", 
        CREATED_AT: 0, 
        UPDATED_AT: 0, 
        GLOBALID: "123", 
        items: [] 
      });

      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Add failed"));

      await expect(mockTemplate.addItemsToTemplate()).rejects.toEqual({
        error: "Add failed",
        message: "Checklist PUT error"
      });
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

      (ArcGISService.request as jest.Mock).mockResolvedValue({ addResults: [mockAddResult] });

      const result = await mockTemplate.addItemFeature();

      expect(ArcGISService.request).toHaveBeenCalled();
      expect(result).toHaveProperty("globalId");
    })

    it('should throw an error if the add operation is unsuccessful', async () => {
      const mockTemplate = new WqimsChecklist({ TEMPLATE_NAME: "Template 1", CREATED_AT: 0, UPDATED_AT: 0, GLOBALID: "123", items: [] });
      
      (ArcGISService.request as jest.Mock).mockResolvedValue({ addResults: [{ globalId: 'test', objectId: 1, success: false }] });

      await expect(mockTemplate.addItemFeature()).rejects.toEqual({
        error: "Error adding item",
        message: "Checklist PUT error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });

    it("should throw and error if the add operation throws an error", async () => {
      const mockTemplate = new WqimsChecklist({ TEMPLATE_NAME: "Template 1", CREATED_AT: 0, UPDATED_AT: 0, GLOBALID: "123", items: [] });
      (ArcGISService.request as jest.Mock).mockRejectedValue(new Error("Add failed"));

      await expect(mockTemplate.addItemFeature()).rejects.toEqual({
        error: "Add failed",
        message: "Checklist PUT error"
      })
      expect(appLogger.error).toHaveBeenCalled();
    });

    it("should handle add success without GLOBALID", async () => {
      const mockTemplate = new WqimsChecklist({ 
        TEMPLATE_NAME: "Template 1", 
        CREATED_AT: 0, 
        UPDATED_AT: 0, 
        items: [],
        GLOBALID: undefined  // Set to undefined instead of deleting
      });

      const mockAddResult = { 
        objectId: 1, 
        success: true 
      };

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [mockAddResult]
      });

      const result = await mockTemplate.addItemFeature();
      expect(result).toEqual(mockAddResult);
    });
  })

  describe("cleanItem", () => {
    it("should clean and format a checklist item", () => {
      const mockItem: IChecklistItem = {
        DESCRIPTION: "Test item",
        ORDER_: 1,
        CREATED_AT: null,
        UPDATED_AT: null,
        STATUS: "Not Started",
        COMPLETED_BY: null,
        COMPLETED_AT: null,
        GLOBALID: null,
        OBJECTID: null,
        TEMPLATE_ID: null
      };

      const templateId = "{test-template-id}";
      const result = WqimsChecklist.cleanItem(mockItem, templateId);

      expect(result).toMatchObject({
        ...mockItem,
        TEMPLATE_ID: templateId,
        CREATED_AT: expect.any(Number),
        UPDATED_AT: expect.any(Number),
        GLOBALID: expect.stringMatching(/^\{[A-F0-9-]+\}$/)
      });
    });

    it("should preserve existing timestamps and GLOBALID", () => {
      const mockItem: IChecklistItem = {
        DESCRIPTION: "Test item",
        ORDER_: 1,
        CREATED_AT: 1000,
        UPDATED_AT: 2000,
        STATUS: "Not Started",
        COMPLETED_BY: null,
        COMPLETED_AT: null,
        GLOBALID: "{existing-id}",
        OBJECTID: null,
        TEMPLATE_ID: null
      };

      const result = WqimsChecklist.cleanItem(mockItem, "test-template");
      expect(result.CREATED_AT).toBe(1000);
      expect(result.UPDATED_AT).toBe(2000);
      expect(result.GLOBALID).toBe("{existing-id}");
    });
  });

  describe("getChecklistItems", () => {
    it("should return empty array when no items found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        features: []
      });

      const result = await WqimsChecklist.getChecklistItems(1);
      expect(result).toEqual([]);
    });

    it("should handle query error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Query failed"));

      await expect(WqimsChecklist.getChecklistItems(1)).rejects.toEqual({
        error: "Query failed",
        message: "Checklist GET error"
      });
    });
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      const checklist = new WqimsChecklist(null);
      expect(checklist.ACTIVE).toBe(1);
      expect(checklist.items).toEqual([]);
      expect(checklist.TEMPLATE_NAME).toBe("");
    });

    it("should initialize with provided values", () => {
      const mockData = {
        OBJECTID: 1,
        ACTIVE: 1,
        TEMPLATE_NAME: "Test Template",
        CREATED_AT: Date.now(),
        UPDATED_AT: Date.now(),
        GLOBALID: "{test-id}",
        items: [{
          DESCRIPTION: "Test item",
          ORDER_: 1,
          CREATED_AT: Date.now(),
          UPDATED_AT: Date.now(),
          STATUS: "Not Started",
          COMPLETED_BY: null,
          COMPLETED_AT: null,
          GLOBALID: "{item-id}",
          OBJECTID: 1,
          TEMPLATE_ID: "{test-id}"
        }]
      };

      const checklist = new WqimsChecklist(mockData);
      expect(checklist).toMatchObject(mockData);
    });
  });

  describe("removeItemFeatures", () => {
    it("should remove multiple items", async () => {
      const mockItems = [
        { OBJECTID: 1 },
        { OBJECTID: 2 }
      ] as IChecklistItem[];

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        deleteResults: [
          { objectId: 1, success: true },
          { objectId: 2, success: true }
        ]
      });

      const result = await WqimsChecklist.removeItemFeatures(mockItems);
      expect(result).toHaveLength(2);
      expect(result.every(r => r.success)).toBe(true);
    });

    it("should handle delete failure", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Delete failed"));

      await expect(WqimsChecklist.removeItemFeatures([{ OBJECTID: 1 } as IChecklistItem]))
        .rejects.toEqual({
          error: "Delete failed",
          message: "Checklist DELETE error"
        });
    });
  });

  describe("globalId getter/setter", () => {
    it("should get and set globalId", () => {
      const checklist = new WqimsChecklist(null);
      checklist.globalId = "{test-id}";
      expect(checklist.globalId).toBe("{test-id}");
    });
  });

  describe("removeRelationshipFromTemplate", () => {
    it("should remove relationship successfully", async () => {
      (ArcGISService.request as jest.Mock)
        .mockResolvedValueOnce({ objectIds: [1] })
        .mockResolvedValueOnce({ 
          deleteResults: [{ objectId: 1, success: true }] 
        });

      const result = await WqimsChecklist.removeRelationshipFromTemplate(1);
      expect(result.success).toBe(true);
    });

    it("should handle no relationships found", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({ objectIds: [] });

      const result = await WqimsChecklist.removeRelationshipFromTemplate(1);
      expect(result).toEqual({
        objectId: -1,
        success: true,
        error: {
          code: 999,
          description: "No relationships found"
        }
      });
    });

    it("should handle delete error", async () => {
      (ArcGISService.request as jest.Mock).mockRejectedValueOnce(new Error("Delete failed"));

      await expect(WqimsChecklist.removeRelationshipFromTemplate(1))
        .rejects.toEqual({
          error: "Delete failed",
          message: "Checklist DELETE error"
        });
    });
  });

  describe("addTemplateFeature", () => {
    it("should add template feature successfully", async () => {
      const mockResult = { 
        objectId: 1, 
        success: true, 
        globalId: "{test-id}" 
      };
      
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [mockResult]
      });

      const result = await WqimsChecklist.addTemplateFeature("Test Template", Date.now());
      expect(result).toEqual(mockResult);
    });

    it("should handle unsuccessful add", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{
          objectId: 1,
          success: false,
          error: { description: "Add failed" }
        }]
      });

      await expect(WqimsChecklist.addTemplateFeature("Test", Date.now()))
        .rejects.toThrow("Add failed");
    });

    it("should handle add error without description", async () => {
      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{
          objectId: 1,
          success: false,
          error: {}
        }]
      });

      await expect(WqimsChecklist.addTemplateFeature("Test", Date.now()))
        .rejects.toThrow("Add failed");
    });
  });

  describe("addItemFeatures", () => {
    it("should add multiple items successfully", async () => {
      const mockItems = [{
        DESCRIPTION: "Item 1",
        ORDER_: 1,
        CREATED_AT: null,
        UPDATED_AT: null,
        STATUS: "active",
        COMPLETED_BY: null,
        COMPLETED_AT: null,
        GLOBALID: null,
        OBJECTID: null,
        TEMPLATE_ID: null
      }] as IChecklistItem[];

      const mockResults = [{
        objectId: 1,
        success: true,
        globalId: "{test-id}"
      }];

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: mockResults
      });

      const result = await WqimsChecklist.addItemFeatures(mockItems);
      expect(result).toEqual(mockResults);
      expect(mockItems[0].OBJECTID).toBe(1);
    });

    it("should handle unsuccessful add", async () => {
      const mockItems = [{
        DESCRIPTION: "Item 1",
        ORDER_: 1
      }] as IChecklistItem[];

      (ArcGISService.request as jest.Mock).mockResolvedValueOnce({
        addResults: [{ success: false }]
      });

      await expect(WqimsChecklist.addItemFeatures(mockItems))
        .rejects.toEqual({
          error: "Error adding items",
          message: "Checklist PUT error"
        });
    });
  });
})