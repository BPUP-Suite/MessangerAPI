const express = require("express");
const rateLimit = require("express-rate-limit");

const jwt = require("jsonwebtoken");

const cors = require("cors");

const api = express();
const {
  api_log: log,
  api_debug: debug,
  api_warn: warn,
  api_error: error,
  api_info: info,
} = require("../logger");

const validator = require("../database/validator");
const database = require("../database/database");
const smtp = require("../security/smtp");

const {
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
  ForgotPasswordResponse,
  ResetPasswordResponse,
  ChangePasswordResponse,
  TwoFAResponse,
  HandleResponse,
  SearchResponse,
  InitResponse,
  Message,
  MessageResponse,
  CreateChatResponse,
  Chat,
  CreateGroupResponse,
  Group,
  MembersResponse,
  UpdateResponse,
  JoinGroupResponse,
  JoinCommsResponse,
  LeaveCommsResponse,
  StartScreenShareResponse,
  StopScreenShareResponse,
} = require("../database/object");

const io = require("./socketio");

const crypto = require("crypto");

api.use(express.json());
api.use(express.urlencoded({ extended: true }));

const envManager = require("../security/envManager");
const {
  sessionMiddleware,
  trackSessionCreationMiddleware,
  destroySession,
  enforceSessionLimit,
  verifySession,
  destroyAllUserSessionsExcept,
} = require("../security/sessionMiddleware");

// api path

const version = "/" + envManager.readVersion() + "/";

info("EXPRESS", "API base path: " + version, null);

// /user
const user_base = version + "user/";

const auth_base = user_base + "auth/";

const access_path = auth_base + "access";
const signup_path = auth_base + "signup";
const login_path = auth_base + "login";
const logout_path = auth_base + "logout";
const session_path = auth_base + "session";

const qr_code_path = auth_base + "qr_code/";
const generate_qr_code_path = qr_code_path + "generate";
const scan_qr_code_path = qr_code_path + "scan";
const check_qr_code_path = qr_code_path + "check";

const forgot_password_path = auth_base + "forgot-password";
const reset_password_path = auth_base + "reset-password";
const change_password_path = auth_base + "change-password";

const two_fa_path = auth_base + "2fa";

const data_base = user_base + "data/";

const check_base = data_base + "check/";

const handle_availability_path = check_base + "handle-availability";

const get_data_base = data_base + "get/";

const init_path = get_data_base + "init";
const update_path = get_data_base + "update";

const search_base = data_base + "search/";

const search_users_path = search_base + "users";
const search_all_path = search_base + "all";

// /chat
const chat_base = version + "chat/";

const send_base = chat_base + "send/";

const message_path = send_base + "message";
const voice_message_path = send_base + "voice_message";
const file_path = send_base + "file";

const create_base = chat_base + "create/";

const chat_path = create_base + "chat";
const group_path = create_base + "group";
const channel_path = create_base + "channel";

const get_chat_base = chat_base + "get/";

const members_path = get_chat_base + "members";

const join_base = chat_base + "join/";

const join_group_path = join_base + "group";
const join_channel_path = join_base + "channel";

// /comms
const comms_base = version + "comms/";

const join_comms_path = comms_base + "join";
const leave_comms_path = comms_base + "leave";

const start_screen_share_path = comms_base + "screen_share/start";
const stop_screen_share_path = comms_base + "screen_share/stop";

const comms_get_base = comms_base + "get/";
const comms_members_path = comms_get_base + "members";

// api response type

const access_response_type = "access_type";
const signup_response_type = "signed_up";
const login_response_type = "logged_in";
const logout_response_type = "logged_out";
const session_response_type = "session_id";

const generate_qr_code_response_type = "qr_code_generated";
const scan_qr_code_response_type = "qr_code_scanned";
const check_qr_code_response_type = "qr_code_checked";

const handle_availability_response_type = "handle_available";

const init_response_type = "init";
const update_response_type = "update";

const message_response_type = "message_sent";
const voice_message_response_type = "";
const file_response_type = "";

const chat_response_type = "chat_created";
const group_response_type = "group_created";
const channel_response_type = "";

const search_response_type = "searched_list";
const get_members_response_type = "members_list";

const join_group_response_type = "group_joined";
const join_channel_response_type = "channel_joined";

const join_comms_response_type = "comms_joined";
const leave_comms_response_type = "comms_left";

const start_screen_share_response_type = "screen_share_started";
const stop_screen_share_response_type = "screen_share_stopped";

const comms_members_response_type = "comms_members_list";

// api configurations

// Sessions configuration

api.use(sessionMiddleware);
api.use(trackSessionCreationMiddleware);

// CORS Rules

let WEB_DOMAIN = envManager.readDomain();

if (WEB_DOMAIN == "localhost") {
  WEB_DOMAIN = "http://localhost:" + envManager.readAPIPort();
  warn(
    "CORS",
    "Running on localhost, CORS will be set to localhost",
    WEB_DOMAIN
  );
} else {
  WEB_DOMAIN = "https://web." + WEB_DOMAIN;
  info(
    "CORS",
    `Running on domain, CORS will be set to ${WEB_DOMAIN}`,
    WEB_DOMAIN
  );
}

api.use(
  cors({
    origin: ["http://localhost:8081", WEB_DOMAIN], //TEMPORARY FOR TESTING PURPUSE
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Allow proxy (nginx) to set the real ip address of the client
api.set("trust proxy", 1);

// api rate limiter

const rate_limiter_milliseconds = envManager.readRateLimiterMilliseconds();
const rate_limiter_number = envManager.readRateLimiterNumber();

const limiter = rateLimit({
  windowMs: rate_limiter_milliseconds,
  max: rate_limiter_number,
  handler: (req, res, next) => {
    const errorDescription = "Too many requests, please try again later.";
    const code = 429;

    const jsonResponse = { error_message: errorDescription };

    res.status(code).json(jsonResponse);

    log(
      req.path,
      "ALERT",
      `IP ${req.ip} has exceeded the rate limit!`,
      code,
      JSON.stringify(jsonResponse)
    );

    next(new Error(errorDescription));
  },
});

api.use(limiter);

// Metrics

const {
  metricsDurationMiddleware,
  apiCallMiddleware,
} = require("../dashboard/metrics");

// QR Code token storage for polling utilization

// QR Code login sessions map
const qrLoginSessions = new Map(); // token -> { user_id: null, expires_at: Date }

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [token, data] of qrLoginSessions.entries()) {
    if (data.expires_at < now) {
      qrLoginSessions.delete(token);
      debug("QR_CLEANUP", "Expired token removed", token);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// END OF QR CODE LOGIN SESSIONS MAP

// RESET PASSWORD TOKEN MAP
// Reset password token map
const resetPasswordTokens = new Map(); // token -> { email: null, expires_at: Date }
// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [token, data] of resetPasswordTokens.entries()) {
    if (data.expires_at < now) {
      resetPasswordTokens.delete(token);
      debug("RESET_PASSWORD_CLEANUP", "Expired token removed", token);
    }
  }
}, 5 * 60 * 1000); // 5 minutes
// END OF RESET PASSWORD TOKEN MAP

// EMAIL VERIFICATION TOKEN MAP
const emailVerificationTokens = new Map(); // token -> { user_id: null, expires_at: Date, code: null }
// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [token, data] of emailVerificationTokens.entries()) {
    if (data.expires_at < now) {
      emailVerificationTokens.delete(token);
      debug("EMAIL_VERIFICATION_CLEANUP", "Expired token removed", token);
    }
  }
}, 5 * 60 * 1000); // 5 minutes
// END OF EMAIL VERIFICATION TOKEN MAP

