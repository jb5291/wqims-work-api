import express from "express";
import cors from 'cors';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import qs from 'qs';

import { appLogger } from './util/appLogger';
import groupsRouter from './routes/groups';
import usersRouter from './routes/users';
import thresholdsRouter from "./routes/thresholds";

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.set('query parser', function(str: string) {
  return qs.parse(str);
})

app.use('/notificationGroups', groupsRouter);
app.use('/users', usersRouter);
app.use('/thresholds', thresholdsRouter);

// swagger jsdoc config
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

app.listen(PORT, () => {
  appLogger.info(`Proxy server running http://localhost:${PORT}`);
});

  
