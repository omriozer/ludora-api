import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Ludora Educational Platform API',
      version: '1.0.0',
      description: 'Comprehensive API for the Ludora educational platform with polymorphic products and access control',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://ludora.app/api'
          : 'http://localhost:3000/api',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth_token'
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    },
    security: [
      { cookieAuth: [] },
      { bearerAuth: [] }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/openapi/schemas/*.js',
    './src/openapi/paths/*.js'
  ]
};

export const specs = swaggerJSDoc(options);
export default specs;
