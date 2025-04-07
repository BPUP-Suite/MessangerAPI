// Description: Logger module to log messages to console and file
// The logger.js file contains functions to log messages to the console and a file.
// The log function logs a message with the [LOG] tag.
// The debug function logs a message with the [DEBUG] tag if the DEBUG_MODE environment variable is set to true.
// The error function logs a message with the [ERROR] tag.
// The getTimestamp function returns the current timestamp in ISO format.
// The getDateFormatted function returns the current date in the format dd-mm-yyyy.


const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const envManager = require('./security/envManager');

const LOGS_FOLDER_PATH = envManager.readLogsPath(); 
const DEBUG_MODE = envManager.readDebugMode() === 'true'; // true or false
const TIMEZONE = envManager.readTimeZone();

function getTimestamp() {
    return DateTime.now().setZone(TIMEZONE).toISO();
}

function getDateFormatted() {
    const now = DateTime.now().setZone(TIMEZONE);
    return now.toFormat('dd-MM-yyyy');
}

function getLogFilePath() {
    const dateFormatted = getDateFormatted();
    const fileName = `${dateFormatted}.log`;
    const filePath = path.join(LOGS_FOLDER_PATH, fileName);
    return filePath;
}

function writeLogToFile(message) {
    const logFilePath = getLogFilePath();

    if (!fs.existsSync(LOGS_FOLDER_PATH)) {
        fs.mkdirSync(LOGS_FOLDER_PATH, { recursive: true });
    }

    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
}

function log(message) {
    const timestamp = getTimestamp();
    const logMessage = `[LOG] ${timestamp} - ${message}`;
    console.log(logMessage);
    writeLogToFile(logMessage); 
}

function debug(message) {
    if (DEBUG_MODE) {
        const timestamp = getTimestamp();
        const debugMessage = `[DEBUG] ${timestamp} - ${message}`;
        console.log(debugMessage); 
        writeLogToFile(debugMessage); 
    }
}

function error(message) {
    const timestamp = getTimestamp();
    const errorMessage = `[ERROR] ${timestamp} - ${message}`;
    console.error(errorMessage); 
    writeLogToFile(errorMessage);
}

function warn(message){
    const timestamp = getTimestamp();
    const warnMessage = `[WARN] ${timestamp} - ${message}`;
    console.warn(warnMessage);
    writeLogToFile(warnMessage);
}

function info(message){
    const timestamp = getTimestamp();
    const infoMessage = `[INFO] ${timestamp} - ${message}`;
    console.info(infoMessage);
    writeLogToFile(infoMessage);
}

// Specific methods


// API

function api_log(path,type,message,code,data){
    log(`[API] [${type}] - ${path} - ${message} |${code}| -> ${data}`);
}

function api_debug(path,type,message,code,data){
    debug(`[API] [${type}] - ${path} - ${message} |${code}| -> ${data}`);
}

function api_warn(type,message,data){
    warn(`[API] [${type}] - ${message} > ${data}`);
}

function api_error(path,type,message,code,data){
    error(`[API] [${type}] - ${path} - ${message} |${code}| -> ${data}`);
}

function api_info(type,message,data){
    info(`[API] [${type}] - ${message} -> ${data}`);
}

// SOCKET.IO

function io_log(event,type,message,data){
    log(`[SOCKET.IO] [${type}] - ${event} - ${message} -> ${data}`);
}

function io_debug(event,type,message,data){
    debug(`[SOCKET.IO] [${type}] - ${event} - ${message} -> ${data}`);
}

function io_warn(event,type,message){
    warn(`[SOCKET.IO] [${type}] - ${event} - ${message}`);
}

function io_error(event,type,message){
    error(`[SOCKET.IO] [${type}] - ${event} - ${message}`);
}

function io_info(type,message,data){
    info(`[SOCKET.IO] [${type}] - ${message} -> ${data}`);
}

// POSTGRES

// REDIS

module.exports = {
    log,
    debug,
    error,
    warn,
    info,
    api_log,
    api_debug,
    api_error,
    api_warn,
    api_info,
    io_log,
    io_debug,
    io_error,
    io_warn,
    io_info,
};
