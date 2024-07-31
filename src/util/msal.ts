import { authConfig } from "./secrets";
import * as msal from '@azure/msal-node';

const tokenRequest = { scopes: [`${authConfig.msal.auth.graphEndpoint}/.default`]}
const apiConfig = { uri: `${authConfig.msal.auth.graphEndpoint}/v1.0/me`}

/* const clientAssertionCallback: msal.ClientAssertionCallback = async (
  config: any
): Promise<string>  => {
  // network request that uses config.clientId and (optionally) config.tokenEndpoint
  console.log(config);
  const result: string = await Promise.resolve(
    "client assertion here"
  );
  return result;
} */

const clientConfig = {
  auth: {
    clientId: authConfig.msal.client.id,
    authority: `${authConfig.msal.auth.authority}/${authConfig.msal.client.tenant}`,
    clientSecret: authConfig.msal.client.secret,
    // ClientAssertion: clientAssertionCallback,
  },
};

// need to be transitioned to msal
/* async function getADUsers(searchQuery: string) {
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

async function getUserDetails(auth: any) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${auth.access_token}`
    }
  });

  if(!res.ok) {
    appLogger.error(res.statusText);
    process.exit(1);
  }

  return await res.json();
} */

export const cca = new msal.ConfidentialClientApplication(clientConfig);