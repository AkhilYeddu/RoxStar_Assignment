import mongoose from 'mongoose';

const RoomMemberSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true
    },
    socketId: {
      type: String,
      default: null
    },
    isOwner: {
      type: Boolean,
      default: false
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isOnline: {
      type: Boolean,
      default: true
    },
    virtualPoints: {
      type: Number,
      default: 100
    }
  },
  { _id: true }
);

const ActiveDraftSchema = new mongoose.Schema(
  {
    draftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Draft',
      default: null
    },
    title: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    effectApplied: { type: String, default: 'none' },
    waveformPeaks: { type: [Number], default: [] },
    sharedBy: { type: String, default: '' },
    sharedAt: { type: Date, default: null }
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [60, 'Room name cannot exceed 60 characters']
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    owner: {
      username: { type: String, required: true },
      socketId: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true
    },
    members: {
      type: [RoomMemberSchema],
      default: []
    },
    activeDraft: {
      type: ActiveDraftSchema,
      default: () => ({})
    },
    spinState: {
      status: {
        type: String,
        enum: ['WAITING', 'RUNNING', 'COMPLETED', 'ABORTED'],
        default: 'WAITING'
      },
      currentSpinId: { type: String, default: null },
      winner: { type: String, default: null }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export const Room = mongoose.model('Room', RoomSchema);
