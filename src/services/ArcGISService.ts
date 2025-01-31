import axios from 'axios';
import { appLogger } from '../util/appLogger';
import { authConfig } from '../util/secrets';
import qs from 'querystring';
import https from 'https';

export class ArcGISService {
  private static token: string | null = null;
  private static tokenExpiration: Date | null = null;
  private static readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

  private static readonly TOKEN_URL = authConfig.arcgis.token_url;
  private static readonly USERNAME = authConfig.arcgis.username;
  private static readonly PASSWORD = authConfig.arcgis.password;

  // Create a custom HTTPS agent that ignores certificate errors
  private static httpsAgent = new https.Agent({
    rejectUnauthorized: false  // WARNING: Only use in development
  });

  private static async refreshToken(): Promise<void> {
    try {
      const params = qs.stringify({
        f: 'json',
        username: this.USERNAME,
        password: this.PASSWORD,
        client: 'referer',
        referer: 'https://gisdev.wsscwater.com',
        expiration: 60
      });

      const response = await axios.post(this.TOKEN_URL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        httpsAgent: this.httpsAgent  // Use the custom agent
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to get token');
      }

      this.token = response.data.token;
      this.tokenExpiration = new Date(Date.now() + (response.data.expires * 60 * 1000));
      
    } catch (error) {
      appLogger.error('Error refreshing ArcGIS token:', error);
      throw error;
    }
  }

  private static async ensureValidToken(): Promise<string> {
    if (!this.token || !this.tokenExpiration || this.isTokenExpiringSoon()) {
      await this.refreshToken();
    }
    return this.token!;
  }

  private static isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiration) return true;
    return this.tokenExpiration.getTime() - Date.now() < this.TOKEN_REFRESH_BUFFER;
  }

  static async request<T>(
    url: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    try {
      const token = await this.ensureValidToken();
      
      if (method === 'GET') {
        const params = new URLSearchParams();
        params.append('f', 'json');
        params.append('token', token);
        
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            params.append(key, value as string);
          });
        }

        const response = await axios.get(`${url}?${params.toString()}`, {
          headers: {
            'Accept': 'application/json'
          },
          httpsAgent: this.httpsAgent
        });

        return response.data;
      } else {
        // For POST/PUT/DELETE requests
        const params = new URLSearchParams();
        params.append('f', 'json');
        params.append('token', token);

        let postData;
        if (data?.features) {
          // Handle feature operations (add/update features)
          const features = Array.isArray(data.features) ? data.features : [data.features];
          postData = qs.stringify({
            features: JSON.stringify(features)
          });
        } else if (data?.attributes) {
          // Handle single feature without features wrapper
          postData = qs.stringify({
            features: JSON.stringify([{
              attributes: data.attributes,
              geometry: data.geometry
            }])
          });
        } else if (data?.objectIds) {
          // Handle operations that use objectIds (like delete)
          postData = qs.stringify({
            objectIds: Array.isArray(data.objectIds) ? data.objectIds.join(',') : data.objectIds
          });
        } else {
          // Handle any other data
          postData = qs.stringify(data);
        }

        const response = await axios({
          method,
          url: `${url}?${params.toString()}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          data: postData,
          httpsAgent: this.httpsAgent
        });

        if (response.data.error) {
          throw new Error(response.data.error.message || 'ArcGIS API Error');
        }

        return response.data;
      }
    } catch (error) {
      appLogger.error('ArcGIS API request failed:', error);
      throw error;
    }
  }
} 