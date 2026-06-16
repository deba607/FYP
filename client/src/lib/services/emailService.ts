import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { buildTicketQrPayload } from '../ticketQr';

export type BookingInfo = {
  bookingId: string;
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: string;
  numberOfTickets: number;
  visitorType: string;
  totalAmount: number;
  museumName?: string | null;
  museumLocation?: string | null;
  museumCategory?: string | null;
  museumId?: string | null;
  pricePerTicket?: number;
  visitorCombo?: Record<string, number> | null;
  gender?: string | null;
  age?: number | null;
  userLocation?: string | null;
  paymentStatus?: string;
  status?: string;
  createdAt?: string;
  purchaseDateTime?: string;
};

const TICKET_PRICES = {
  Adult: 200,
  Child: 100,
  'Senior Citizen': 150,
  Student: 120,
  Professor: 180,
  'Researcher/Scientist': 180
} as const;

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    // Check for GMAIL_USER and GMAIL_PASS first
    let user = process.env.GMAIL_USER || process.env.SMTP_USER;
    let pass = process.env.GMAIL_PASS || process.env.SMTP_PASS;
    let host = process.env.SMTP_HOST;
    let port = Number(process.env.SMTP_PORT) || 587;

    // Clean credentials if they exist
    if (user) user = user.trim();
    if (pass) pass = pass.trim().replace(/\s+/g, '');

    // If GMAIL_USER is provided, default to Gmail SMTP
    if (process.env.GMAIL_USER) {
      host = 'smtp.gmail.com';
      port = 587;
    }

    if (host && user && pass) {
      console.log(`Using SMTP configuration: ${host}:${port} with user: ${user}`);
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    }

    console.log('No SMTP configured. Creating simulated Ethereal Email test account...');
    const testAccount = await nodemailer.createTestAccount();
    console.log(`Ethereal Email account created: ${testAccount.user}`);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  })();

  return transporterPromise;
}


