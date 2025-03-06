// Description: Module to generate and check password hashes
// The encrypter.js file contains functions to generate and check password hashes.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const logger = require('../logger');
const envManager = require('./envManager');

// SALT Directory Path
const SALT_FOLDER_PATH = envManager.readSaltFolderPath();
const SALT_PATH = path.join(SALT_FOLDER_PATH, 'salt');

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


let SALT = readSalt();
logger.debug(`Salt read: ${SALT}`);
if (!SALT) {
    // If the SALT does not exist, generate a new one
    SALT = crypto.randomBytes(16).toString('hex');
    writeSalt(SALT);
    logger.debug(`Salt generated: ${SALT}`);
}

function generateHash(digest, salt) {

    // Convert the digest and salt to Bytes
    const digestBytes = Buffer.from(digest, 'utf-8');
    const saltBytes = Buffer.from(salt, 'hex');

    // Concatenate the salt and digest
    const saltedDigest = Buffer.concat([saltBytes, digestBytes]);
    
    // Create a SHA-256 hash
    const hash = crypto.createHash('sha256');

    // Update the hash with the salted digest
    hash.update(saltedDigest);
    return hash.digest('hex');
}


function generatePasswordHash(password) {
    return generateHash(password, SALT);
}

function checkPasswordHash(password, hash) {
    let confirmation = false;

    if (generatePasswordHash(password) === hash) {
        confirmation = true;
    }

    return confirmation;
}

function generateApiKey(){
    return crypto.randomBytes(256).toString('base64url');
}

module.exports = {
    generateHash,
    generatePasswordHash,
    checkPasswordHash,
    generateApiKey
};
