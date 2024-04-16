import { appLogger } from "./appLogger";
import 'isomorphic-fetch';
import * as azure from '@azure/identity';
import * as graph from '@microsoft/microsoft-graph-client';
import * as authProviders from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _settings: any;
let _clientSecretCredentials: azure.ClientSecretCredential;
let _appClient: graph.Client;

export default (() => {
  
  function initGraphClient(settings: any) {
    if(!settings){
      appLogger.error("Please provide settings for the graph client");
      process.exit(1);
    }
    _settings = settings;
  
    if(!_settings || !_settings.MS_TENANT_ID || !_settings.MS_CLIENT_ID || !_settings.MS_SECRET){
      appLogger.error("Please provide settings for the graph client");
      process.exit(1);
    }
  
    if(!_clientSecretCredentials){
      _clientSecretCredentials = new azure.ClientSecretCredential(
        _settings.MS_TENANT_ID, 
        _settings.MS_CLIENT_ID, 
        _settings.MS_SECRET
      );
    }
  
    if(!_appClient){
      const authProvider = new authProviders.TokenCredentialAuthenticationProvider(
        _clientSecretCredentials,
        {scopes: ['https://graph.microsoft.com/.default']}
      );
  
      _appClient = graph.Client.initWithMiddleware({authProvider});
    }
  }
  
  async function getADUsers(searchQuery: string, pageNumber: number, pageSize: number) {
    try {
      if(!_appClient){
        appLogger.error("Please provide settings for the graph client");
        process.exit(1);
      }
      return _appClient?.api('/users')
        //.select(['id', 'displayName', 'mail', 'userPrincipalName'])
        .filter(`startswith(givenName, '${searchQuery}')`)
        .top(10)
        .get();
    }
    catch (error) {
      appLogger.error(error);
      process.exit(1);
    }
  }

  async function getUserDetails(auth: any) {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${auth.token.access_token}`
      }
    });

    if(!res.ok) {
      appLogger.error(res.statusText);
      process.exit(1);
    }

    return await res.json();
  }

  return {
    initGraphClient,
    getADUsers,
    getUserDetails
  }
})();