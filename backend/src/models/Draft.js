import mongoose from 'mongoose';

const DraftSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Draft title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      default: 'audio/wav'
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, 'Duration must be positive']
    },
    fileSize: {
      type: Number,
      default: 0
    },
    effectApplied: {
      type: String,
      enum: ['none', 'echo', 'reverb', 'pitch_shift', 'custom'],
      default: 'none'
    },
    effectParams: {
      echoDelay: { type: Number, default: 0.25 },
      echoFeedback: { type: Number, default: 0.4 },
      reverbRoomSize: { type: Number, default: 0.6 },
      pitchShiftSemitones: { type: Number, default: 0 }
    },
    waveformPeaks: {
      type: [Number],
      default: []
    },
    createdBy: {
      type: String,
      default: 'Guest Artist'
    },
    sharedToRoom: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for fast listing and sorting
DraftSchema.index({ createdAt: -1 });
DraftSchema.index({ createdBy: 1 });

export const Draft = mongoose.model('Draft', DraftSchema);
