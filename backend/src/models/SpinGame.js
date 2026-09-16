import mongoose from 'mongoose';

const EliminationSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    eliminatedAt: { type: Date, default: Date.now },
    eliminationOrder: { type: Number, required: true } // 1 = first eliminated
  },
  { _id: false }
);

const SpinGameSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    roomName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['WAITING', 'RUNNING', 'COMPLETED', 'ABORTED'],
      default: 'WAITING',
      index: true
    },
    startedBy: { type: String, required: true }, // owner username
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    initialPlayers: {
      type: [String], // list of usernames at game start
      default: []
    },
    eliminations: {
      type: [EliminationSchema],
      default: []
    },
    winner: {
      type: String, // username
      default: null
    },
    pointsAwarded: {
      type: Number,
      default: 0
    },
    // Deterministic seed for audit reproducibility
    seed: {
      type: Number,
      default: () => Math.floor(Math.random() * 1_000_000)
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

export const SpinGame = mongoose.model('SpinGame', SpinGameSchema);
