import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      unique: true
    },
    avatar: {
      type: String,
      default: ''
    },
    points: {
      type: Number,
      default: 100 // initial virtual points for spin game!
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', UserSchema);
