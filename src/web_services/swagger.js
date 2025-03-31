const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const express = require('express');
const logger = require('../logger');

// Initialize router
const router = express.Router();

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Buzz MessangerAPI',
      version: '1.0.0',
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
    './src/web_services/api.js',
    './src/web_services/swagger.js' // For schema definitions
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Setup swagger UI route
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Buzz MessangerAPI - Documentation"
}));

// Add route to get the Swagger JSON
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

logger.debug('[SWAGGER] Swagger documentation initialized');

/**
 * @swagger
 * components:
 *   schemas:
 *     AccessResponse:
 *       type: object
 *       properties:
 *         access_type:
 *           type: string
 *           description: Type of access (login or signup)
 *           enum: [login, signup]
 *         error_message:
 *           type: string
 *           description: Error message if applicable
 *     SignupResponse:
 *       type: object
 *       properties:
 *         signed_up:
 *           type: boolean
 *           description: Whether the signup was successful
 *         error_message:
 *           type: string
 *           description: Error message if applicable
 *     LoginResponse:
 *       type: object
 *       properties:
 *         logged_in:
 *           type: boolean
 *           description: Whether the login was successful
 *         error_message:
 *           type: string
 *           description: Error message if applicable
 */

module.exports = router;