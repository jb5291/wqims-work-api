import { IFeature, IEditFeatureResult, IQueryFeaturesResponse } from "@esri/arcgis-rest-feature-service";

export interface Wqims {
  addFeature(): Promise<IEditFeatureResult>;
  updateFeature(): Promise<IEditFeatureResult>;
  softDeleteFeature(): Promise<IEditFeatureResult>;
  reactivateFeature(response: IQueryFeaturesResponse): Promise<IEditFeatureResult>;
}

export interface IQueryRelatedResponse {
  relatedRecordGroups?: {
    relatedRecords?: {
      attributes: Record<string, any>;
    }[];
  }[];
}
