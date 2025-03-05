
function email(emailStr) {
    // The regex checks if the string has at least one character before "@",
    // at least one character after "@", and a dot followed by at least one character
    const regex = /^[^@]+@[^@]+\.[^@]+$/;
    return regex.test(emailStr);
  }
  
  function password(passwordStr) {
    // Password length should be between 8 and 32 characters
    if (passwordStr.length < 8 || passwordStr.length > 32) {
      return false;
    }
    // It must contain at least one lowercase letter
    if (!/[a-z]/.test(passwordStr)) {
      return false;
    }
    // It must contain at least one digit
    if (!/[0-9]/.test(passwordStr)) {
      return false;
    }
    // It must contain at least one uppercase letter
    if (!/[A-Z]/.test(passwordStr)) {
      return false;
    }
    // It must contain at least one special character among '$', '#', '@', '!', '?'
    if (!/[$#@!?]/.test(passwordStr)) {
      return false;
    }
    // It must not contain any whitespace characters
    if (/\s/.test(passwordStr)) {
      return false;
    }
    // If all conditions are met
    return true;
  }
  
  module.exports = { email, password };
  