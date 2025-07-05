const {
  api_log: log,
  api_debug: debug,
  api_warn: warn,
  api_error: error,
  api_info: info,
} = require("../logger");

function sendEmail(to, subject, text) {
  const nodemailer = require("nodemailer");
  const envManager = require("../security/envManager");

  // Create a transporter object using SMTP
  const transporter = nodemailer.createTransport({
    host: envManager.readSMTPServer(),
    port: envManager.readSMTPPort(),
    secure: envManager.readSMTPPort() === "465", // true for port 465, false for other ports
    auth: {
      user: envManager.readSMTPUser(),
      pass: envManager.readSMTPPassword(),
    },
  });

  // Set up email data
  const mailOptions = {
    from: envManager.readSMTPUser(), // sender address
    to: to, // list of receivers
    subject: subject, // Subject line
    text: text, // plain text body
  };

  debug(
    "SMTP",
    `Sending email to ${to} with subject "${subject}" and text "${text}"`,
    "sendEmail",
    "Email sending initiated",
    null,
    null,
  );

  // Send mail with defined transport object
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendEmail,
};
