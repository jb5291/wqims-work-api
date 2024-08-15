import { appLogger } from "./appLogger";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env")) {
  // use ".env" file to supply environment variables
  appLogger.debug("Using .env file to supply config environment variables");
  dotenv.config({ path: ".env" });
}

function parse_env_int(key: string) {
  const val = process.env[key];
  if (!val) {
    appLogger.error(`Please define ${key} in .env`);
    process.exit(1);
  }
  let num: number;
  if (val && !Number.isNaN(Number.parseInt(val))) {
    num = Number.parseInt(val);
  } else {
    appLogger.error(`Please define a valid number value for ${key} in .env`);
    process.exit(1);
  }
  return num;
}

function get_env_val(key: string) {
  const val = process.env[key];
  if (!val) {
    appLogger.error(`Please define ${key} in .env`);
    process.exit(1);
  }
  return val;
}

export const PROXY_LISTEN_PORT = get_env_val("PORT");
export const FE_LISTEN_PORT = get_env_val("FE_PORT");
export const ENVIRONMENT = process.env.NODE_ENV;

export const BASEURL = process.env["BASEURL"] ? (process.env["BASEURL"] as string) : "";

export const FE_FULL_URL = process.env["FE_FULL_URL"] ? (process.env["FE_FULL_URL"] as string) : "";

export const ALLOWED_ORIGINS = [BASEURL, FE_FULL_URL, `${BASEURL}:${PROXY_LISTEN_PORT}`];

export const WQIMS_DB_CONFIG = {
  username: get_env_val("WQIMS_DB_UN"),
  password: get_env_val("WQIMS_DB_PW"),
  connection_string: get_env_val("WQIMS_DB_TNS"),
  usersTbl: get_env_val("WQIMS_DB_USERS"),
  notificationGrpsTbl: get_env_val("WQIMS_DB_NOTIF_GRPS"),
  notificationGrpMembersTbl: get_env_val("WQIMS_DB_NOTIF_GRP_MEMBERS"),
  notificationGrpThrshldTbl: get_env_val("WQIMS_DB_NOTIF_GRP_THRSHLD"),
  thresholdTbl: get_env_val("WQIMS_DB_THRSHLD"),
  alertsTbl: get_env_val("WQIMS_DB_ALERTS"),
  userRolesTbl: get_env_val("WQIMS_DB_USER_ROLES"),
  rolesTbl: get_env_val("WQIMS_DB_ROLES"),
  checklistTemplateTbl: get_env_val("WQIMS_DB_CHECKLIST_TEMPLATE"),
  checklistItemTbl: get_env_val("WQIMS_DB_CHECKLIST_ITEMS"),
};

// configs for all apis
export const authConfig = {
  msal: {
    id: get_env_val("MS_CLIENT_ID"),
    secret: get_env_val("MS_SECRET"),
    tenant: get_env_val("MS_TENANT_ID"),
    authority: "https://login.microsoftonline.com",
    authorizePath: `${get_env_val("MS_TENANT_ID")}/oauth2/v2.0/authorize`,
    tokenPath: `${get_env_val("MS_TENANT_ID")}/oauth2/v2.0/token`,
    graphEndpoint: "https://graph.microsoft.com", // default,
    redirectUri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
    jwksUri_1: `https://login.microsoftonline.com/${get_env_val("MS_TENANT_ID")}/discovery/v2.0/keys`,
    issuer: `https://sts.windows.net/${get_env_val("MS_TENANT_ID")}/`,
  },
  arcgis: {
    id: get_env_val("WQIMS_REST_APP_ID"),
    secret: get_env_val("WQIMS_REST_APP_SECRET"),
    token_url: get_env_val("WQIMS_TOKEN_URL"),
    feature_url: get_env_val("WQIMS_REST_ROOT"),
    layers: {
      alerts: get_env_val("WQIMS_ALERTS_LYR_ID"),
      users: get_env_val("WQIMS_USERS_LYR_ID"),
      thresholds: get_env_val("WQIMS_THRESHOLDS_LYR_ID"),
      roles: get_env_val("WQIMS_ROLES_LYR_ID"),
      groups: get_env_val("WQIMS_GROUPS_LYR_ID"),
      users_groups: get_env_val("WQIMS_USERS_GROUPS_LYR_ID"),
      users_roles: get_env_val("WQIMS_USERS_ROLES_LYR_ID"),
      thresholds_groups: get_env_val("WQIMS_THRESHOLDS_GROUPS_LYR_ID"),
    },
  },
  everbridge: {
    username: get_env_val("EB_UN"),
    password: get_env_val("EB_PW"),
    organization_id: get_env_val("EB_ORG_ID"),
    group_id: get_env_val("EB_WQIMS_GRP_ID"),
    sms_id: get_env_val("EB_WQIMS_DP_SMS_ID"),
    email_id: get_env_val("EB_WQIMS_DP_EMAIL_ID"),
    record_id: get_env_val("EB_WQIMS_RECORD_ID"),
  },
  jwt_secret_key: get_env_val("JWT_SECRET_KEY"),
};

export const TLS_CERT_INFO = {
  type: process.env["APP_CERT_TYPE"],
  cert: process.env["APP_CERT_PATH"],
  key: process.env["APP_CERT_KEY"],
};
if (!TLS_CERT_INFO || !TLS_CERT_INFO.type || !TLS_CERT_INFO.cert || !TLS_CERT_INFO.key) {
  appLogger.warn("TLS Certificate information not found or incomplete, app will run in HTTP mode.");
}
if (TLS_CERT_INFO && TLS_CERT_INFO.type && !["pem", "pfx"].includes(TLS_CERT_INFO.type)) {
  appLogger.error("APP_CERT_TYPE must be 'pem' or 'pfx'");
  process.exit(1);
}

const emailRecipients = process.env["EMAIL_RECIPIENTS"];
let emailRecipientsList: string[] = [];
if (emailRecipients) {
  emailRecipientsList = emailRecipients.split(",");
  if (emailRecipientsList.length < 1) {
    appLogger.error("Must define at least one EMAIL_RECIPIENTS");
    process.exit(1);
  }
}
export const EMAIL_CONFIG = {
  email_service_url: get_env_val("EMAIL_SERVICE_URL"),
  email_from_address: get_env_val("EMAIL_FROM_ADDR"),
  recipients: emailRecipientsList,
};

export const TEST_SMS_NUMBER = get_env_val("TEST_SMS_NUMBER");
export const TEST_SMS_NUMBER_CARRIER = get_env_val("TEST_SMS_NUMBER_CARRIER");
