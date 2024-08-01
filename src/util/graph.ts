import { appLogger } from "./appLogger";
import { authConfig } from "./secrets";
import * as msal from '@azure/msal-node';
import 'isomorphic-fetch';
import * as azure from '@azure/identity';
import * as graph from '@microsoft/microsoft-graph-client';
import * as authProviders from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _settings: any;
let _clientSecretCredentials: azure.ClientSecretCredential;
let _appClient: graph.Client;

export default (() => {
  
  function initGraphClient(rawAccessToken: string) {
    if(!rawAccessToken){
      appLogger.error("Please provide a valid access token");
      process.exit(1);
    }
    _appClient = graph.Client.init({
      authProvider: (done) => {
        done(null, rawAccessToken);
      }
    })
    /* if(!settings){
      appLogger.error("Please provide settings for the graph client");
      process.exit(1);
    }
    _settings = settings;
  
    if(!_settings || !_settings.tenant || !_settings.id || !_settings.secret){
      appLogger.error("Please provide settings for the graph client");
      process.exit(1);
    }
  
    if(!_clientSecretCredentials){
      _clientSecretCredentials = new azure.ClientSecretCredential(
        _settings.tenant, 
        _settings.id, 
        _settings.secret
      );
    }
  
    if(!_appClient){
      const authProvider = new authProviders.TokenCredentialAuthenticationProvider(
        _clientSecretCredentials,
        {scopes: [`${authConfig.msal.authority}/.default`]}
      );
  
      _appClient = graph.Client.initWithMiddleware({authProvider});
    } */
  }
  
  async function getADUsers(searchQuery: string) {
    try {
      if(!_appClient){
        appLogger.error("Please provide settings for the graph client");
        process.exit(1);
      }
      return _appClient?.api('/users')
        //.select(['id', 'displayName', 'mail', 'userPrincipalName'])
        .filter(`startswith(givenName, '${searchQuery}') or startswith(surname, '${searchQuery}')`)
        .top(10)
        .get();
    }
    catch (error) {
      appLogger.error(error);
      process.exit(1);
    }
  }

  async function getUserDetails() {
    const user = await _appClient.api('/me').get()
    /* const res = await fetch('https://graph.microsoft.com/v2.0/me', {
      headers: {
        Authorization: `Bearer ${authResult.accessToken}`
      }
    }); */

    /* if(!res.ok) {
      appLogger.error(res.statusText);
      process.exit(1);
    } */

    return user;
  }

  const cca = new msal.ConfidentialClientApplication({
    auth: {
      clientId: authConfig.msal.id,
      authority: `${authConfig.msal.authority}/${authConfig.msal.tenant}`,
      clientSecret: authConfig.msal.secret,
    },
  });

  return {
    initGraphClient,
    getADUsers,
    getUserDetails,
    cca
  }
})();