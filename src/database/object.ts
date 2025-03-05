import logger from '../logger';

class Response {
  type: string;
  type_response: string;
  error_code?: number;
  error_message?: string;

  constructor(type: string, type_response: string, error_code?: number, error_message?: string) {
    this.type = type;
    this.type_response = type_response;
    this.error_code = error_code;
    this.error_message = error_message;
  }

  logResponse(): void {
    logger.log(
      `[RESPONSE] Risposta inviata: ${this.type} ${this.type_response} ${this.error_code} ${this.error_message}`
    );
  }

  toJson(): Record<string, any> {
    return {
      [this.type]: this.type_response,
      error_code: this.error_code,
      error_message: this.error_message,
    };
  }
}

export class AccessResponse extends Response {
  constructor(type: string, access_type: string, error_code?: number, error_message?: string) {
    super(type, access_type, error_code, error_message);
  }

  override logResponse(): void {
    logger.log(
      `[RESPONSE] Risposta inviata: ${this.type} ${this.type_response} ${this.error_code} ${this.error_message}`
    );
  }
}


// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO   
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
// TUTTO QUELLO CHE STA SOTTO È DA CAMBIARE FA SCHIFO
export class User {
  email: string;
  name: string;
  surname: string;
  handle: string;
  password: string;

  constructor(email: string, name: string, surname: string, handle: string, password: string) {
    this.email = email;
    this.name = name;
    this.surname = surname;
    this.handle = handle;
    this.password = password;
  }
}

export class LoginUser {
  email: string;
  password: string;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }
}

export class Message {
  chat_id: number | string;
  text: string;
  sender: string;
  //date: DateTime;

  constructor(chat_id: number | string, text: string, sender: string, date: string | null = null) {
    this.chat_id = chat_id;
    this.text = text;
    this.sender = sender;
   // this.date = date ? DateTime.fromISO(date) : DateTime.now();
  }
}

export class MessageJson {
  message_id: number | string;
  chat_id: number | string;
  text: string;
  sender: string;
  //date: DateTime;

  constructor(message_id: number | string, chat_id: number | string, text: string, sender: string, date: string) {
    this.message_id = message_id;
    this.chat_id = chat_id;
    this.text = text;
    this.sender = sender;
    //this.date = DateTime.fromISO(date);
  }
}

export class Chat {
  user1: string;
  user2: string;

  constructor(user1: string, user2: string) {
    this.user1 = user1;
    this.user2 = user2;
  }
}

export class ChatJson {
  chat_id: number | string;
  user: string;
  messages: Message[];

  constructor(chat_id: number | string, user: string, messages: Message[]) {
    this.chat_id = chat_id;
    this.user = user;
    this.messages = messages;
  }
}

export class Group {
  handle: string;
  name: string;
  description: string;

  constructor(handle: string, name: string, description: string) {
    this.handle = handle;
    this.name = name;
    this.description = description;
  }
}

export class FileUpload {
  handle: string;
  type: string;
  file: any; // Specifica il tipo corretto in base all'utilizzo (ad esempio Buffer)

  constructor(handle: string, type: string, file: any) {
    this.handle = handle;
    this.type = type;
    this.file = file;
  }
}

export class FileDownload {
  data: any; // Specifica il tipo corretto
  name: string;
  type: string;

  constructor(data: any, name: string, type: string) {
    this.data = data;
    this.name = `${name}.${type}`;
    this.type = type;
  }
}

// Esempio di istanza (se necessario per i test o la dimostrazione)
// const accessResponse = new AccessResponse("Invalid Email", "Signup");
// accessResponse.logResponse();
// console.log(accessResponse);