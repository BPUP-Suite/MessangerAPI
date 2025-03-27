const database = require('./database');

function email(emailStr) {
    if (emailStr == null || emailStr == undefined || emailStr == "") {
      return false;
    }
    // The regex checks if the string has at least one character before "@",
    // at least one character after "@", and a dot followed by at least one character
    const regex = /^[^@]+@[^@]+\.[^@]+$/;
    return regex.test(emailStr);
  }
  
  function password(passwordStr) {
    if (passwordStr == null || passwordStr == undefined || passwordStr == "") {
      return false;
    }
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

  function notNull(value){
    return value != null && value != undefined && value != "";
  }

  function name(name){
    return notNull(name);
  }

  function surname(surname){
    return notNull(surname);
  }

  async function handle(handle){
    if(notNull(handle)){
      return await database.check_handle_availability(handle);
    }else{
      return false;
    }
  }

  function api_key(api_key){
    return notNull(api_key);
  }

  function message(text){
    if(notNull(handle)){
      return !(text.length > 2056);
    }else{
      return false;
    }
  }

  function chat_id(chat_id){
    // da modificare usando regex e vedere se il formato corrisponse
    return notNull(chat_id);
  }
  
  function generic(text){
    return notNull(text);
  }

  function datetime(datetime){
    if(notNull(datetime)){
      const date = new Date(datetime);
      // If date is invalid, getTime() returns NaN
      return !isNaN(date.getTime());
    }else{
      return false;
    }
  } 
  
module.exports = { email, password,name,surname,handle,api_key,message,chat_id,generic,datetime};