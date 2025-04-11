
const express = require('express');

const { api_log:log, api_debug:debug, api_warn:warn, api_error:error, api_info:info } = require('../../logger');
const envManager = require('../../security/envManager');

const router = express.Router();



const version = '/'+envManager.readVersion();

let url = envManager.readDomain();
if(url == 'localhost'){
    url = 'http://localhost:'+envManager.readAPIPort();
    warn('SCALAR', 'Running on localhost, Scalar will be served on '+url+version+'/docs',null);
}else{
    url = 'https://api.'+url;
    info('SCALAR', 'Running on domain, Scalar will be served on '+url+version+'/docs',null);
}

// Carica il file OpenAPI per Scalar
const openapiSpec = require('./openapi.json');

openapiSpec.servers = [
    {
        url: url + version,
        description: `API ${version}`
    }
];

router.get('/openapi.json', (req, res) => {
    res.json(openapiSpec);
  });


const initializeScalar = async () => {
    // Dynamic import for ESM module
    const scalarModule = await import('@scalar/express-api-reference');
    const apiReference = scalarModule.apiReference;




    // Setup Scalar API Reference
    router.use('/', apiReference({
        url: version+'/docs/openapi.json',
        config: {
        title: "Buzz Server API Documentation",
        theme: {
            colors: {
            primary: {
                main: '#4380d0',
            },
            dark: {
                main: '#1c1c21',
                codeBackground: '#41444e',
                inputBackground: '#212121',
            }
            }
        },
        defaultTheme: 'dark',
        hideSettings: false,
        logo: null
        }
    }));

};

// Initialize Scalar
initializeScalar();

module.exports = router;