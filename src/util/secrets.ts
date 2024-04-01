import { appLogger } from "./appLogger";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env")) {
    // use ".env" file to supply environment variables
    appLogger.debug("Using .env file to supply config environment variables");
    dotenv.config({ path: ".env" });
}

function parse_env_int(key: string){
    const val = process.env[key];
    if(!val){
        appLogger.error(`Please define ${key} in .env`);
        process.exit(1);
    }
    let num: number;
    if(val && !Number.isNaN(Number.parseInt(val))){
        num = Number.parseInt(val);
    }
    else{
        appLogger.error(`Please define a valid number value for ${key} in .env`);
        process.exit(1);
    }
    return num;
}

function get_env_val(key:string){
    const val = process.env[key];
    if(!val){
        appLogger.error(`Please define ${key} in .env`);
        process.exit(1);
    }
    return val;
}

export const ENVIRONMENT = process.env.NODE_ENV;

export const BASEURL = process.env["BASEURL"] ? process.env["BASEURL"] as string : "";

export const WQIMS_DB_CONFIG = {
    username: get_env_val("WQIMS_DB_UN"),
    password: get_env_val("WQIMS_DB_PW"),
    connection_string: get_env_val("WQIMS_DB_TNS"),
    WQIMSdb: get_env_val("WQIMS_DB_NAME"),
    usersTbl: get_env_val("WQIMS_DB_USERS"),
    mmisWoTbl: get_env_val("WQIMS_DB_MMIS_WO"),
    limsTbl1: get_env_val("WQIMS_DB_LIMS_1"),
    limsTbl2: get_env_val("WQIMS_DB_LIMS_2"),
    sampleTbl: get_env_val("WQIMS_DB_SMPL"),
    alertsTbl: get_env_val("WQIMS_DB_ALERTS"),
    limsAlertsTbl: get_env_val("WQIMS_DB_LIMS_ALERTS"),
    testTbl: get_env_val("WQIMS_DB_TEST"),
    notifications: get_env_val("WQIMS_DB_NOTIF"),
    notificationGrpsTbl: get_env_val("WQIMS_DB_NOTIF_GRPS"),
    notificationGrpMembersTbl: get_env_val("WQIMS_DB_NOTIF_GRP_MEMBERS"),
    notificationGrpThrshldTbl: get_env_val("WQIMS_DB_NOTIF_GRP_THRSHLD"),
    notificationQueueTbl: get_env_val("WQIMS_DB_NOTIF_Q"),
    thresholdTbl: get_env_val("WQIMS_DB_THRSHLD")
}

export const RPT_DB_CONFIG = {
    username: get_env_val("RPT_DB_UN"),
    password: get_env_val("RPT_DB_PW"),
    connection_string: get_env_val("RPT_DB_TNS"),
    rptdb: get_env_val("RPT_DB_NAME"),
    srwodb: get_env_val("RPT_DB_SRWO")
}

export const MSSQL_CONFIG = {
    user: get_env_val("LIMS_SQL_USER"),
    password: get_env_val("LIMS_SQL_PW"),
    database: get_env_val("LIMS_SQL_DB"),
    server: get_env_val("LIMS_SQL_SERVER"),
}

export const all_pools = [WQIMS_DB_CONFIG.WQIMSdb, RPT_DB_CONFIG.rptdb]

export const PORTAL_TOKEN_URL = get_env_val("PORTAL_TOKEN_URL");
export const OAUTH_CLIENT_ID = get_env_val("OAUTH_CLIENT_ID");
export const OAUTH_SECRET = get_env_val("OAUTH_SECRET");

export const GEOCODE_SERVICE_URL = get_env_val("GEOCODE_SERVICE_URL");
export const G_STREET_FIELD = get_env_val("G_STREET_FIELD");
export const G_CITY_FIELD = get_env_val("G_CITY_FIELD");
export const G_STATE_FIELD = get_env_val("G_STATE_FIELD");
export const G_ZIP_FIELD = get_env_val("G_ZIP_FIELD");

export const PRESSURE_ZONE_SERVICE_URL = get_env_val("PRESSURE_ZONE_SERVICE_URL");

export const TLS_CERT_INFO = {
    type: process.env["APP_CERT_TYPE"],
    cert: process.env["APP_CERT_PATH"],
    key: process.env["APP_CERT_KEY"]
}
if (!TLS_CERT_INFO || !TLS_CERT_INFO.type || !TLS_CERT_INFO.cert || !TLS_CERT_INFO.key){
    appLogger.warn("TLS Certificate information not found or incomplete, app will run in HTTP mode.");
}
if (TLS_CERT_INFO && TLS_CERT_INFO.type && !["pem", "pfx"].includes(TLS_CERT_INFO.type)){
    appLogger.error("APP_CERT_TYPE must be 'pem' or 'pfx'");
    process.exit(1);
}

const emailRecipients = process.env["EMAIL_RECIPIENTS"]
let emailRecipientsList: string[] = [];
if(emailRecipients){
    emailRecipientsList = emailRecipients.split(",");
    if(emailRecipientsList.length < 1){
        appLogger.error("Must define at least one EMAIL_RECIPIENTS");
        process.exit(1);
    }
}
export const EMAIL_CONFIG = {
    email_service_url: get_env_val("EMAIL_SERVICE_URL"),
    email_from_address: get_env_val("EMAIL_FROM_ADDR"),
    recipients: emailRecipientsList
}

export const TEST_SMS_NUMBER = get_env_val("TEST_SMS_NUMBER");
export const TEST_SMS_NUMBER_CARRIER = get_env_val("TEST_SMS_NUMBER_CARRIER");

export const MMIS_LOAD_DATE_RANGE = parse_env_int("MMIS_LOAD_DATE_RANGE");
export const LIMS_LOAD_DATE_RANGE = parse_env_int("LIMS_LOAD_DATE_RANGE");
export const NOTIFICATION_RETRY_LIMIT = parse_env_int("NOTIFICATION_RETRY_LIMIT")