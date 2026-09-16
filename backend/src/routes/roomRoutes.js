import { Router } from 'express';
import {
  createRoom,
  getRooms,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  shareDraftToRoom,
  startSpin,
  getRoomSpinState,
  getRoomSpinHistory
} from '../controllers/roomController.js';

const router = Router();

// Room collection endpoints
router.post('/', createRoom);
router.get('/', getRooms);

// Specific room endpoints by room code
router.get('/:code', getRoomDetails);
router.post('/:code/join', joinRoom);
router.post('/:code/leave', leaveRoom);
router.post('/:code/share-draft', shareDraftToRoom);

// Spin Wheel endpoints (Phase 3 - Section D1)
router.post('/:code/spin/start', startSpin);
router.get('/:code/spin', getRoomSpinState);
router.get('/:code/spin/history', getRoomSpinHistory);

export default router;
