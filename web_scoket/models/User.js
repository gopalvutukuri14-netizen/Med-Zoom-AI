import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        passwordHash: { type: String, required: true }
    },
    { timestamps: true }
);

// Create model
const User = mongoose.model('User', userSchema);

// Export the model DIRECTLY
export default User;
