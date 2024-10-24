import express from "express";
import cors from "cors";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";

import qs from "qs";
import fs from "fs";
import http from "http";
import https from "https";
import cookieParser from "cookie-parser";

import { TLS_CERT_INFO, PROXY_LISTEN_PORT, BASEURL, ALLOWED_ORIGINS } from "./util/secrets";
import groupsRouter from "./routes/groups";
import usersRouter from "./routes/users";
import thresholdsRouter from "./routes/thresholds";
import alertsRouter from "./routes/alerts";
import checklistsRouter from "./routes/checklists";
import { authRouter } from "./routes/auth";

const app = express();

/**
 * Middleware setup for the Express application.
 */
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("query parser", (str: string) => qs.parse(str));
app.use(cookieParser());
app.set("port", PROXY_LISTEN_PORT || 3001);

/**
 * Route handlers for the application.
 */
app.use("/notificationGroups", groupsRouter);
app.use("/users", usersRouter);
app.use("/thresholds", thresholdsRouter);
app.use("/alerts", alertsRouter);
app.use("/checklists", checklistsRouter);
app.use("/auth", authRouter);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WQIMS API",
      version: "1.0.0",
      description: "API documentation generated using Swagger-jsdoc",
    },
  },
  apis: ["./dist/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * Endpoint to serve the Swagger JSON documentation.
 * @name /swagger.json
 * @function
 * @memberof module:routes
 * @inner
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

/**
 * Middleware to serve the Swagger UI documentation.
 */
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));


app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

/**
 * Starts the server with the given options.
 * @param {https.ServerOptions|undefined} options - HTTPS server options or undefined for HTTP.
 */
const startServer = (options: https.ServerOptions | undefined) => {
  const server = options ? https.createServer(options, app) : http.createServer(app);
  server.listen(app.get("port"), "0.0.0.0", () => {
    console.debug(`App is running at ${BASEURL}:${app.get("port")} in ${app.get("env")} mode\nAllowed Origins: ${ALLOWED_ORIGINS}`);
  });
};

/**
 * Conditionally starts the server with HTTPS or HTTP based on TLS certificate information.
 */
if (TLS_CERT_INFO && TLS_CERT_INFO.type && TLS_CERT_INFO.cert && TLS_CERT_INFO.key) {
  const options = TLS_CERT_INFO.type === "pfx"
      ? { pfx: fs.readFileSync(TLS_CERT_INFO.cert), passphrase: TLS_CERT_INFO.key }
      : { key: fs.readFileSync(TLS_CERT_INFO.key), cert: fs.readFileSync(TLS_CERT_INFO.cert) };
  startServer(options);
} else {
  startServer(undefined);
}