import path from "path";
import winston from "winston";

/**
 * Returns the current date and time as a localized string.
 * @returns {string} - The current date and time.
 */
const getDateLabel = () => new Date().toLocaleString();

/**
 * Custom log format for action logs.
 * @param {Object} param0 - Log information.
 * @param {string} param0.level - Log level.
 * @param {string} param0.message - Log message.
 * @param {string} param0.timestamp - Timestamp of the log.
 * @param {string} [param0.id] - Optional ID associated with the log.
 * @param {string} [param0.ip] - Optional IP address associated with the log.
 * @returns {string} - Formatted log string.
 */
const actionLogFormat = winston.format.printf(({ level, message, timestamp, id, ip }) =>
    `${timestamp} [IP: ${ip || "unknown"}] [ID: ${id || "no-token-cookie"}] : ${message}`
);

/**
 * Logger options for the application logger.
 * @type {winston.LoggerOptions}
 */
const appLogOptions: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "debug.log"),
      level: "debug",
      maxFiles: 3,
      maxsize: 50000000,
      format: winston.format.printf(info => `${getDateLabel()} - ${info.level} - ${info.message}`),
    }),
  ],
};

/**
 * Logger for action-specific logs.
 * @type {winston.Logger}
 */
export const actionLogger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), actionLogFormat),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "actions.log"),
      level: "info",
      maxFiles: 3,
      maxsize: 50000000,
    }),
  ],
});

/**
 * Logger for general application logs.
 * @type {winston.Logger}
 */
export const appLogger = winston.createLogger(appLogOptions);

/**
 * Logs an error message using the application logger.
 * @param {any} error - The error to log. If it's an instance of Error, logs the stack trace.
 */
export const logError = (error: any) => {
  appLogger.error(error instanceof Error ? error.stack : error);
};