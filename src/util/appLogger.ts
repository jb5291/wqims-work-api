import path from "path";
import winston from "winston";
import express from "express";
import { jwtDecrypt } from "jose";

function getDateLabel() {
  return new Date().toLocaleString();
}

const actionLogFormat = winston.format.printf(({ level, message, timestamp, id, ip }) => {
  return `${timestamp} [IP: ${ip || "unknown"}] [ID: ${id || "no-token-cookie"}] : ${message}`;
});

// configure the application log
const appLogOptions: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
      format: winston.format.combine(winston.format.simple()),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "debug.log"),
      level: "debug",
      maxFiles: 3,
      maxsize: 50000000,
      format: winston.format.printf((info) => {
        return `${getDateLabel()} - ${info.level} - ${info.message}`;
      }),
    }),
  ],
};

export const actionLogger: winston.Logger = winston.createLogger({
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

export const appLogger = winston.createLogger(appLogOptions);

export function logError(error: any) {
  if (error instanceof Error) {
    appLogger.error(error.stack);
  } else {
    appLogger.error(error);
  }
}
