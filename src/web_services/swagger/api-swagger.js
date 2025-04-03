const fs = require('fs');
const path = require('path');
const express = require('express');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const logger = require('../../logger');
const envManager = require('../../security/envManager');

const DOMAIN = envManager.readDomain();
const API_PORT = envManager.readAPIPort();
const VERSION = envManager.readVersion();

let swagger_url = 'http://localhost'+':'+API_PORT+'/'+VERSION+'/docs'; // URL path for the Swagger UI

if(DOMAIN != 'localhost'){
  swagger_url = 'https://api.'+DOMAIN+'/'+VERSION+'/docs'; // URL path for the Swagger UI
  logger.debug('[SWAGGER] Running on domain, Swagger URL set to: ' + swagger_url);
}else{
  logger.warn('[SWAGGER] Running on localhost, Swagger URL set to: ' + swagger_url);
}


// Initialize router
const router = express.Router();

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Buzz Server API',
      version: '0.0.6',
      description: 'API per l\'app di messaggistica Buzz',
      contact: {
        name: 'Buzz Team'
      },
      servers: [
        {
          url: swagger_url,
          description: 'Server'
        }
      ]
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid'
        }
      }
    }
  },
  // Path to the API docs - look for JSDoc comments in these locations
  apis: [
    ,'./src/web_services/swagger/api-swagger-docs.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Dynamically replace all occurrences of /v1/ with the actual version
const replaceVersionInPaths = (spec) => {
  const versionPath = `/${VERSION}/`;
  if (spec.paths) {
    const newPaths = {};
    Object.keys(spec.paths).forEach(path => {
      const newPath = path.replace(/\/v1\//g, versionPath);
      newPaths[newPath] = spec.paths[path];
    });
    spec.paths = newPaths;
  }
  return spec;
};

let processedSpec = swaggerSpec;

// If the version is not 'v1', replace the paths with the correct version
if(VERSION != 'v1'){
  processedSpec = replaceVersionInPaths(swaggerSpec);
}

// Setup swagger UI route
router.use('/', swaggerUi.serve);

const darkCssPath = path.join(__dirname, 'swagger-dark.css');
const darkCss = fs.readFileSync(darkCssPath, 'utf8');

router.get('/', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: `.swagger-ui .topbar { display: none } ${darkCss}`,
  customSiteTitle: "Buzz Server API - Documentation"
}));

// Add route to get the Swagger JSON
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(processedSpec);
});


logger.debug('[SWAGGER] Swagger documentation initialized on path: ' + swagger_url);

module.exports = router;