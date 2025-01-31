import { appLogger } from "./appLogger";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables from .env file if it exists
if (fs.existsSync(".env")) {
    appLogger.debug("Using .env file to supply config environment variables");
    dotenv.config({ path: ".env" });
}

/**
 * Parses an environment variable as an integer.
 * @param {string} key - The key of the environment variable.
 * @returns {number} - The parsed integer value.
 */
const parseEnvInt = (key: string): number => {
    const val = process.env[key];
    if (!val || isNaN(Number(val))) {
        appLogger.error(`Please define a valid number value for ${key} in .env`);
        process.exit(1);
    }
    return parseInt(val);
};

/**
 * Retrieves the value of an environment variable.
 * @param {string} key - The key of the environment variable.
 * @returns {string} - The value of the environment variable.
 */
const getEnvVal = (key: string): string => {
    const val = process.env[key];
    if (!val) {
        appLogger.error(`Please define ${key} in .env`);
        process.exit(1);
    }
    return val;
};

// Environment configuration constants
export const PROXY_LISTEN_PORT = getEnvVal("PORT");
export const FE_LISTEN_PORT = getEnvVal("FE_PORT");
export const ENVIRONMENT = process.env.NODE_ENV;
export const BASEURL = process.env.BASEURL || "";
export const FE_FULL_URL = process.env.FE_FULL_URL || "";
export const ALLOWED_ORIGINS = [BASEURL, FE_FULL_URL, `${BASEURL}:${PROXY_LISTEN_PORT}`];

// Database configuration object
export const WQIMS_DB_CONFIG = {
    username: getEnvVal("WQIMS_DB_UN"),
    password: getEnvVal("WQIMS_DB_PW"),
    connection_string: getEnvVal("WQIMS_DB_TNS"),
    usersTbl: getEnvVal("WQIMS_DB_USERS"),
    notificationGrpsTbl: getEnvVal("WQIMS_DB_NOTIF_GRPS"),
    notificationGrpMEMBERSTbl: getEnvVal("WQIMS_DB_NOTIF_GRP_MEMBERS"),
    notificationGrpThrshldTbl: getEnvVal("WQIMS_DB_NOTIF_GRP_THRSHLD"),
    thresholdTbl: getEnvVal("WQIMS_DB_THRSHLD"),
    alertsTbl: getEnvVal("WQIMS_DB_ALERTS"),
    userRolesTbl: getEnvVal("WQIMS_DB_USER_ROLES"),
    rolesTbl: getEnvVal("WQIMS_DB_ROLES"),
    checklistTemplateTbl: getEnvVal("WQIMS_DB_CHECKLIST_TEMPLATE"),
    checklistItemTbl: getEnvVal("WQIMS_DB_CHECKLIST_ITEMS"),
};

// Authentication configuration object
export const authConfig = {
    msal: {
        id: getEnvVal("MS_CLIENT_ID"),
        secret: getEnvVal("MS_SECRET"),
        tenant: getEnvVal("MS_TENANT_ID"),
        authority: "https://login.microsoftonline.com",
        authorizePath: `${getEnvVal("MS_TENANT_ID")}/oauth2/v2.0/authorize`,
        tokenPath: `${getEnvVal("MS_TENANT_ID")}/oauth2/v2.0/token`,
        graphEndpoint: "https://graph.microsoft.com",
        redirectUri: `${BASEURL}:${PROXY_LISTEN_PORT}/auth/callback`,
        jwksUri_1: `https://login.microsoftonline.com/${getEnvVal("MS_TENANT_ID")}/discovery/v2.0/keys`,
        issuer: `https://sts.windows.net/${getEnvVal("MS_TENANT_ID")}/`,
    },
    arcgis: {
        username: process.env.ARCGIS_USERNAME || '',
        password: process.env.ARCGIS_PASSWORD || '',
        token_url: process.env.ARCGIS_TOKEN_URL || '',
        feature_url: getEnvVal("WQIMS_REST_ROOT"),
        layers: {
            alerts: getEnvVal("WQIMS_ALERTS_LYR_ID"),
            users: getEnvVal("WQIMS_USERS_LYR_ID"),
            thresholds: getEnvVal("WQIMS_THRESHOLDS_LYR_ID"),
            roles: getEnvVal("WQIMS_ROLES_LYR_ID"),
            groups: getEnvVal("WQIMS_GROUPS_LYR_ID"),
            checklist_templates: getEnvVal("WQIMS_CHECKLIST_TEMPLATES_LYR_ID"),
            checklist_items: getEnvVal("WQIMS_CHECKLIST_ITEMS_LYR_ID"),
            
            users_groups: getEnvVal("WQIMS_USERS_GROUPS_LYR_ID"),
            users_roles: getEnvVal("WQIMS_USERS_ROLES_LYR_ID"),
            thresholds_groups: getEnvVal("WQIMS_THRESHOLDS_GROUPS_LYR_ID"),
            usergroups_rel_id: getEnvVal("WQIMS_USERGROUPS_REL_ID"),
            userroles_rel_id: getEnvVal("WQIMS_USERROLES_REL_ID"),
            thresholdsgroups_rel_id: getEnvVal("WQIMS_THRESHOLDGROUPS_REL_ID"),
            templates_items_rel_id: getEnvVal("WQIMS_TEMPLATES_ITEMS_REL_ID"),
        },
    },
    everbridge: {
        username: getEnvVal("EB_UN"),
        password: getEnvVal("EB_PW"),
        organization_id: getEnvVal("EB_ORG_ID"),
        group_id: getEnvVal("EB_WQIMS_GRP_ID"),
        sms_id: getEnvVal("EB_WQIMS_DP_SMS_ID"),
        email_id: getEnvVal("EB_WQIMS_DP_EMAIL_ID"),
        record_id: getEnvVal("EB_WQIMS_RECORD_ID"),
        rest_url: "https://api.everbridge.net/rest"
    },
    jwt_secret_key: getEnvVal("JWT_SECRET_KEY"),
    payload_secret_key: getEnvVal("PAYLOAD_SECRET_KEY")
};

// TLS certificate information
export const TLS_CERT_INFO = {
    type: process.env.APP_CERT_TYPE,
    cert: process.env.APP_CERT_PATH,
    key: process.env.APP_CERT_KEY,
};

// Validate TLS certificate information
if (!TLS_CERT_INFO.type || !TLS_CERT_INFO.cert || !TLS_CERT_INFO.key) {
    appLogger.warn("TLS Certificate information not found or incomplete, app will run in HTTP mode.");
} else if (!["pem", "pfx"].includes(TLS_CERT_INFO.type)) {
    appLogger.error("APP_CERT_TYPE must be 'pem' or 'pfx'");
    process.exit(1);
}

// Email configuration
/* const emailRecipients = process.env.EMAIL_RECIPIENTS;
const emailRecipientsList = emailRecipients ? emailRecipients.split(",") : [];
if (emailRecipientsList.length < 1) {
    appLogger.error("Must define at least one EMAIL_RECIPIENTS");
    process.exit(1);
} */

/* export const EMAIL_CONFIG = {
    email_service_url: getEnvVal("EMAIL_SERVICE_URL"),
    email_from_address: getEnvVal("EMAIL_FROM_ADDR"),
    recipients: emailRecipientsList,
}; */

// Test SMS configuration
// export const TEST_SMS_NUMBER = getEnvVal("TEST_SMS_NUMBER");
// export const TEST_SMS_NUMBER_CARRIER = getEnvVal("TEST_SMS_NUMBER_CARRIER");