const e = require('express');
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
    return value != null && value != undefined && value != ""  && value != "undefined" && value != "null";
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

  function user_id(user_id){
    if(notNull(user_id)){
      const user_idStr = String(user_id);
  
      // Regex per validare user_id:
      // 1. Deve iniziare con 1 (per user_id)
      // 2. Deve essere seguito da esattamente 17 cifre numeriche
      // 3. Deve essere un numero tra 1000000000000000000 e 1999999999999999999
      const regex = /^1\d{17}$/;
      
      if (!regex.test(user_idStr)) {
        return false;
      }
      
      // Verifica il range numerico
      const numValue = BigInt(user_idStr);
      return numValue >= 1000000000000000000n && numValue <= 1999999999999999999n;
    }

    return false;
  }

  function chat_id(chatId) {
    if (!notNull(chatId)) {
      return false;
    }
    
    const chatIdStr = String(chatId);
    
    // Per le chat private (iniziano con 2)
    if (chatIdStr.startsWith('2')) {
      const regex = /^2\d{17}$/;
      if (!regex.test(chatIdStr)) {
        return false;
      }
      const numValue = BigInt(chatIdStr);
      return numValue >= 2000000000000000000n && numValue <= 2999999999999999999n;
    }
    
    // Per i gruppi (iniziano con 3)
    if (chatIdStr.startsWith('3')) {
      const regex = /^3\d{17}$/;
      if (!regex.test(chatIdStr)) {
        return false;
      }
      const numValue = BigInt(chatIdStr);
      return numValue >= 3000000000000000000n && numValue <= 3999999999999999999n;
    }   

    return false;

    // NOT IMPLEMENTED YET

    // Per i canali (iniziano con 4)
    if (chatIdStr.startsWith('4')) {
      const regex = /^4\d{17}$/;
      if (!regex.test(chatIdStr)) {
        return false;
      }
      const numValue = BigInt(chatIdStr);
      return numValue >= 4000000000000000000n && numValue <= 4999999999999999999n;
    }
    
    return false;
  }
  
  function message_id(messageId) {
    if (!notNull(messageId)) {
      return false;
    }
    
    const messageIdStr = String(messageId);
    
    // Per i messaggi (iniziano con 5)
    const regex = /^5\d{17}$/;
    if (!regex.test(messageIdStr)) {
      return false;
    }
    
    const numValue = BigInt(messageIdStr);
    return numValue >= 5000000000000000000n && numValue <= 5999999999999999999n;
  }
  
module.exports = { 
  email, 
  password,
  name,
  surname,
  handle,
  api_key,
  message,
  chat_id,
  generic,
  datetime,
  user_id,
  message_id,
}