// 2FA TOKEN MAP
const twoFATokens = new Map(); // token -> { user_id: null, expires_at: Date, method: null, code: null }
// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();

  for (const [token, data] of twoFATokens.entries()) {
    if (data.expires_at < now) {
      twoFATokens.delete(token);
      debug("TWO_FA_CLEANUP", "Expired token removed", token);
    }
  }
}, 5 * 60 * 1000); // 5 minutes
// END OF 2FA TOKEN MAP

api.use(metricsDurationMiddleware);
api.use(apiCallMiddleware);

// Documentation on Scalar
const scalarRouter = require("./scalar/api-scalar");
const session = require("express-session");

api.use("/" + envManager.readVersion() + "/docs", scalarRouter);

// Favicon.ico request
// This is a workaround to avoid the favicon.ico request to be logged in the console

api.all("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Api methods

// GET METHODS

// Auth based on session

async function isAuthenticated(req, res, next) {
  if (await verifySession(req.sessionID)) {
    debug(
      "",
      req.path,
      "AUTH",
      "User is authenticated!",
      200,
      req.session.user_id
    );
    next();
  } else {
    const code = 401;
    const errorDescription = "Unauthorized";

    const jsonResponse = { errorMessage: errorDescription };

    res.status(code).json(jsonResponse);

    error(
      req.path,
      "AUTH",
      "User unauthorized",
      code,
      JSON.stringify(jsonResponse)
    );
  }
}

// Path: /user
// Path: .../auth

// returns the access type of the user (login -> already registered, signup -> not registered)

api.get(access_path, async (req, res) => {
  const email = req.query.email;

  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));

  const type = access_response_type;
  let code = 500;
  let confirmation = null;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.email(email)) {
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  }

  if (validated) {
    try {
      if (await database.check_email_existence(email)) {
        confirmation = "login";
      } else {
        confirmation = "signup";
      }
      errorDescription = "";
      code = 200;
    } catch (err) {
      error(req.path, "DATABASE", "database.check_email_existence", code, err);
    }
  }

  const accessResponse = new AccessResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(accessResponse.toJson())
  );
  return res.status(code).json(accessResponse.toJson());
});

// returns the status of signup request (true = signed_up successfully, false = error [see error code/description])

api.get(signup_path, async (req, res) => {
  const email = req.query.email;
  const name = req.query.name;
  const surname = req.query.surname;
  const handle = req.query.handle;
  const password = req.query.password;
  const privacy_policy_accepted = req.query.privacy_policy_accepted;
  const terms_of_service_accepted = req.query.terms_of_service_accepted;

  const sanitizedQuery = { ...req.query };
  if (sanitizedQuery.password) {
    sanitizedQuery.password = "*".repeat(sanitizedQuery.password.length);
  }

  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(sanitizedQuery));

  const type = signup_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  // check if every parameter is valid
  if (!validator.email(email)) {
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  } else if (!validator.name(name)) {
    code = 400;
    errorDescription = "Name not valid";
    validated = false;
  } else if (!validator.surname(surname)) {
    code = 400;
    errorDescription = "Surname not valid";
    validated = false;
  } else if (!validator.generic(handle)) {
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  } else if (!(await database.check_handle_availability(handle))) {
    // handle should not exist
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  } else if (!validator.password(password)) {
    code = 400;
    errorDescription = "Password not valid";
    validated = false;
  } else if (!privacy_policy_accepted) {
    code = 400;
    errorDescription = "Privacy policy not accepted";
    validated = false;
  } else if (!terms_of_service_accepted) {
    code = 400;
    errorDescription = "Terms of service not accepted";
    validated = false;
  }

  // only if everything is valid, try to sign up
  if (validated) {
    const signupUser = new SignupUser(email, name, surname, handle, password);
    try {
      confirmation = await database.add_user_to_db(signupUser);
      if (confirmation) {
        code = 200;
        errorDescription = "";
      } else {
        code = 500;
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.add_user_to_db", code, err);
    }
  }

  const signupResponse = new SignupResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(signupResponse.toJson())
  );
  return res.status(code).json(signupResponse.toJson());
});

