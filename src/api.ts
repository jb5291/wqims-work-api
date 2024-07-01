import express from "express";
import cors from 'cors';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import qs from 'qs';
import fs from 'fs';
import http from 'http';
import https from 'https';
import cookieParser from 'cookie-parser';

import { MS_CLIENT_ID, MS_SECRET, MS_TENANT_ID, TLS_CERT_INFO, PROXY_LISTEN_PORT, BASEURL, ALLOWED_ORIGINS } from "./util/secrets";
import graphHelper from './util/graph';
import groupsRouter from './routes/groups';
import usersRouter from './routes/users';
import thresholdsRouter from "./routes/thresholds";
import alertsRouter from "./routes/alerts";
import checklistsRouter from "./routes/checklists";
import { authRouter } from "./routes/auth";

const app = express();

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.set('query parser', function(str: string) {
  return qs.parse(str);
})
app.use(cookieParser());
app.set("port", PROXY_LISTEN_PORT || 3001);

graphHelper.initGraphClient({MS_CLIENT_ID, MS_SECRET, MS_TENANT_ID});

app.use('/notificationGroups', groupsRouter);
app.use('/users', usersRouter);
app.use('/thresholds', thresholdsRouter);
app.use('/alerts', alertsRouter);
app.use('/checklists', checklistsRouter)
app.use('/auth', authRouter);

/** Swagger UI */

const options = { 
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WQIMS API',
      version: '1.0.0',
      description: 'API documentation generated using Swagger-jsdoc'
    }
  },
  apis: ['./dist/routes/*.js']
}

const swaggerSpec = swaggerJSDoc(options);

app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
})

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

/** Swagger End */

if(TLS_CERT_INFO && TLS_CERT_INFO.type && TLS_CERT_INFO.cert && TLS_CERT_INFO.key){
  let options: any;
  if(TLS_CERT_INFO.type === "pfx"){
      options = {
          pfx: fs.readFileSync(TLS_CERT_INFO.cert),
          passphrase: TLS_CERT_INFO.key
      };
  }
  else{
      options = {
          key: fs.readFileSync(TLS_CERT_INFO.key),
          cert: fs.readFileSync(TLS_CERT_INFO.cert)
        };
  }
  https.createServer(options, app).listen(app.get("port"), '0.0.0.0');
  console.debug(`App is running at ${BASEURL}:${app.get("port")} in ${app.get("env")} mode\nAllowed Origins: ${ALLOWED_ORIGINS}`);
}
else{
  http.createServer(app).listen(app.get("port"), '0.0.0.0');
  console.debug(`App is running at ${BASEURL}:${app.get("port")} in ${app.get("env")} mode\nAllowed Origins: ${ALLOWED_ORIGINS}`);
}

  
