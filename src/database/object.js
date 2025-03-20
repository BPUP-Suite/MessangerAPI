class Response {
    constructor(type, type_response, error_message) {
      this.type = type;
      this.type_response = type_response;
      this.error_message = error_message;
    }
    toJson() {
      if(this.error_message == ''){
        return {
          [this.type]: this.type_response
        };
      }
      return {
        [this.type]: this.type_response,
        error_message: this.error_message
      };
    }
  }
  class AccessResponse extends Response {
    constructor(type, access_type, error_message) {
      super(type, access_type, error_message);
    }
  }
  class SignupResponse extends Response {
    constructor(type, type_response, error_message) {
      super(type, type_response, error_message);
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
    constructor(type, type_response, api_key, error_message) {
      super(type, type_response, error_message);
      this.api_key = api_key;
    }

    toJson() {
      return {
        ...super.toJson(),
        api_key: this.api_key
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
    constructor(type, handle_available, error_message) {
      super(type, handle_available, error_message);
    }
  }
  class UserIDResponse extends Response {
    constructor(type, user_id, error_message) {
      super(type, user_id, error_message);
    }
  }

  class SearchResponse extends Response{
    constructor(type, list, error_message) {
      super(type, list, error_message);
    }
  }

  class ExtraJsonData_Response extends Response{
    constructor(type, confirmation, error_message,data) {
      super(type, confirmation, error_message);
      this.data = data;
    }

    toJson() {
      return {
        ...super.toJson(),
        ...this.data
      };
    }
  }

  class InitResponse extends ExtraJsonData_Response{
    constructor(type, confirmation, error_message,init_data) {
      super(type, confirmation, error_message, init_data);
    }
  }

  class MessageResponse extends ExtraJsonData_Response{
    constructor(type, confirmation, error_message,message_data) {
      super(type, confirmation, error_message, message_data);
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
    MessageResponse,
    Message
  };