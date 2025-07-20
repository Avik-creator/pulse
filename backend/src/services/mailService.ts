import nodemailer from "nodemailer";

export const sendServiceFailMail = async (email: string, cronJob: string) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_TO_BE_USED,
        pass: process.env.APP_SECRET_OF_EMAIL,
      },
      secure: false,
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Cronjob Failure Alert",
      text: "A cronjob has failed.",
      html: `<p><strong>Cronjob ${cronJob} has failed.</strong></p>
             <p>Try Disable and Re-enable the cronjob.It may resolve the issue.</p>
             <p style="font-style: italic;">This is an automatically generated email. Please do not reply.</p>`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(`Error sending mail to ${email} : `, err);
      } else {
        console.log(`Email sent to ${email} : `, info.response);
      }
    });
  } catch (err) {
    console.error("Error in nodemailer : ", err);
  }
};
