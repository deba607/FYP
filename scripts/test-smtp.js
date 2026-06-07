import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Read .env manually since dotenv might not be installed in dependencies
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

console.log('Testing SMTP connection with:');
console.log('Host:', env.SMTP_HOST);
console.log('Port:', env.SMTP_PORT);
console.log('User:', env.SMTP_USER);
console.log('Pass:', env.SMTP_PASS ? '********' : 'undefined');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT) || 587,
  secure: env.SMTP_PORT === '465',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

async function main() {
  try {
    await transporter.verify();
    console.log('SMTP Connection is VERIFIED and READY!');
    
    // Attempt sending a test email to self
    const info = await transporter.sendMail({
      from: `"Bharat Museum Tickets" <${env.SMTP_FROM || env.SMTP_USER}>`,
      to: env.SMTP_USER,
      subject: '🎟️ SMTP Test Mail - Bharat Museum Tickets',
      text: 'This is a test email verifying that Bharat Museum Tickets SMTP setup is working correctly!'
    });
    console.log('Test email sent successfully! MessageId:', info.messageId);
  } catch (err) {
    console.error('SMTP test failed:', err);
  }
}

main();