api.get(login_path, async (req, res) => {
  const email = req.query.email;
  const password = req.query.password;

  const sanitizedQuery = { ...req.query };
  if (sanitizedQuery.password) {
    sanitizedQuery.password = "*".repeat(sanitizedQuery.password.length);
  }

  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(sanitizedQuery));

  const type = login_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;
  let user_id = null;
  let token = null;
  let two_fa_methods = [];

  if (!validator.email(email)) {
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  } else if (!validator.generic(password)) {
    code = 400;
    errorDescription = "Password not valid";
    validated = false;
  }

  if (validated) {
    const loginUser = new LoginUser(email, password);
    try {
      user_id = await database.login(loginUser);

      if (validator.generic(user_id)) {
        confirmation = true;
        errorDescription = "";
        code = 200;

        if (!(await database.checkEmailVerification(email))) {
          two_fa_methods.push("email_verification");

          debug(
            req.path,
            "TWO_FA",
            "Email verification required",
            code,
            user_id
          );

          // Generate a JWT token for the email verification

          const payload = {
            user_id: user_id,
            type: "email_verification",
            created_at: Date.now(),
            exp:
              Math.floor(Date.now() / 1000) +
              envManager.readEmailVerificationExpiringTime(), // 10 minutes
          };
          const secret = envManager.readJWTSecret(); // Your JWT secret
          token = jwt.sign(payload, secret);

          // Store the token in the Map
          const expires_at = new Date(
            Date.now() + envManager.readEmailVerificationExpiringTime() * 1000
          ); // 10 minutes
          const verification_code = Math.floor(
            100000 + Math.random() * 900000
          ).toString(); // Generate a random 6-digit numeric code
          emailVerificationTokens.set(token, {
            user_id: user_id,
            expires_at: expires_at,
            code: verification_code,
          });

          // Send the email verification code to the user

          const subject = "Verify your email address";
          const text = `Your verification code is: ${verification_code}`;
          const html = `<p>Your verification code is: <strong>${verification_code}</strong></p>`;
          // Send the email using the SMTP service
          await smtp.sendEmail(email, subject, text, html);

          debug(
            req.path,
            "TWO_FA",
            "Email verification token generated and email sent",
            verification_code,
            user_id,
            token
          );

          // If email verification is required, we don't set the session yet
          const loginResponse = new LoginResponse(
            type,
            confirmation,
            errorDescription,
            token,
            two_fa_methods
          );
          debug(
            Date.now() - start,
            req.path,
            "RESPONSE",
            "",
            code,
            JSON.stringify(loginResponse.toJson())
          );
          return res.status(code).json(loginResponse.toJson());
        } else {
          two_fa_methods = await database.getTwoFAMethods(user_id);
          if (two_fa_methods.length > 0) {
            debug(
              req.path,
              "TWO_FA",
              "Two-factor authentication required",
              code,
              user_id
            );

            // Generate a JWT token for the two-factor authentication
            const payload = {
              user_id: user_id,
              type: "2fa",
              created_at: Date.now(),
              exp:
                Math.floor(Date.now() / 1000) +
                envManager.readTwoFATokenExpiringTime(), // 5 minutes
            };
            const secret = envManager.readJWTSecret(); // Your JWT secret
            token = jwt.sign(payload, secret);

            // Store the token in the Map
            const expires_at = new Date(
              Date.now() + envManager.readTwoFATokenExpiringTime() * 1000
            ); // 5 minutes

            if (two_fa_methods.length === 1) {
              // If there is only one method, we can directly set the token

              if (two_fa_methods[0] === "email") {
                const verification_code = Math.floor(
                  100000 + Math.random() * 900000
                ).toString(); // Generate a random 6-digit numeric code

                twoFATokens.set(token, {
                  user_id: user_id,
                  expires_at: expires_at,
                  method: "email",
                  code: verification_code,
                });

                // Send the email with the code
                const subject = "Two-factor authentication code";
                const text = `Your two-factor authentication code is: ${verification_code}`;
                const html = `<p>Your two-factor authentication code is: <strong>${verification_code}</strong></p>`;
                await smtp.sendEmail(email, subject, text, html);
              } else if (two_fa_methods[0] === "authenticator") {
                // For authenticator apps, we just set the token without sending an email
                twoFATokens.set(token, {
                  user_id: user_id,
                  expires_at: expires_at,
                  method: "authenticator",
                  code: null, // No code to send for authenticator apps
                });
              }
            } else {
              // If there are multiple methods, we just set the token without doing nothing specific
              twoFATokens.set(token, {
                user_id: user_id,
                expires_at: expires_at,
                method: null, // No specific method yet
                code: null, // No code to send for multiple methods
              });
            }

            // If two-factor authentication is required, we don't set the session yet
            const loginResponse = new LoginResponse(
              type,
              confirmation,
              errorDescription,
              token,
              two_fa_methods
            );

            debug(
              Date.now() - start,
              req.path,
              "RESPONSE",
              "",
              code,
              JSON.stringify(loginResponse.toJson())
            );
            return res.status(code).json(loginResponse.toJson());
          } else {
            debug("", req.path, "SESSION", "Session opened.", code, user_id);
            req.session.user_id = user_id;
            debug("", req.path, "SESSION", "Session set.", code, user_id);

            req.session.save(async (err) => {
              if (req.session.user_id && !err) {
                debug("", req.path, "SESSION", "Session saved.", code, user_id);
                await enforceSessionLimit(req, res);
                token = req.sessionID;
                const loginResponse = new LoginResponse(
                  type,
                  confirmation,
                  errorDescription,
                  token,
                  two_fa_methods
                );
                debug(
                  Date.now() - start,
                  req.path,
                  "RESPONSE",
                  "",
                  code,
                  JSON.stringify(loginResponse.toJson())
                );
                res.status(code).json(loginResponse.toJson());
              } else {
                error(
                  req.path,
                  "SESSION",
                  "Error while saving session",
                  code,
                  err.message
                );
                await destroySession(req, res); // destroy session in redis and in the cookie
                code = 500;
                errorDescription = "Failed to save session";
                const loginResponse = new LoginResponse(
                  type,
                  false,
                  errorDescription,
                  token,
                  two_fa_methods
                );
                res.status(code).json(loginResponse.toJson());
              }
            });
          }
        }
        return;
      } else {
        code = 400;
        errorDescription = "Login failed";
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.login", code, err);
      errorDescription = "Database error";
    }
  }

  // if the user is not logged in, send the error response
  const loginResponse = new LoginResponse(
    type,
    confirmation,
    errorDescription,
    token,
    two_fa_methods
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(loginResponse.toJson())
  );
  return res.status(code).json(loginResponse.toJson());
});

api.get(logout_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  let user_id = null;

  let type = logout_response_type;
  let confirmation = false;
  let code = 500;
  let errorDescription = "Generic error";

  if (req.session.user_id) {
    user_id = req.session.user_id;

    try {
      const session_id = req.session.id;
      const socket_id = io.get_socket_id(session_id); // get the socket id from the activeSessions map using the session_id

      io.close_socket(socket_id); // close socket connection
      confirmation = await destroySession(req, res); // destroy session in redis and in the cookie

      if (confirmation) {
        code = 200;
        errorDescription = "";
      }
    } catch (err) {
      error(req.path, "SESSION", "session.destroy", code, err);
    }
  }

  const logoutResponse = new LogoutResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    user_id,
    code,
    JSON.stringify(logoutResponse.toJson())
  );
  return res.status(code).json(logoutResponse.toJson());
});

api.get(session_path, isAuthenticated, (req, res) => {
  // DEPRECATED

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = session_response_type;
  let code = 500;
  let session_id = null;
  let errorDescription = "Generic error";
  let user_id = null;

  if (req.session.user_id) {
    code = 200;
    errorDescription = "";
    session_id = req.sessionID;
    user_id = req.session.user_id;
  }

  const sessionResponse = new SessionResponse(
    type,
    session_id,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    user_id,
    code,
    JSON.stringify(sessionResponse.toJson())
  );
  return res.status(code).json(sessionResponse.toJson());
}); // DEPRECATED

api.get(generate_qr_code_path, async (req, res) => {
  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));

  const type = generate_qr_code_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";

  let qr_token = null;

  try {
    // Create JWT token with expiration
    const payload = {
      type: "qr_login",
      created_at: Date.now(),
      exp: Math.floor(Date.now() / 1000) + envManager.readQRCodeExpiringTime(), // 5 minutes
    };

    const secret = envManager.readJWTSecret(); // Your JWT secret
    qr_token = jwt.sign(payload, secret);

    // Store in Map with null session_id initially
    const expires_at = new Date(
      Date.now() + envManager.readQRCodeExpiringTime() * 1000
    ); // 5 minutes
    qrLoginSessions.set(qr_token, {
      session_id: null,
      user_id: null,
      expires_at: expires_at,
    });

    confirmation = true;
    code = 200;
    errorDescription = "";
  } catch (err) {
    error(req.path, "DATABASE", "database.generate_qr_code", code, err);
  }

  const qrCodeResponse = new QRCodeResponse(
    type,
    confirmation,
    qr_token,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(qrCodeResponse.toJson())
  );
  return res.status(code).json(qrCodeResponse.toJson());
});

api.get(scan_qr_code_path, isAuthenticated, async (req, res) => {
  const qr_token = req.query.qr_token;
  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));

  const type = scan_qr_code_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";

  let validated = true;
  if (!validator.generic(qr_token)) {
    code = 400;
    errorDescription = "QR token not valid";
    validated = false;
  }
  if (validated) {
    try {
      // Verify the JWT token
      const secret = envManager.readJWTSecret(); // Your JWT secret
      const decoded = jwt.verify(qr_token, secret);

      if (decoded.type === "qr_login") {
        // Check if the token exists in the Map
        if (!qrLoginSessions.has(qr_token)) {
          code = 400;
          errorDescription = "QR token not found or expired";
        } else if (qrLoginSessions.get(qr_token).user_id !== null) {
          // If the user_id is already set, it means the QR code has already been scanned
          code = 400;
          errorDescription = "QR token already scanned";
        } else if (qrLoginSessions.get(qr_token).expires_at < new Date()) {
          // If the token has expired
          code = 401;
          errorDescription = "QR token expired";
        } else {
          // If the token is valid and not expired, logic to handle the QR code scan

          const user_id = req.session.user_id;

          // Store the user_id in the Map
          qrLoginSessions.get(qr_token).user_id = user_id;

          confirmation = true;
          code = 200;
          errorDescription = "";
        }
      } else {
        code = 400;
        errorDescription = "Invalid QR token type";
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        code = 401;
        errorDescription = "QR token expired";
      } else if (err.name === "JsonWebTokenError") {
        code = 400;
        errorDescription = "Invalid QR token";
      } else {
        error(req.path, "JWT", "jwt.verify", code, err);
      }
    }
  }
  // if the user is not logged in, send the error response
  const scanQRResponse = new Response(type, confirmation, errorDescription);

  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(scanQRResponse.toJson())
  );
  return res.status(code).json(scanQRResponse.toJson());
});

