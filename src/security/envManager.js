// Description: Environment variables manager.
// The env_manager.js file contains functions to read environment variables.
// The readVariable function reads an environment variable and throws an error if it is not provided.

const path = require('path');
const dotenv = require('dotenv');

const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

function readVariable(name) {
    const VARIABLE = process.env[name];

    if (!VARIABLE) {
        throw new Error(`${name} must be provided (${name} variable) (check .env file)`); 
    }

    return VARIABLE;
}

function readPostgresqlDb() {
    return readVariable("POSTGRES_DB");
}

function readPostgresqlUser() {
    return readVariable("POSTGRES_USER");
}

function readPostgresqlPassword() {
    return readVariable("POSTGRES_PASSWORD");
}

function readPostgresqlHost() {
    return readVariable("POSTGRES_HOST");
}

function readPostgresqlPort() {
    return readVariable("POSTGRES_PORT");
}

function readServerIP() {
    return readVariable("SERVER_IP");
}

function readAPIPort() {
    return readVariable("API_PORT");
}

function readWSPort() {
    return readVariable("WS_PORT");
}

function readSALTPath() {
    return readVariable("SALT_PATH");
}

function readLogsPath() {
    return readVariable("LOGS_FOLDER_PATH");
}

function readDebugMode() {
    return readVariable("DEBUG_MODE");
}

function readTimeZone() {
    return readVariable("TIMEZONE") || 'Europe/Rome';
}


module.exports = {
    readPostgresqlDb,
    readPostgresqlUser,
    readPostgresqlPassword,
    readPostgresqlHost,
    readPostgresqlPort,
    readServerIP,
    readAPIPort,
    readWSPort,
    readSALTPath,
    readLogsPath,
    readDebugMode,
    readTimeZone
};