export async function sendBookingConfirmationEmail(booking: BookingInfo) {
  try {
    const transporter = await getTransporter();
    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@bharatmuseums.gov.in';
    const toEmail = booking.email?.trim();

    if (!toEmail) {
      console.warn('Booking confirmation email skipped: No recipient email address provided.');
      return;
    }

    const museumName = booking.museumName || 'Bharat Museum';
    const museumLocation = booking.museumLocation || '';
    const museumDisplay = museumLocation ? `${museumName} (${museumLocation})` : museumName;
    const qrDataUrl = await QRCode.toDataURL(buildTicketQrPayload(booking), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    const qrBase64 = qrDataUrl.split(',')[1] || '';
    const qrCid = `ticket-qr-${booking.bookingId}@bharat-museum`;

    // Premium designed HTML receipt template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
  <style>
    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f19;
      color: #f3f4f6;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      background: linear-gradient(90deg, #d97706 0%, #b45309 100%);
      padding: 30px 20px;
      text-align: center;
      border-bottom: 2px solid #f59e0b;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #ffffff;
      margin: 0;
      text-transform: uppercase;
    }
    .tagline {
      font-size: 13px;
      color: #fef3c7;
      margin: 5px 0 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px 25px;
    }
    .confirmation-banner {
      background-color: rgba(16, 185, 129, 0.1);
      border: 1px solid #10b981;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 25px;
      text-align: center;
    }
    .confirmation-text {
      color: #34d399;
      font-weight: 600;
      font-size: 16px;
      margin: 0;
    }
    .section-title {
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9ca3af;
      margin-top: 0;
      margin-bottom: 15px;
      border-left: 3px solid #d97706;
      padding-left: 8px;
    }
    .booking-id-block {
      background-color: #1e293b;
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 25px;
      text-align: center;
      border: 1px dashed #475569;
    }
    .booking-id-label {
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .booking-id-value {
      font-size: 22px;
      font-weight: 700;
      color: #fbbf24;
      margin-top: 5px;
      letter-spacing: 0.5px;
    }
    .qr-block {
      background-color: #ffffff;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 25px;
      text-align: center;
      border: 1px solid #334155;
    }
    .qr-block img {
      width: 260px;
      height: 260px;
      display: block;
      margin: 0 auto;
    }
    .qr-caption {
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    .detail-grid {
      width: 100%;
      margin-bottom: 25px;
      border-collapse: collapse;
    }
    .detail-grid td {
      padding: 10px 0;
      border-bottom: 1px solid #1e293b;
    }
    .detail-label {
      font-size: 13px;
      color: #9ca3af;
      width: 30%;
    }
    .detail-value {
      font-size: 14px;
      color: #f3f4f6;
      font-weight: 500;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      background-color: rgba(30, 41, 59, 0.4);
      border-radius: 10px;
      overflow: hidden;
    }
    .receipt-table th {
      background-color: #1e293b;
      color: #9ca3af;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      padding: 12px 15px;
      letter-spacing: 0.5px;
    }
    .receipt-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #1e293b;
      font-size: 14px;
      color: #f3f4f6;
    }
    .receipt-total-row {
      background-color: rgba(217, 119, 6, 0.1);
    }
    .receipt-total-row td {
      font-weight: 700;
      color: #fbbf24;
      border-bottom: none;
    }
    .guidelines {
      background-color: #1e293b;
      border-radius: 12px;
      padding: 20px;
      margin-top: 30px;
      border: 1px solid #334155;
    }
    .guidelines h4 {
      margin: 0 0 10px 0;
      color: #fbbf24;
      font-size: 14px;
      font-weight: 600;
    }
    .guidelines ul {
      margin: 0;
      padding-left: 20px;
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.6;
    }
    .guidelines li {
      margin-bottom: 8px;
    }
    .footer {
      text-align: center;
      padding: 30px 20px;
      border-top: 1px solid #1e293b;
      background-color: #0b0f19;
    }
    .footer p {
      font-size: 11px;
      color: #4b5563;
      margin: 5px 0;
    }
    .footer a {
      color: #d97706;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="logo-text">Bharat Museum</h1>
        <p class="tagline">Ticketing & Reservation Confirmation</p>
      </div>

      <div class="content">
        <div class="confirmation-banner">
          <p class="confirmation-text">🎉 Ticket Reservation Confirmed!</p>
        </div>

        <div class="booking-id-block">
          <div class="booking-id-label">Your Booking ID</div>
          <div class="booking-id-value">${booking.bookingId}</div>
        </div>

        <div class="qr-block">
          <img src="cid:${qrCid}" alt="QR code for booking ${booking.bookingId}" />
          <div class="qr-caption">Scan this QR code at the museum gate</div>
        </div>

        <h3 class="section-title">Visitor Details</h3>
        <table class="detail-grid">
          <tr>
            <td class="detail-label">Name</td>
            <td class="detail-value">${booking.name}</td>
          </tr>
          <tr>
            <td class="detail-label">Email</td>
            <td class="detail-value">${booking.email}</td>
          </tr>
          <tr>
            <td class="detail-label">Phone</td>
            <td class="detail-value">${booking.phone}</td>
          </tr>
        </table>

        <h3 class="section-title">Reservation Info</h3>
        <table class="detail-grid">
          <tr>
            <td class="detail-label">Museum</td>
            <td class="detail-value">${museumDisplay}</td>
          </tr>
          <tr>
            <td class="detail-label">Visit Date</td>
            <td class="detail-value">${booking.visitDate}</td>
          </tr>
          <tr>
            <td class="detail-label">Time Slot</td>
            <td class="detail-value">${booking.timeSlot}</td>
          </tr>
        </table>

        <h3 class="section-title">Payment Breakdown</h3>
        <table class="receipt-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${booking.visitorCombo && Object.keys(booking.visitorCombo).length > 0 
              ? Object.entries(booking.visitorCombo)
                  .filter(([_, count]) => count > 0)
                  .map(([vType, count]) => {
                    const price = TICKET_PRICES[vType as keyof typeof TICKET_PRICES] || booking.pricePerTicket || 200;
                    return `
                    <tr>
                      <td>${vType} Ticket</td>
                      <td style="text-align: center;">${count}</td>
                      <td style="text-align: right;">₹${price}</td>
                      <td style="text-align: right;">₹${price * count}</td>
                    </tr>`;
                  }).join('')
              : `
              <tr>
                <td>${booking.visitorType} Ticket</td>
                <td style="text-align: center;">${booking.numberOfTickets}</td>
                <td style="text-align: right;">₹${booking.pricePerTicket ?? 200}</td>
                <td style="text-align: right;">₹${(booking.pricePerTicket ?? 200) * booking.numberOfTickets}</td>
              </tr>`
            }
            <tr class="receipt-total-row">
              <td colspan="2">Amount Paid</td>
              <td colspan="2" style="text-align: right;">₹${booking.totalAmount}</td>
            </tr>
          </tbody>
        </table>

        <div class="guidelines">
          <h4>📌 Important Visitor Guidelines</h4>
          <ul>
            <li><strong>Entry Verification:</strong> Please bring a digital or printed copy of this email containing your QR code and Booking ID.</li>
            <li><strong>Discounts Eligibility:</strong> If you booked under a student or senior citizen category, please present a valid ID card at the entrance gate.</li>
            <li><strong>Timeliness:</strong> We suggest arriving 15 minutes before your scheduled time slot to facilitate smooth validation.</li>
            <li><strong>Timing:</strong> General visiting hours are 9:00 AM to 6:00 PM. Museum is closed on Mondays.</li>
          </ul>
        </div>
      </div>

      <div class="footer">
        <p>&copy; 2026 Bharat Museum Tickets. All rights reserved.</p>
        <p>Questions? <a href="mailto:support@bharatmuseums.gov.in">Contact Support</a> or check our website FAQs.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"Bharat Museum Tickets" <${fromEmail}>`,
      to: toEmail,
      subject: `🎟️ Ticket Confirmed: ${museumName} - ID: ${booking.bookingId}`,
      text: `Your ticket booking has been confirmed!\n\nBooking ID / QR value: ${booking.bookingId}\nMuseum: ${museumDisplay}\nDate: ${booking.visitDate}\nTime: ${booking.timeSlot}\nTickets: ${booking.numberOfTickets} (${booking.visitorType})\nTotal Paid: ₹${booking.totalAmount}\n\nShow the QR code in this email or use the Booking ID at the gate.\n\nEnjoy your visit!`,
      html: htmlContent,
      attachments: qrBase64
        ? [
            {
              filename: `ticket-${booking.bookingId}-qr.png`,
              content: Buffer.from(qrBase64, 'base64'),
              cid: qrCid,
              contentType: 'image/png'
            }
          ]
        : []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Booking confirmation email sent to ${toEmail}. Message ID: ${info.messageId}`);

    const transportOptions = transporter.options as any;
    if (transportOptions && transportOptions.host === 'smtp.ethereal.email') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n===========================================================`);
      console.log(`📧 [Simulated Email Service]`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      console.log(`   Preview Link: ${previewUrl}`);
      console.log(`===========================================================\n`);
    }
  } catch (error) {
    console.error('Failed to send booking confirmation email:', (error as Error).message);
  }
}

export async function sendOtpEmail(email: string, otp: string, purpose: 'registration' | 'forgot_password') {
  try {
    const transporter = await getTransporter();
    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@bharatmuseums.gov.in';
    const toEmail = email.trim();

    if (!toEmail) {
      throw new Error('Recipient email address is required.');
    }

    const subject = purpose === 'registration' 
      ? 'Verification Code for Museum Supervisor Registration' 
      : 'Reset Password Verification Code - Bharat Museum';

    const purposeText = purpose === 'registration'
      ? 'verifying your email for museum supervisor registration'
      : 'resetting your account password';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 500px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      color: #059669;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 700;
      color: #059669;
      text-align: center;
      padding: 15px;
      background-color: #ecfdf5;
      border: 1px dashed #10b981;
      border-radius: 8px;
      letter-spacing: 4px;
      margin: 25px 0;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 15px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      margin-top: 30px;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Bharat Museum</div>
    </div>
    <div class="text">Hello,</div>
    <div class="text">You requested a verification code for <strong>${purposeText}</strong>.</div>
    <div class="text">Please enter the following one-time password (OTP) code to verify your identity:</div>
    <div class="otp-code">${otp}</div>
    <div class="text">This OTP code is valid for 5 minutes. If you did not request this, you can safely ignore this email.</div>
    <div class="footer">
      &copy; 2026 Bharat Museum Tickets. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"Bharat Museum Tickets" <${fromEmail}>`,
      to: toEmail,
      subject,
      text: `Your verification code is: ${otp}\n\nThis code is valid for 5 minutes.`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification OTP email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification OTP email:', (error as Error).message);
    throw error;
  }
}
