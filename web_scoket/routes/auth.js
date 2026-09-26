// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import Otp from '../models/Otp.js';

const router = express.Router();

// ===== Mail Transporter =====
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper to generate JWT
function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Helper to generate 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/send-otp
 * Body: { name, email, password }
 */
router.post('/send-otp', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing fields' });
        }

        // check if user already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.json({
                success: false,
                message: 'User already exists. Please login.'
            });
        }

        // hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // generate OTP
        const otpValue = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        // remove old OTPs for this email
        await Otp.deleteMany({ email });

        // save new OTP
        await Otp.create({
            email,
            name,
            passwordHash,
            otp: otpValue,
            expiresAt
        });

        // send mail with fallback
        let emailSent = false;
        try {
            await transporter.sendMail({
                from: `"MedZoom AI" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Your MedZoom AI Signup OTP',
                text: `Your OTP for MedZoom AI signup is: ${otpValue}. It is valid for 10 minutes.`,
                html: `<p>Your OTP for <b>MedZoom AI</b> signup is:</p>
                 <h2>${otpValue}</h2>
                 <p>It is valid for 10 minutes.</p>`
            });
            emailSent = true;
            console.log(`📧 OTP email sent successfully to ${email}`);
        } catch (mailErr) {
            console.warn(`⚠️ Mail delivery failed (${mailErr.message || 'SMTP error'}). Check EMAIL_USER / EMAIL_PASS in .env.`);
            console.log(`\n=================================================`);
            console.log(`🔑 [DEV / FALLBACK OTP for ${email}]: ${otpValue}`);
            console.log(`=================================================\n`);
        }

        return res.json({
            success: true,
            message: emailSent
                ? 'OTP sent to your email.'
                : 'OTP generated. (Email delivery failed; check server console for OTP)',
            emailSent,
            devOtp: !emailSent ? otpValue : undefined
        });
    } catch (err) {
        console.error('send-otp error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 */
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.json({ success: false, message: 'Missing email or otp' });
        }

        const otpDoc = await Otp.findOne({ email }).sort({ createdAt: -1 });

        if (!otpDoc) {
            return res.json({
                success: false,
                message: 'No OTP found. Please generate again.'
            });
        }

        if (otpDoc.otp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }

        if (otpDoc.expiresAt < new Date()) {
            return res.json({
                success: false,
                message: 'OTP expired. Please generate again.'
            });
        }

        // create user
        const user = await User.create({
            name: otpDoc.name,
            email: otpDoc.email,
            passwordHash: otpDoc.passwordHash
        });

        // delete otp docs
        await Otp.deleteMany({ email });

        const token = generateToken(user);

        return res.json({
            success: true,
            message: 'OTP verified, signup complete',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('verify-otp error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({ success: false, message: 'Missing fields' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user);

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