// Check QR Code token status

api.get(check_qr_code_path, async (req, res) => {
  const qr_token = req.query.qr_token;
  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));

  const type = check_qr_code_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let session_id = null;

  let validated = true;
  if (!validator.generic(qr_token)) {
    code = 400;
    errorDescription = "QR token not valid";
    validated = false;
  }

  if (validated) {
    try {
      // Check if the token exists in the Map
      if (qrLoginSessions.has(qr_token)) {
        const sessionData = qrLoginSessions.get(qr_token);

        const user_id = sessionData.user_id;

        if (user_id === null) {
          // If the session_id is null, it means the QR code has not been scanned yet
          code = 202; // Accepted, but not yet scanned
          errorDescription = "QR token not scanned yet";
        } else if (sessionData.expires_at < new Date()) {
          // If the token has expired
          code = 401;
          errorDescription = "QR token expired";
        }
        // If the session_id is set, it means the QR code has been scanned successfully
        else {
          req.session.user_id = user_id;
          debug("", req.path, "SESSION", "QR Session set.", "", user_id);

          req.session.save(async (err) => {
            if (req.session.user_id && !err) {
              debug("", req.path, "SESSION", "QR Session saved.", "", user_id);
              await enforceSessionLimit(req, res);

              // Remove token from Map after successful login
              qrLoginSessions.delete(qr_token);

              session_id = req.sessionID;
              confirmation = true;
              code = 200;
              errorDescription = "";

              const checkQRResponse = new CheckQRCodeResponse(
                type,
                confirmation,
                session_id,
                errorDescription
              );
              debug(
                Date.now() - start,
                req.path,
                "RESPONSE",
                "",
                code,
                JSON.stringify(checkQRResponse.toJson())
              );
              return res.status(code).json(checkQRResponse.toJson());
            } else {
              error(
                req.path,
                "SESSION",
                "Error while saving session",
                code,
                err.message
              );
              await destroySession(req, res); // destroy session in redis and in the cookie
              code = 500;
              errorDescription = "Failed to save session";

              // if the user is not logged in, send the error response
              const checkQRResponse = new CheckQRCodeResponse(
                type,
                confirmation,
                session_id,
                errorDescription
              );
              debug(
                Date.now() - start,
                req.path,
                "RESPONSE",
                "",
                code,
                JSON.stringify(checkQRResponse.toJson())
              );
              return res.status(code).json(checkQRResponse.toJson());
            }
          });
          return;
        }
      } else {
        code = 404;
        errorDescription = "QR token not found";
      }
    } catch (err) {
      error(req.path, "QR_CODE", "qrLoginSessions.get", code, err);
    }
  }

  const checkQRResponse = new CheckQRCodeResponse(
    type,
    confirmation,
    session_id,
    errorDescription
  );

  return res.status(code).json(checkQRResponse.toJson());
});

api.get(forgot_password_path, async (req, res) => {
  const email = req.query.email;
  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));
  const type = "forgot_password";
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.email(email)) {
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  }

  if (validated) {
    try {
      const user_id = await database.get_user_id_from_email(email);

      if (user_id) {
        //generate a JWT token with the email and an expiration time

        const payload = {
          user_id: user_id,
          type: "forgot_password",
          created_at: Date.now(),
          exp:
            Math.floor(Date.now() / 1000) +
            envManager.readResetPasswordTokenExpiringTime(), // 1 hour
        };
        const secret = envManager.readJWTSecret(); // Your JWT secret
        const token = jwt.sign(payload, secret);
        // Store the token in the database or send it via email
        confirmation = true;
        code = 200;
        errorDescription = "";

        const expires_at = new Date(
          Date.now() + envManager.readResetPasswordTokenExpiringTime() * 1000
        );
        resetPasswordTokens.set(token, {
          user_id: user_id,
          expires_at: new Date(Date.now() + expires_at),
        });

        // Send the token via email
        const subject = "Reset your password";
        const text = `To reset your password, please click on the following link: https://${envManager.readWebDomain()}/welcome/reset-password?token=${token}&email=${email}\n\nIf you did not request this, please ignore this email.`;
        const html = `<p>To reset your password, please click on the following link:
        <a href="https://${envManager.readWebDomain()}/welcome/reset-password?token=${token}&email=${email}">Reset Password</a></p>
        <p>If you did not request this, please ignore this email.</p>`;
        await smtp.sendEmail(email, subject, text, html);
      } else {
        code = 400;
        errorDescription = "Email not valid";
      }
    } catch (err) {
      error(req.path, "JWT", "jwt.sign", code, err);
      errorDescription = "Error generating reset password token";
    }
  }

  const forgotPasswordResponse = new ForgotPasswordResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(forgotPasswordResponse.toJson())
  );
  return res.status(code).json(forgotPasswordResponse.toJson());
});

api.get(reset_password_path, async (req, res) => {
  const token = req.query.token;
  const password = req.query.password;
  const email = req.query.email;

  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));
  const type = "reset_password";
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.generic(token)) {
    code = 400;
    errorDescription = "Token not valid";
    validated = false;
  } else if (!validator.password(password)) {
    code = 400;
    errorDescription = "Password not valid";
    validated = false;
  } else if (!validator.email(email)) {
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  }

  if (validated) {
    try {
      // Verify the JWT token
      const secret = envManager.readJWTSecret(); // Your JWT secret
      const decoded = jwt.verify(token, secret);
      if (decoded.type === "forgot_password") {
        // Check if the token exists in the Map
        if (!resetPasswordTokens.has(token)) {
          code = 400;
          errorDescription = "Password reset failed.";
        } else if (resetPasswordTokens.get(token).expires_at < new Date()) {
          // If the token has expired
          code = 401;
          errorDescription = "Token expired.";
        } else {
          // If the token is valid and not expired, logic to handle the reset password
          const user_id = resetPasswordTokens.get(token).user_id;

          if (user_id != (await database.get_user_id_from_email(email))) {
            code = 400;
            errorDescription = "Password reset failed.";
          } else {
            // Update the password in the database
            confirmation = await database.reset_password(user_id, password);
            if (confirmation) {
              code = 200;
              errorDescription = "";
              resetPasswordTokens.delete(token); // Remove token from Map after successful reset
              destroyAllUserSessionsExcept(database.get, null); // invalidate all sessions of the user except the current one
            } else {
              code = 500;
              errorDescription = "Password reset failed.";
            }
          }
        }
      } else {
        code = 400;
        errorDescription = "Password reset failed.";
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        code = 401;
        errorDescription = "Token expired.";
      } else if (err.name === "JsonWebTokenError") {
        code = 400;
        errorDescription = "Password reset failed.";
      } else {
        error(req.path, "JWT", "jwt.verify", code, err);
      }
    }
  }

  const resetPasswordResponse = new ResetPasswordResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(resetPasswordResponse.toJson())
  );
  return res.status(code).json(resetPasswordResponse.toJson());
});

