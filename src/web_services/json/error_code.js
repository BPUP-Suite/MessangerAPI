const logger = require('../../logger');

const fs = require('fs');
const path = './error.json';

let errorCodes = {};

function loadErrorCodes() {
  try {
    const data = fs.readFileSync(path, 'utf8');
    errorCodes = JSON.parse(data);
  } catch (err) {
    logger.error('Cannot load error.json file:', err);
  }
}

loadErrorCodes();


function getErrorDescription(errorCode) {
  return errorCodes[errorCode] || 'Error code not found';
}

module.exports = { getErrorDescription };
