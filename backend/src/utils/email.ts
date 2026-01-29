
interface EmailOptions {
    email: string;
    subject: string;
    message: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        console.log('⚠️  RESEND_API_KEY not found. Email would have been sent to:', options.email);
        console.log('Subject:', options.subject);
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
                to: options.email,
                subject: options.subject,
                html: options.message
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Resend API Error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Email sent successfully via Resend:', data.id);
    } catch (error) {
        console.error('Failed to send email via Resend:', error);
        throw error; // Re-throw to be handled by controller
    }
};

export default sendEmail;
