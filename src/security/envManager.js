// Description: Environment variables manager.
// The env_manager.js file contains functions to read environment variables.
// The readVariable function reads an environment variable and throws an error if it is not provided.

const path = require('path');
const dotenv = require('dotenv');

const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

function readVariable(name,needed) {
    const VARIABLE = process.env[name];

    if(needed && !VARIABLE){
        console.log(`[ENV MANAGER] ${name} must be provided (${name} variable) (check .env file)`);
        throw new Error(`${name} must be provided (${name} variable) (check .env file)`); 
    }else if(!VARIABLE){
        console.log(`[ENV MANAGER] ${name} not provided, using default value`);
    }

    return VARIABLE;
}

function readPostgresqlDb() {
    return readVariable("POSTGRES_DB",false) || 'postgres';
}

function readPostgresqlUser() {
    return readVariable("POSTGRES_USER",true);
}

function readPostgresqlPassword() {
    return readVariable("POSTGRES_PASSWORD",true);
}

function readPostgresqlHost() {
    return readVariable("POSTGRES_HOST",false) || 'local_pgdb';
}

function readPostgresqlPort() {
    return readVariable("POSTGRES_PORT",false) || '5432';
}

function readRedisHost() {
    return readVariable("REDIS_HOST",false) || 'local_redis';
}

function readRedisPort() {
    return readVariable("REDIS_PORT",false) || '6379';
}

function readServerIP() {
    return readVariable("SERVER_IP",false) || '0.0.0.0';
}

function readAPIPort() {
    return readVariable("API_PORT",false) || '8000';
}

function readIOPort() {
    return readVariable("IO_PORT",false) || '8001';
}

function readSecurityPath() {
    return readVariable("SECURITY_FOLDER_PATH",false) || '/security';
}

function readLogsPath() {
    return readVariable("LOGS_FOLDER_PATH",false) || '/logs';
}

function readDebugMode() {
    if(isProduction()){
        return readVariable("DEBUG_MODE",false) || 'false';
    }
    return 'true';
}

function readTimeZone() {
    return readVariable("TIMEZONE",false) || 'Europe/Rome';
}

function readProxyAddress() {
    return readVariable("PROXY_ADDRESS",false) || '127.0.0.1';
}

function readRateLimiterNumber() {
    return readVariable("RATE_LIMITER_NUMBER",false) || '100';
}

function readRateLimiterMilliseconds() {
    return readVariable("RATE_LIMITER_MILLISECONDS",false) || '10000';
} 

function readNodeEnv(){
    return readVariable("NODE_ENV",false) || 'production'; 
}

function isProduction(){
    return readNodeEnv() == "production";
}

function readDomain(){
    if (isProduction()){
        return readVariable("DOMAIN",true); 
    }
    return 'localhost';
}

function readDashboardPort(){
    return readVariable("DASHBOARD_PORT",false) || '3000';
}

function readVersion(){
    if(isProduction()){
        return readVariable("VERSION",false) || 'v1';
    }
    return 'test';
}

function readMaxSessionPerUser(){
    return readVariable("MAX_SESSION_PER_USER",false) || 10;
}


module.exports = {
    readPostgresqlDb,
    readPostgresqlUser,
    readPostgresqlPassword,
    readPostgresqlHost,
    readPostgresqlPort,
    readRedisHost,
    readRedisPort,
    readServerIP,
    readAPIPort,
    readIOPort,
    readSecurityPath,
    readLogsPath,
    readDebugMode,
    readTimeZone,
    readProxyAddress,
    readRateLimiterNumber,
    readRateLimiterMilliseconds,
    readNodeEnv,
    readDomain,
    readDashboardPort,
    readVersion,
    readMaxSessionPerUser
};