api.get(change_password_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;
  const old_password = req.query.old_password;
  const new_password = req.query.new_password;
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );
  const type = "change_password";
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;
  if (!validator.generic(old_password)) {
    code = 400;
    errorDescription = "Old password not valid";
    validated = false;
  } else if (!validator.password(new_password)) {
    code = 400;
    errorDescription = "New password not valid";
    validated = false;
  } else if (old_password === new_password) {
    code = 400;
    errorDescription = "New password cannot be the same as old password";
    validated = false;
  }

  if (validated) {
    try {
      confirmation = await database.change_password(
        user_id,
        old_password,
        new_password
      );
      if (confirmation) {
        code = 200;
        errorDescription = "";

        // invalid every session of the user except the current one
        destroyAllUserSessionsExcept(user_id, req.sessionID);
      } else {
        code = 400;
        errorDescription = "Change password failed";
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.change_password", code, err);
      errorDescription = "Database error";
    }
  }
  const changePasswordResponse = new ChangePasswordResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(changePasswordResponse.toJson())
  );

  return res.status(code).json(changePasswordResponse.toJson());
});

api.get(two_fa_path, async (req, res) => {
  const token = req.query.token;
  const two_fa_method = req.query.method;
  const verification_code = req.query.code;
  const start = res.locals.start;

  let session_token = null;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );
  const type = "authenticated";
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.generic(two_fa_method)) {
    code = 400;
    errorDescription = "Two-factor authentication method not valid";
    validated = false;
  }

  if (validated) {
    try {
      // Verify the JWT token
      const secret = envManager.readJWTSecret(); // Your JWT secret
      const decoded = jwt.verify(token, secret);

      if (decoded.type === "email_verification" && two_fa_method === "email_verification") {

        debug(
          req.path,
          "TWO_FA",
          "Email verification token received",
          code,
          null
        );

        // Check if the token exists in the Map
        if (!emailVerificationTokens.has(token)) {
          code = 400;
          errorDescription = "Email verification failed.";
        } else if (emailVerificationTokens.get(token).expires_at < new Date()) {
          // If the token has expired
          code = 401;
          errorDescription = "Token expired.";
        } else {
          // If the token is valid and not expired, logic to handle the email verification
          if (verification_code === emailVerificationTokens.get(token).code) {
            const user_id = emailVerificationTokens.get(token).user_id;

            // Update the user's email verification status in the database
            const email = await database.get_email_from_user_id(user_id);
            confirmation = await database.verify_email(email);
            if (confirmation) {
              code = 200;
              errorDescription = "";
              emailVerificationTokens.delete(token); // Remove token from Map after successful verification
              debug(
                req.path,
                "TWO_FA",
                "Email verified successfully",
                code,
                email
              );
              // Set the session user_id to the verified user_id
              req.session.user_id = user_id;
              debug(
                req.path,
                "SESSION",
                "Email verification session set.",
                code,
                user_id
              );

              req.session.save(async (err) => {
                if (req.session.user_id && !err) {
                  debug(
                    req.path,
                    "SESSION",
                    "Email verification session saved.",
                    code,
                    user_id
                  );
                  await enforceSessionLimit(req, res);
                  session_token = req.sessionID;
                  confirmation = true;

                  const emailVerificationResponse = new TwoFAResponse(
                    type,
                    confirmation,
                    session_token,
                    errorDescription
                  );
                  debug(
                    Date.now() - start,
                    req.path,
                    "RESPONSE",
                    req.session.user_id,
                    code,
                    JSON.stringify(emailVerificationResponse.toJson())
                  );
                  return res
                    .status(code)
                    .json(emailVerificationResponse.toJson());
                } else {
                  error(
                    req.path,
                    "SESSION",
                    "Error while saving session",
                    code,
                    err.message
                  );
                  await destroySession(req, res); // destroy session in redis and in the cookie
                  code = 500;
                  errorDescription = "Failed to save session";
                }
              });
            }
          } else {
            code = 500;
            errorDescription = "Email verification failed.";
          }
        }
      } else if (decoded.type === "2fa") {
        debug(req.path, "TWO_FA", "2FA token received", code, null);
        // Check if the token is in the Map for two-factor authentication
        const twoFAToken = twoFATokens.get(token);
        if (!twoFAToken) {
          code = 400;
          errorDescription = "Two-factor authentication failed.";
        } else if (twoFAToken.expires_at < new Date()) {
          // If the token has expired
          code = 401;
          errorDescription = "Token expired.";
        } else {
          // If the token is valid and not expired, logic to handle the two-factor authentication
          const user_id = twoFAToken.user_id;

          // Check if the two-factor authentication method is valid
          if (twoFAToken.method !== two_fa_method) {
            code = 400;
            errorDescription = "Two-factor authentication method not valid";
          } else {
            if (two_fa_method === "email") {
              // For email verification, we check the code sent to the user's email
              if (verification_code === twoFAToken.code) {
                confirmation = true;
              }
            } else if (two_fa_method === "authenticator") {
              // For authenticator apps, we can use a library like speakeasy to verify the code
              // For now not working
              confirmation = false;
            }
            if (confirmation) {
              code = 200;
              errorDescription = "";
              twoFATokens.delete(token); // Remove token from Map after successful verification
              debug(
                req.path,
                "TWO_FA",
                "Two-factor authentication verified successfully",
                code,
                user_id
              );
              // Set the session user_id to the verified user_id
              req.session.user_id = user_id;
              debug(
                req.path,
                "SESSION",
                "Two-factor authentication session set.",
                code,
                user_id
              );

              req.session.save(async (err) => {
                if (req.session.user_id && !err) {
                  debug(
                    req.path,
                    "SESSION",
                    "Two-factor authentication session saved.",
                    code,
                    user_id
                  );
                  await enforceSessionLimit(req, res);
                  session_token = req.sessionID;
                  confirmation = true;

                  const twoFAResponse = new TwoFAResponse(
                    type,
                    confirmation,
                    session_token,
                    errorDescription
                  );
                  debug(
                    Date.now() - start,
                    req.path,
                    "RESPONSE",
                    req.session.user_id,
                    code,
                    JSON.stringify(twoFAResponse.toJson())
                  );
                  return res.status(code).json(twoFAResponse.toJson());
                } else {
                  error(
                    req.path,
                    "SESSION",
                    "Error while saving session",
                    code,
                    err.message
                  );
                  await destroySession(req, res); // destroy session in redis and in the cookie
                  code = 500;
                  errorDescription = "Failed to save session";
                }
              });
              return;
            } else {
              code = 500;
              errorDescription = "Two-factor authentication failed.";
            }
          }
        }
      } else {
        code = 400;
        errorDescription = "Invalid token type";
      }
    } catch (err) {
      error(
        req.path,
        "DATABASE",
        "database.getTwoFAMethods",
        code,

        err
      );

      errorDescription = "Database error";
    }
  }
  const twoFAResponse = new TwoFAResponse(
    type,
    confirmation,
    session_token,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(twoFAResponse.toJson())
  );
  return res.status(code).json(twoFAResponse.toJson());
});

