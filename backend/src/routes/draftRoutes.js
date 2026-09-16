import { Router } from 'express';
import { uploadAudio } from '../middlewares/upload.js';
import {
  createDraft,
  getDrafts,
  getDraftById,
  streamDraftAudio,
  deleteDraft
} from '../controllers/draftController.js';

const router = Router();

// Draft CRUD endpoints
router.post('/', uploadAudio.single('audio'), createDraft);
router.get('/', getDrafts);
router.get('/:id', getDraftById);
router.delete('/:id', deleteDraft);

// Direct audio streaming endpoint
router.get('/audio/:filename', streamDraftAudio);

export default router;
