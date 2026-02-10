const nodemailer = require("nodemailer");
const path = require("path");

const sendEmail = async ({
  from,
  to,
  subject,
  htmlContent,
  filePath = null,
}) => {
  const transporter = nodemailer.createTransport({
    host: "premium15.web-hosting.com",
    port: 465,
    secure: true,
    auth: {
      user: "ceo@eaconsultancy.info",
      pass: "EacEac2911%..",
    },
  });

  const mailOptions = {
    from: '"EA Consultancy" <ceo@eaconsultancy.info>',
    to: to,
    subject: subject,
    html: htmlContent,
    attachments: filePath
      ? [{ filename: path.basename(filePath), path: filePath }]
      : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (info.accepted.length > 0) {
      console.log("✅ Email successfully sent to:", info.accepted.join(", "));
      return true;
    } else {
      console.log("❌ Email sending failed.");
      return false;
    }
  } catch (error) {
    console.error("❌ Email error:", error);
    return false;
  }
};

module.exports = sendEmail;
