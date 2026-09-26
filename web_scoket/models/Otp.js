import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
    {
        email: { type: String, required: true },
        name: { type: String, required: true },
        passwordHash: { type: String, required: true },
        otp: { type: String, required: true },
        expiresAt: { type: Date, required: true }
    },
    { timestamps: true }
);

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