// Path: .../data
// Path: .../check

// return state of handle (available = true, unavailable = false)

api.get(handle_availability_path, async (req, res) => {
  const handle = req.query.handle;

  const start = res.locals.start;
  debug("", req.path, "REQUEST", "", "", JSON.stringify(req.query));

  const type = handle_availability_response_type;
  let code = 500;
  let confirmation = null;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.generic(handle)) {
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  }

  if (validated) {
    try {
      confirmation = await database.check_handle_availability(handle);

      if (confirmation != null) {
        code = 200;
        errorDescription = "";
      }
    } catch (err) {
      error(
        req.path,
        "DATABASE",
        "database.check_handle_availability",
        code,
        err
      );
    }
  }

  const handleResponse = new HandleResponse(
    type,
    confirmation,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    "",
    code,
    JSON.stringify(handleResponse.toJson())
  );
  return res.status(code).json(handleResponse.toJson());
});
// Path: .../get

api.get(init_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = init_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let init_data = null;

  try {
    init_data = await database.client_init(user_id);

    if (init_data != null) {
      confirmation = true;
      code = 200;
      errorDescription = "";

      const date = new Date();
      init_data = {
        ...init_data,
        date: date,
      };
    }
  } catch (err) {
    error(req.path, "DATABASE", "database.client_init", code, err);
  }

  const initResponse = new InitResponse(
    type,
    confirmation,
    errorDescription,
    init_data
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(initResponse.toJson()).substring(0, 200) + "..."
  );
  return res.status(code).json(initResponse.toJson());
});

api.get(update_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const latest_update_datetime = req.query.latest_update_datetime;

  const type = update_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let update_data = null;

  let validated = true;

  if (!validator.datetime(latest_update_datetime)) {
    code = 400;
    errorDescription = "Latest update datetime not valid";
    validated = false;
  }

  if (validated) {
    try {
      update_data = await database.client_update(
        latest_update_datetime,
        user_id
      );

      if (update_data != null) {
        confirmation = true;
        code = 200;
        errorDescription = "";
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.client_update", code, err);
    }
  }

  const updateResponse = new UpdateResponse(
    type,
    confirmation,
    errorDescription,
    update_data
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(updateResponse.toJson())
  );
  return res.status(code).json(updateResponse.toJson());
});

// Path: .../search

api.get(search_users_path, isAuthenticated, async (req, res) => {
  const handle = req.query.handle;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = search_response_type;
  let code = 500;
  let searched_list = null;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.generic(handle)) {
    code = 400;
    errorDescription = "Search parameter (handle) not valid";
    validated = false;
  }

  if (validated) {
    try {
      searched_list = await database.search_users(handle); // a list of similar handles are returned (ONLY USERS)
      code = 200;
      errorDescription = "";
    } catch (err) {
      error(req.path, "DATABASE", "database.search_users", code, err);
    }
  }

  const searchResponse = new SearchResponse(
    type,
    searched_list,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(searchResponse.toJson())
  );
  return res.status(code).json(searchResponse.toJson());
});

api.get(search_all_path, isAuthenticated, async (req, res) => {
  const handle = req.query.handle;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = search_response_type;
  let code = 500;
  let searched_list = null;
  let errorDescription = "Generic error";
  let validated = true;

  if (!validator.generic(handle)) {
    code = 400;
    errorDescription = "Search parameter (handle) not valid";
    validated = false;
  }

  if (validated) {
    try {
      searched_list = await database.search(handle); // a list of similar handles are returned
      code = 200;
      errorDescription = "";
    } catch (err) {
      error(req.path, "DATABASE", "database.search", code, err);
    }
  }

  const searchResponse = new SearchResponse(
    type,
    searched_list,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(searchResponse.toJson())
  );
  return res.status(code).json(searchResponse.toJson());
});

// Path: /chat
// Path: .../send

api.get(message_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;

  const text = req.query.text;
  const chat_id = req.query.chat_id;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = message_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  let message_data,
    recipient_list = null;

  if (!validator.message(text)) {
    code = 400;
    errorDescription =
      "Text message not valid (Too long [max 2056 char] or missing)";
    validated = false;
  } else if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  }

  if (validated) {
    try {
      const message = new Message(chat_id, user_id, text);

      const response = await database.send_message(message);

      message_data = response.message_data;
      recipient_list = response.recipient_list;

      if (message_data != null && recipient_list != null) {
        confirmation = true;
        code = 200;
        errorDescription = "";
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.send_message", code, err);
    }
  }

  const messageResponse = new MessageResponse(
    type,
    confirmation,
    errorDescription,
    message_data
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(messageResponse.toJson())
  );
  res.status(code).json(messageResponse.toJson());

  // Send messages to recipients after sending the response to sender
  if (message_data != null && recipient_list != null) {
    const sender_socket_id = io.get_socket_id(req.session.id);
    setImmediate(() => {
      io.send_messages_to_recipients(
        recipient_list,
        message_data,
        sender_socket_id
      );
    });
  }

  return;
});

// Path: .../create

api.get(chat_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const handle = await database.get_handle_from_id(user_id);
  const other_handle = req.query.handle;

  const type = chat_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  let chat_id = null;

  if (!validator.generic(other_handle)) {
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  } else if (await database.check_handle_availability(other_handle)) {
    // handle should exist
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  } else if (handle == other_handle) {
    code = 400;
    errorDescription =
      "Handle not valid: You cannot create a chat with yourself";
    validated = false;
  } else if (await database.check_chat_existance(handle, other_handle)) {
    code = 400;
    errorDescription = "Chat already exists";
    validated = false;
  }

  if (validated) {
    try {
      const other_user_id = await database.get_user_id_from_handle(
        other_handle
      );

      if (other_user_id != null) {
        try {
          const chat = new Chat(user_id, other_user_id);
          chat_id = await database.create_chat(chat);
          if (chat_id != null) {
            confirmation = true;
            code = 200;
            errorDescription = "";
          }
        } catch (err) {
          error(req.path, "DATABASE", "database.create_chat", code, err);
        }
      }
    } catch (err) {
      error(
        req.path,
        "DATABASE",
        "database.get_user_id_from_handle",
        code,
        err
      );
    }
  }

  const createChatResponse = new CreateChatResponse(
    type,
    confirmation,
    errorDescription,
    chat_id
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(createChatResponse.toJson())
  );
  return res.status(code).json(createChatResponse.toJson());
});

