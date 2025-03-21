const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const logger = require('../logger');
const envManager = require('./envManager');

const SECURITY_PATH = envManager.readSecurityPath();

// SALT Directory Path
const SALT_PATH = path.join(SECURITY_PATH, 'salt');
// Session secret key Directory Path
const SESSION_PATH = path.join(SECURITY_PATH, 'session');

// Salt read and write functions
function readSalt() {
    try {
        logger.debug(`Reading salt from ${SALT_PATH}`);
        return fs.readFileSync(SALT_PATH, "utf8");
    } catch (error) {
        return false;
    }
}

function writeSalt(salt) {
    logger.debug(`Writing salt to ${SALT_PATH}`);
    fs.mkdirSync(path.dirname(SALT_PATH), { recursive: true }); // Directory creation if it does not exist
    fs.writeFileSync(SALT_PATH, salt, "utf8"); // Write the hexadecimal string
}

// Session key read and write functions

function readSessionKey() {
    try {
        logger.debug(`Reading session_key from ${SESSION_PATH}`);
        return fs.readFileSync(SESSION_PATH, "utf8");
    } catch (error) {
        return false;
    }
}

function writeSessionKey(session_key) {
    logger.debug(`Writing session_key to ${SESSION_PATH}`);
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true }); // Directory creation if it does not exist
    fs.writeFileSync(SESSION_PATH, session_key, "utf8"); // Write the hexadecimal string
}

// Public function

// Salt generation

function getSalt(){

    let SALT = readSalt();

    if (!SALT) {
        // If the SALT does not exist, generate a new one
        SALT = crypto.randomBytes(16).toString('hex');
        writeSalt(SALT);
        logger.debug(`Salt generated: ${SALT}`);
    }else{
        logger.debug(`Salt read: ${SALT}`);
    }

    return SALT;
}

// Session key generation

function getSessionKey(){

    let SESSION = readSessionKey();

    if (!SESSION) {
        // If the SALT does not exist, generate a new one
        SESSION = crypto.randomBytes(32).toString('hex');
        writeSessionKey(SESSION);
        logger.debug(`Session_key generated: ${SESSION}`);
    }else{
        logger.debug(`Session_key read: ${SESSION}`);
    }
    
    return SESSION;
}

module.exports = {
    getSalt,
    getSessionKey
};