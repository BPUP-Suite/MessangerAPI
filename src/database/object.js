const { chat_id } = require("./validator");

class Response {
  constructor(type, type_response, error_message) {
    this.type = type;
    this.type_response = type_response;
    this.error_message = error_message;
  }
  toJson() {
    if (this.error_message == "") {
      return {
        [this.type]: this.type_response,
      };
    }
    return {
      [this.type]: this.type_response,
      error_message: this.error_message,
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
      password: this.password,
    };
  }
}
class LoginResponse extends Response {
  constructor(type, type_response, error_message, token) {
    super(type, type_response, error_message);
    this.token = token;
  }
  toJson() {
    return {
      ...super.toJson(),
      token: this.token,
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
      password: this.password,
    };
  }
}
class LogoutResponse extends Response {
  constructor(type, type_response, error_message) {
    super(type, type_response, error_message);
  }
}
class SessionResponse extends Response {
  constructor(type, session_id, error_message) {
    super(type, session_id, error_message);
  }
}
class QRCodeResponse extends Response {
  constructor(type, confirmation, qr_token, error_message) {
    super(type, confirmation, error_message);
    this.qr_token = qr_token;
  }
  toJson() {
    return {
      ...super.toJson(),
      qr_token: this.qr_token,
    };
  }
}
class CheckQRCodeResponse extends Response {
  constructor(type, confirmation, session_id, error_message) {
    super(type, confirmation, error_message);
    this.session_id = session_id;
  }
  toJson() {
    return {
      ...super.toJson(),
      token: this.session_id,
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

class SearchResponse extends Response {
  constructor(type, list, error_message) {
    super(type, list, error_message);
  }
}

class ExtraJsonData_Response extends Response {
  constructor(type, confirmation, error_message, data) {
    super(type, confirmation, error_message);
    this.data = data;
  }

  toJson() {
    return {
      ...super.toJson(),
      ...this.data,
    };
  }
}

class InitResponse extends ExtraJsonData_Response {
  constructor(type, confirmation, error_message, init_data) {
    super(type, confirmation, error_message, init_data);
  }
}

class MessageResponse extends ExtraJsonData_Response {
  constructor(type, confirmation, error_message, message_data) {
    super(type, confirmation, error_message, message_data);
  }
}

class Message {
  constructor(chat_id, sender, text) {
    this.chat_id = chat_id;
    this.sender = sender;
    this.text = text;
  }
}

class CreateChatResponse extends Response {
  constructor(type, confirmation, error_message, chat_id) {
    super(type, confirmation, error_message);
    this.chat_id = chat_id;
  }
  toJson() {
    return {
      ...super.toJson(),
      chat_id: this.chat_id,
    };
  }
}

class Chat {
  constructor(user1, user2) {
    this.user1 = user1;
    this.user2 = user2;
  }
}

class CreateGroupResponse extends Response {
  constructor(type, confirmation, error_message, chat_id) {
    super(type, confirmation, error_message);
    this.chat_id = chat_id;
  }
  toJson() {
    return {
      ...super.toJson(),
      chat_id: this.chat_id,
    };
  }
}

class Group {
  constructor(handle, name, description, members, admins) {
    this.handle = handle;
    this.name = name;
    this.description = description || ""; // if description is not provided, it will be an empty string
    this.members = members;
    this.admins = admins;
  }
}

class MembersResponse extends Response {
  constructor(type, members_list, error_message) {
    super(type, members_list, error_message);
  }
}

class UpdateResponse extends ExtraJsonData_Response {
  constructor(type, confirmation, error_message, update_data) {
    super(type, confirmation, error_message, update_data);
  }
}

class JoinGroupResponse extends ExtraJsonData_Response {
  constructor(type, confirmation, error_message, group_data) {
    super(type, confirmation, error_message, group_data);
  }
}

class JoinCommsResponse extends Response {
  constructor(type, confirmation, comms_id, error_message) {
    super(type, confirmation, error_message);
    this.comms_id = comms_id;
  }

  toJson() {
    return {
      ...super.toJson(),
      from: this.comms_id,
    };
  }
}

class LeaveCommsResponse extends Response {
  constructor(type, confirmation, chat_id, comms_id, error_message) {
    super(type, confirmation, error_message);
    this.chat_id = chat_id;
    this.comms_id = comms_id;
  }

  toJson() {
    return {
      ...super.toJson(),
      chat_id: this.chat_id,
      from: this.comms_id,
    };
  }
}

class StartScreenShareResponse extends Response {
  constructor(type, confirmation, screen_share_uuid, error_message) {
    super(type, confirmation, error_message);
    this.screen_share_uuid = screen_share_uuid;
  }

  toJson() {
    return {
      ...super.toJson(),
      screen_share_uuid: this.screen_share_uuid,
    };
  }
}

class StopScreenShareResponse extends Response {
  constructor(type, confirmation, screen_share_uuid, error_message) {
    super(type, confirmation, error_message);
    this.screen_share_uuid = screen_share_uuid;
  }

  toJson() {
    return {
      ...super.toJson(),
      screen_share_uuid: this.screen_share_uuid,
    };
  }
}

module.exports = {
  Response,
  AccessResponse,
  SignupResponse,
  SignupUser,
  LoginResponse,
  LoginUser,
  LogoutResponse,
  SessionResponse,
  QRCodeResponse,
  CheckQRCodeResponse,
  HandleResponse,
  UserIDResponse,
  SearchResponse,
  InitResponse,
  MessageResponse,
  Message,
  CreateChatResponse,
  Chat,
  CreateGroupResponse,
  Group,
  MembersResponse,
  UpdateResponse,
  CreateGroupResponse,
  JoinGroupResponse,
  JoinCommsResponse,
  LeaveCommsResponse,
  StartScreenShareResponse,
  StopScreenShareResponse,
};