api.get(group_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const name = req.query.name;
  let handle = req.query.handle;

  // optionals
  const description = req.query.description;
  const members_handles = req.query.members;
  // both can be empty

  // creator of the group is also an admin (and a member)
  const members = [user_id];
  const admins = [user_id];

  const type = group_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  let chat_id = null;
  let date = null;

  if (!validator.generic(name)) {
    code = 400;
    errorDescription = "Name not valid";
    validated = false;
  } else if (validator.generic(handle)) {
    // skip if handle is not provided = group is private
    if (!(await validator.handle(handle))) {
      code = 400;
      errorDescription = "Handle not valid";
      validated = false;
    }
  } else {
    handle = null; // handle is not provided = group is private
  }

  if (validated) {
    // get all members list from their handles
    if (members_handles != null) {
      for (let i = 0; i < members_handles.length; i++) {
        try {
          const other_user_id = await database.get_user_id_from_handle(
            members_handles[i]
          );
          if (other_user_id != null) {
            members.push(other_user_id);
          }
        } catch (err) {
          error(
            req.path,
            "DATABASE",
            "database.get_user_id_from_handle",
            code,
            err
          );
        }
      }
    }
    try {
      const group = new Group(handle, name, description, members, admins);
      const result = await database.create_group(group);
      chat_id = result.chat_id;
      date = result.date;
      if (chat_id != null && date != null) {
        confirmation = true;
        code = 200;
        errorDescription = "";
      }
    } catch (err) {
      error(req.path, "DATABASE", "database.create_group", code, err);
    }
  }

  const createGroupResponse = new CreateGroupResponse(
    type,
    confirmation,
    errorDescription,
    chat_id
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(createGroupResponse.toJson())
  );
  res.status(code).json(createGroupResponse.toJson());

  // Send group to recipients after sending the response to sender
  if (chat_id != null && date != null) {
    const group_data = {
      chat_id: chat_id,
      name: name,
      description: description,
      members: members,
      admins: admins,
      date: date,
    };

    setImmediate(() => {
      const sender_socket_id = io.get_socket_id(req.session.id);
      io.send_groups_to_recipients(members, group_data, sender_socket_id);
    });
  }

  return;
});

// Path: .../get

api.get(members_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = get_members_response_type;
  let code = 500;
  let members_list = null;
  let errorDescription = "Generic error";
  let validated = true;

  const chat_id = req.query.chat_id;

  if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  }

  if (validated) {
    try {
      members_list = await database.get_members_as_user_id(chat_id);
      code = 200;
      errorDescription = "";
    } catch (err) {
      error(req.path, "DATABASE", "database.get_members", code, err);
    }
  }

  const membersResponse = new MembersResponse(
    type,
    members_list,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(membersResponse.toJson())
  );
  return res.status(code).json(membersResponse.toJson());
});

// Path: .../join

api.get(join_group_path, isAuthenticated, async (req, res) => {
  const user_id = req.session.user_id; // all public groups are visible to all users

  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = join_group_response_type;
  let code = 500;
  let errorDescription = "Generic error";
  let confirmation = false;
  let validated = true;

  let group_name = null;

  let data = {};
  let date = null;

  const handle = req.query.handle;
  let chat_id = null;
  let members = null; // get all members of the group

  if (!validator.generic(handle)) {
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  } else {
    try {
      chat_id = await database.get_chat_id_from_handle(handle);
      if (chat_id != null) {
        try {
          members = await database.get_members_as_user_id(chat_id);
        } catch (err) {
          error(
            req.path,
            "DATABASE",
            "database.get_members_as_user_id",
            code,
            err
          );
        }
      } else {
        code = 400;
        errorDescription = "Handle not valid";
      }
    } catch (err) {
      error(
        req.path,
        "DATABASE",
        "database.get_chat_id_from_handle",
        code,
        err
      );
    }

    if (members == null) {
      code = 400;
      errorDescription = "Handle not valid";
      validated = false;
    } else if (members.includes(user_id)) {
      code = 400;
      errorDescription = "User already in group";
      validated = false;
    }
  }

  if (validated) {
    try {
      group_name = await database.get_group_name_from_chat_id(chat_id);

      try {
        const result = await database.add_members_to_group(chat_id, user_id);
        confirmation = result.confirmation;
        date = result.date;
        if (confirmation) {
          data.group_name = group_name;
          data.chat_id = chat_id;

          // Map each user_id to an object with both id and handle
          const members_handles = await Promise.all(
            members.map(async (member_id) => {
              return {
                user_id: member_id,
                handle: await database.get_handle_from_id(member_id),
              };
            })
          );

          // Add the current user to the members list
          members_handles.push({
            user_id: user_id,
            handle: await database.get_handle_from_id(user_id),
          });

          data.members = members_handles; // get all members of the group

          data.messages = await database.get_chat_messages(chat_id); // get all messages of the group

          code = 200;
          errorDescription = "";
        }
      } catch (err) {
        error(req.path, "DATABASE", "database.add_member_to_group", code, err);
      }
    } catch (err) {
      error(
        req.path,
        "DATABASE",
        "database.get_group_name_from_chat_id",
        code,
        err
      );
    }
  }

  const joinGroupResponse = new JoinGroupResponse(
    type,
    confirmation,
    errorDescription,
    data
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(joinGroupResponse.toJson())
  );
  res.status(code).json(joinGroupResponse.toJson());

  // Send group to recipients after sending the response to sender
  if (validated && confirmation && chat_id != null) {
    const user_data = {
      chat_id: chat_id,
      handle: handle,
      date: date,
    };

    data = {
      ...data,
      date: date,
    };

    setImmediate(() => {
      const sender_socket_id = io.get_socket_id(req.session.id);
      io.send_group_member_joined(members, user_data, sender_socket_id);
      io.send_member_member_joined(user_id, data, sender_socket_id);
    });
  }

  return;
});

// Path: /comms

api.get(join_comms_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = join_comms_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;
  let comms_id = crypto.randomUUID();

  const chat_id = req.query.chat_id;

  if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  } else if (!(await database.is_member(req.session.user_id, chat_id))) {
    code = 400;
    errorDescription = "No access to request chat";
    validated = false;
  }

  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if (socket_id != null) {
        confirmation = io.join_comms(socket_id, chat_id, comms_id); // join the socket to the room

        if (confirmation) {
          code = 200;
          errorDescription = "";
        } else {
          comms_id = null;
          code = 200;
          errorDescription = "User already in a comms";
        }
      } else {
        comms_id = null;
        code = 200;
        errorDescription = "No opened socket.io found.";
        confirmation = false;
      }
    } catch (err) {
      comms_id = null;
      error(req.path, "IO", "io.join_comms", code, err);
    }
  }

  const joinCommsResponse = new JoinCommsResponse(
    type,
    confirmation,
    comms_id,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(joinCommsResponse.toJson())
  );
  res.status(code).json(joinCommsResponse.toJson());

  if (confirmation) {
    let recipient_list = null;
    let from_handle = null;

    try {
      recipient_list = await database.get_members_as_user_id(chat_id);
    } catch (err) {
      error(req.path, "DATABASE", "database.get_members_as_user_id", code, err);
    }
    try {
      from_handle = await database.get_handle_from_id(req.session.user_id); // handle of the sender
    } catch (err) {
      error(req.path, "DATABASE", "database.get_handle_from_id", code, err);
    }

    if (recipient_list != null || from_handle != null) {
      const join_data = {
        chat_id: chat_id,
        handle: from_handle,
        from: comms_id,
      };
      const from_socket_id = io.get_socket_id(req.session.id);
      io.send_joined_member_to_comms(recipient_list, join_data, from_socket_id);
    }
  }
});

