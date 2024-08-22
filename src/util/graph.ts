import { appLogger } from "./appLogger";
import { authConfig } from "./secrets";
import * as msal from '@azure/msal-node';
import 'isomorphic-fetch';
import * as graph from '@microsoft/microsoft-graph-client';

let _appClient: graph.Client;

export default (() => {

  /**
   * Initializes the Microsoft Graph client with the provided access token.
   * @param {string} rawAccessToken - The raw access token for authentication.
   */
  function initGraphClient(rawAccessToken: string) {
    if (!rawAccessToken) {
      appLogger.error("Please provide a valid access token");
      process.exit(1);
    }
    _appClient = graph.Client.init({
      authProvider: (done) => done(null, rawAccessToken)
    });
  }

  /**
   * Retrieves a list of Azure AD users based on the search query.
   * @param {string} searchQuery - The search query to filter users.
   * @returns {Promise<any>} - A promise that resolves to the list of users.
   */
  async function getADUsers(searchQuery: string) {
    try {
      if (!_appClient) {
        appLogger.error("Please provide settings for the graph client");
        process.exit(1);
      }
      return _appClient.api('/users')
          .filter(`startswith(givenName, '${searchQuery}') or startswith(surname, '${searchQuery}')`)
          .top(10)
          .get();
    } catch (error) {
      appLogger.error(error);
      process.exit(1);
    }
  }

  /**
   * Retrieves the details of the authenticated user.
   * @returns {Promise<any>} - A promise that resolves to the user details.
   */
  async function getUserDetails() {
    try {
      return await _appClient.api('/me').get();
    } catch (error) {
      appLogger.error(error);
      process.exit(1);
    }
  }

  // Confidential Client Application for MSAL authentication
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
  };
})();