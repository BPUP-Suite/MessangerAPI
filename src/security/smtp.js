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

  // Send mail with defined transport object
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendEmail,
};
