import express from "express";
import Feedback from "../models/Feedback.ts";
import nodemailer from "nodemailer";

const router = express.Router();

function createTransporter() {
  const host = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : undefined
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined
  // remove non-breaking spaces that sometimes appear when copying passwords
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\u00A0/g, '').trim() : undefined

  if (!host || !port || !user || !pass) return null

  // Avoid attempting to send using obvious placeholder hosts
  if (host && (host.includes("example") || host.includes("placeholder"))) {
    console.warn('SMTP host is set to a placeholder value; skipping email sending')
    return null
  }

  if (user && !user.includes('@')) {
    console.warn('SMTP_USER does not look like an email address; providers may require full email as username')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: { user, pass },
  })

  return transporter
}

router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;
    const newFeedback = new Feedback({ firstName, lastName, email, message });
    await newFeedback.save();

    // send notification email (if configured)
    const transporter = createTransporter()
    if (transporter) {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_FROM,
        subject: `New feedback from ${firstName} ${lastName}`,
        text: `Name: ${firstName} ${lastName}\nEmail: ${email}\n\nMessage:\n${message}`,
      }

      try {
        // verify connection configuration first
        await transporter.verify()
        await transporter.sendMail(mailOptions)
      } catch (err: any) {
        console.error('Failed to send feedback notification email. SMTP host:', process.env.SMTP_HOST)
        console.error('Error:', err)
      }
    } else {
      console.info('Email transporter not configured; skipping notification email')
    }

    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;