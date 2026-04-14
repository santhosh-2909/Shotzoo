import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendEmployeeIdEmail = async (
  email: string,
  fullName: string,
  employeeId: string
): Promise<boolean> => {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    return false;
  }
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your ShotZoo Employee ID',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome to ShotZoo!</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
              Hello <strong>${fullName}</strong>,
            </p>
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
              Your account has been successfully created. Here is your unique Employee ID:
            </p>
            <div style="background-color: #e8f5e9; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
              <p style="color: #2e7d32; font-size: 24px; font-weight: bold; margin: 0;">
                ${employeeId}
              </p>
            </div>
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
              You can use this Employee ID to log in to your account along with your registered email and password.
            </p>
            <p style="color: #999; font-size: 14px;">
              If you did not create this account, please contact support immediately.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              ShotZoo Employee Management System
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

export const sendOtpEmail = async (
  email: string,
  fullName: string,
  otp: string
): Promise<boolean> => {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your ShotZoo verification code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #333; margin-bottom: 20px;">Verification Code</h2>
            <p style="color: #666; font-size: 16px;">
              Hello <strong>${fullName || 'there'}</strong>,
            </p>
            <p style="color: #666; font-size: 16px;">
              Use this code to confirm a password reveal request on your ShotZoo profile:
            </p>
            <div style="background-color: #e8f5e9; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
              <p style="color: #2e7d32; font-size: 32px; letter-spacing: 8px; font-weight: bold; margin: 0;">
                ${otp}
              </p>
            </div>
            <p style="color: #666; font-size: 14px;">
              The code expires in 5 minutes. If you didn't request this, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};
