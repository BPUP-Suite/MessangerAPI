class Response {
    constructor(type, type_response, code, error_message) {
      this.type = type;
      this.type_response = type_response;
      this.code = code;
      this.error_message = error_message;
    }
    toJson() {
      return {
        [this.type]: this.type_response,
        code: this.code,
        error_message: this.error_message
      };
    }
  }
  class AccessResponse extends Response {
    constructor(type, access_type, code, error_message) {
      super(type, access_type, code, error_message);
    }
  }
  class SignupResponse extends Response {
    constructor(type, type_response, code, error_message) {
      super(type, type_response, code, error_message);
    }
  }
  class SignupUser {
    constructor(email, name, surname, handle, password) {
      this.email = email;
      this.name = name;
      this.surname = surname;
      this.handle = handle;
      this.password = password;
    }
    toJson() {
      return {
        email: this.email,
        name: this.name,
        surname: this.surname,
        handle: this.handle,
        password:this.password
      };
    }
  }
  class LoginResponse extends Response {
    constructor(type, type_response, api_key, code, error_message) {
      super(type, type_response, code, error_message);
      this.api_key = api_key;
    }

    toJson() {
      return {
        [this.type]: this.type_response,
        api_key: this.api_key,
        code: this.code,
        error_message: this.error_message
      };
    }
  }
  class LoginUser {
    constructor(email, password) {
      this.email = email;
      this.password = password;
    }
    toJson() {
      return {
        email: this.email,
        password: this.password
      };
    }
  }
  class HandleResponse extends Response {
    constructor(type, handle_available, code, error_message) {
      super(type, handle_available, code, error_message);
    }
  }
  class UserIDResponse extends Response {
    constructor(type, user_id, code, error_message) {
      super(type, user_id, code, error_message);
    }
  }

  class SearchResponse extends Response{
    constructor(type, list, code, error_message) {
      super(type, list, code, error_message);
    }
  }

  class InitResponse extends Response{
    constructor(type, confirmation, code, error_message,init_data) {
      super(type, confirmation, code, error_message);
      this.init_data = init_data;
    }

    toJson() {
      return {
        [this.type]: this.type_response,
        code: this.code,
        error_message: this.error_message,
        ...this.init_data
      };
    }
  }

  class Message{
    constructor(chat_id,sender,text){
      this.chat_id = chat_id;
      this.sender = sender;
      this.text = text;
    }
  }

  module.exports = { 
    AccessResponse, 
    SignupResponse, 
    SignupUser, 
    LoginResponse, 
    LoginUser, 
    HandleResponse, 
    UserIDResponse,
    SearchResponse,
    InitResponse,
    Message
  };