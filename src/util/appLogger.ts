import path from "path";
import winston from "winston";

function getDateLabel(){
    return new Date().toLocaleString();
}

// configure the application log
const appLogOptions: winston.LoggerOptions = {
    transports: [
        new winston.transports.Console({
            level: process.env.NODE_ENV === "development" ? "debug" : "info",
            format: winston.format.combine(
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: path.join(__dirname, "..", "..", "logs", "debug.log"), level: "debug", maxFiles: 3, maxsize: 50000000, format: 
            winston.format.printf((info) => {
                return `${getDateLabel()} - ${info.level} - ${info.message}`;
            })
        })
    ]
};

export const appLogger = winston.createLogger(appLogOptions);

export function logError(error:any){
    if(error instanceof Error){
        appLogger.error(error.stack)
    }
    else{
        appLogger.error(error)
    }
}