api.get(leave_comms_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = leave_comms_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  let chat_id = null;
  let comms_id = null;

  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if (socket_id != null) {
        [chat_id, comms_id] = io.leave_comms(socket_id); // leave room

        if (chat_id && comms_id) {
          confirmation = true;
          code = 200;
          errorDescription = "";
        } else {
          confirmation = false;
          code = 200;
          errorDescription = "User is not in a comms";
        }
      } else {
        code = 200;
        errorDescription = "No opened socket.io found.";
        confirmation = false;
      }
    } catch (err) {
      error(req.path, "IO", "io.leave_comms", code, err);
    }
  }

  const leaveCommsResponse = new LeaveCommsResponse(
    type,
    confirmation,
    chat_id,
    comms_id,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(leaveCommsResponse.toJson())
  );
  res.status(code).json(leaveCommsResponse.toJson());

  if (confirmation) {
    let recipient_list = null;

    try {
      recipient_list = await database.get_members_as_user_id(chat_id);
    } catch (err) {
      error(req.path, "DATABASE", "database.get_members_as_user_id", code, err);
    }

    if (recipient_list != null || from != null) {
      const left_data = {
        chat_id: chat_id,
        from: comms_id,
      };

      const from_socket_id = io.get_socket_id(req.session.id);
      io.send_left_member_to_comms(recipient_list, left_data, from_socket_id);
    }
  }
});

api.get(comms_members_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );

  const type = comms_members_response_type;
  let code = 500;
  let errorDescription = "Generic error";
  let validated = true;

  const chat_id = req.query.chat_id;

  let members_data = [];

  if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  } else if (!(await database.is_member(req.session.user_id, chat_id))) {
    code = 400;
    errorDescription = "No access to request chat";
    validated = false;
  }

  if (validated) {
    try {
      const [
        members_ids,
        comms_ids,
        is_speaking,
        webcam_on,
        active_screen_shares,
      ] = await io.get_users_info_room(chat_id);

      for (let i = 0; i < members_ids.length; i++) {
        try {
          const handle = await database.get_handle_from_id(members_ids[i]);
          const comms_id = comms_ids[i];

          members_data.push({
            handle: handle,
            from: comms_id,
            is_speaking: is_speaking[i],
            webcam_on: webcam_on[i],
            active_screen_share: active_screen_shares[i],
          });
        } catch (err) {
          error(req.path, "DATABASE", "database.get_handle_from_id", code, err);
        }
      }

      code = 200;
      errorDescription = "";
    } catch (err) {
      error(req.path, "IO", "io.get_user_id_room", code, err);
    }
  }

  const membersResponse = new MembersResponse(
    type,
    members_data,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(membersResponse.toJson())
  );
  return res.status(code).json(membersResponse.toJson());
});

api.get(start_screen_share_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );
  const type = start_screen_share_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;

  const chat_id = req.query.chat_id;
  let comms_id = null;
  let screen_share_uuid = null; // uuid of the screen share

  if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  } else if (!(await database.is_member(req.session.user_id, chat_id))) {
    code = 400;
    errorDescription = "No access to request chat";
    validated = false;
  }
  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if (socket_id != null) {
        const recipient_list = await database.get_members_as_user_id(chat_id);
        screen_share_uuid = io.start_screen_share(
          socket_id,
          chat_id,
          recipient_list
        ); // start screen share

        if (screen_share_uuid !== null) {
          confirmation = true;
          code = 200;
          errorDescription = "";
        } else {
          code = 200;
          errorDescription = "User already started a screen share";
        }
      } else {
        code = 200;
        errorDescription = "No opened socket.io found.";
      }
    } catch (err) {
      error(req.path, "IO", "io.start_screen_share", code, err);
    }
  }
  const startScreenShareResponse = new StartScreenShareResponse(
    type,
    confirmation,
    screen_share_uuid,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(startScreenShareResponse.toJson())
  );
  res.status(code).json(startScreenShareResponse.toJson());
});

api.get(stop_screen_share_path, isAuthenticated, async (req, res) => {
  const start = res.locals.start;
  debug(
    "",
    req.path,
    "REQUEST",
    req.session.user_id,
    "",
    JSON.stringify(req.query)
  );
  const type = stop_screen_share_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = "Generic error";
  let validated = true;
  const chat_id = req.query.chat_id;
  let screen_share_uuid = req.query.screen_share_uuid;

  if (!validator.chat_id(chat_id)) {
    code = 400;
    errorDescription = "Chat_id not valid";
    validated = false;
  } else if (!(await database.is_member(req.session.user_id, chat_id))) {
    code = 400;
    errorDescription = "No access to request chat";
    validated = false;
  }
  if (!validator.generic(screen_share_uuid)) {
    code = 400;
    errorDescription = "Screen share id not valid";
    validated = false;
  }
  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if (socket_id != null) {
        const recipient_list = await database.get_members_as_user_id(chat_id);
        confirmation = io.stop_screen_share(
          socket_id,
          chat_id,
          screen_share_uuid,
          recipient_list
        ); // stop screen share

        if (confirmation) {
          code = 200;
          errorDescription = "";
        } else {
          code = 200;
          errorDescription = "User is not sharing the screen";
        }
      } else {
        code = 200;
        errorDescription = "No opened socket.io found.";
      }
    } catch (err) {
      error(req.path, "IO", "io.stop_screen_share", code, err);
    }
  }
  const stopScreenShareResponse = new StopScreenShareResponse(
    type,
    confirmation,
    screen_share_uuid,
    errorDescription
  );
  debug(
    Date.now() - start,
    req.path,
    "RESPONSE",
    req.session.user_id,
    code,
    JSON.stringify(stopScreenShareResponse.toJson())
  );
  res.status(code).json(stopScreenShareResponse.toJson());
});

// POST METHODS

function postToGetWrapper(path) {
  api.post(path, (req, res) => {
    const queryParams = new URLSearchParams(req.body).toString();

    res.redirect(`${path}?${queryParams}`);
  });
}

// redirect every post request to a get request

postToGetWrapper(access_path);
postToGetWrapper(signup_path);
postToGetWrapper(login_path);
postToGetWrapper(logout_path);
postToGetWrapper(session_path);

postToGetWrapper(generate_qr_code_path);
postToGetWrapper(scan_qr_code_path);
postToGetWrapper(check_qr_code_path);

postToGetWrapper(forgot_password_path);
postToGetWrapper(reset_password_path);
postToGetWrapper(change_password_path);

postToGetWrapper(two_fa_path);

postToGetWrapper(handle_availability_path);

postToGetWrapper(init_path);
postToGetWrapper(update_path);

postToGetWrapper(message_path);
//postToGetWrapper(voice_message_path);
//postToGetWrapper(file_path);

postToGetWrapper(chat_path);
postToGetWrapper(group_path);
//postToGetWrapper(channel_path);

postToGetWrapper(search_all_path);
postToGetWrapper(search_users_path);

postToGetWrapper(join_group_path);

postToGetWrapper(join_comms_path);
postToGetWrapper(leave_comms_path);

postToGetWrapper(start_screen_share_path);
postToGetWrapper(stop_screen_share_path);

postToGetWrapper(comms_members_path);

// Middleware per gestire richieste a endpoints non esistenti
api.all("*", (req, res) => {
  const code = 404;
  const errorDescription = "Not found";

  const jsonResponse = { error_message: errorDescription };

  res.status(code).json(jsonResponse);

  error(
    req.path,
    "RESPONSE",
    `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code,
    JSON.stringify(jsonResponse)
  );
});

module.exports = api;
