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

module.exports = {
    log,
    debug,
    error
};
