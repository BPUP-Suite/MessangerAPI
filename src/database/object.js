"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDownload = exports.FileUpload = exports.Group = exports.ChatJson = exports.Chat = exports.MessageJson = exports.Message = exports.LoginUser = exports.User = exports.AccessResponse = void 0;
const logger_1 = __importDefault(require("../logger"));
class Response {
    constructor(type, type_response, error_code, error_message) {
        this.type = type;
        this.type_response = type_response;
        this.error_code = error_code;
        this.error_message = error_message;
    }
    logResponse() {
        logger_1.default.log(`[RESPONSE] Risposta inviata: ${this.type} ${this.type_response} ${this.error_code} ${this.error_message}`);
    }
    toJson() {
        return {
            [this.type]: this.type_response,
            error_code: this.error_code,
            error_message: this.error_message,
        };
    }
}
class AccessResponse extends Response {
    constructor(type, access_type, error_code, error_message) {
        super(type, access_type, error_code, error_message);
    }
    logResponse() {
        logger_1.default.log(`[RESPONSE] Risposta inviata: ${this.type} ${this.type_response} ${this.error_code} ${this.error_message}`);
    }
}
exports.AccessResponse = AccessResponse;
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO   
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
class User {
    constructor(email, name, surname, handle, password) {
        this.email = email;
        this.name = name;
        this.surname = surname;
        this.handle = handle;
        this.password = password;
    }
}
exports.User = User;
class LoginUser {
    constructor(email, password) {
        this.email = email;
        this.password = password;
    }
}
exports.LoginUser = LoginUser;
class Message {
    //date: DateTime;
    constructor(chat_id, text, sender, date = null) {
        this.chat_id = chat_id;
        this.text = text;
        this.sender = sender;
        // this.date = date ? DateTime.fromISO(date) : DateTime.now();
    }
}
exports.Message = Message;
class MessageJson {
    //date: DateTime;
    constructor(message_id, chat_id, text, sender, date) {
        this.message_id = message_id;
        this.chat_id = chat_id;
        this.text = text;
        this.sender = sender;
        //this.date = DateTime.fromISO(date);
    }
}
exports.MessageJson = MessageJson;
class Chat {
    constructor(user1, user2) {
        this.user1 = user1;
        this.user2 = user2;
    }
}
exports.Chat = Chat;
class ChatJson {
    constructor(chat_id, user, messages) {
        this.chat_id = chat_id;
        this.user = user;
        this.messages = messages;
    }
}
exports.ChatJson = ChatJson;
class Group {
    constructor(handle, name, description) {
        this.handle = handle;
        this.name = name;
        this.description = description;
    }
}
exports.Group = Group;
class FileUpload {
    constructor(handle, type, file) {
        this.handle = handle;
        this.type = type;
        this.file = file;
    }
}
exports.FileUpload = FileUpload;
class FileDownload {
    constructor(data, name, type) {
        this.data = data;
        this.name = `${name}.${type}`;
        this.type = type;
    }
}
exports.FileDownload = FileDownload;
// Esempio di istanza (se necessario per i test o la dimostrazione)
// const accessResponse = new AccessResponse("Invalid Email", "Signup");
// accessResponse.logResponse();
// console.log(accessResponse);
