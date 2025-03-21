// Description: Module to generate and check password hashes
// The encrypter.js file contains functions to generate and check password hashes.

const crypto = require('crypto');
const fileManager = require('./fileManager');

const SALT = fileManager.getSalt();

// Hashing methods

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


module.exports = {
    generatePasswordHash,
    checkPasswordHash
};
