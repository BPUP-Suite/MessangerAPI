const fs = require('fs');
const path = require('path');
const express = require('express');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const logger = require('../../logger');

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
          url: 'http://localhost:8000', // Development server
          description: 'Development server'
        },
        {
          url: 'https://api.buzz.it', // Production server 
          description: 'Production server'
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
    ,'./src/web_services/swagger/swagger-docs.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

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
  res.send(swaggerSpec);
});

logger.debug('[SWAGGER] Swagger documentation initialized');

module.exports = router;