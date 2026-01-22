import nodemailer from 'nodemailer';

interface EmailOptions {
    email: string;
    subject: string;
    message: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
    // 1) Create a transporter
    // In production, use standard SMTP services (SendGrid, Mailgun, Gmail, etc.)
    // In development, you can use Mailtrap or just log if no creds

    if (!process.env.SMTP_HOST || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
        console.log('⚠️  SMTP Credentials not found. Email would have been sent to:', options.email);
        console.log('Subject:', options.subject);
        console.log('Message:', options.message);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    // 2) Define the email options
    const mailOptions = {
        from: `${process.env.FROM_NAME || 'NexCatalog'} <${process.env.FROM_EMAIL || 'noreply@nexcatalog.com'}>`,
        to: options.email,
        subject: options.subject,
        html: options.message, // We will send HTML
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

export default sendEmail;
