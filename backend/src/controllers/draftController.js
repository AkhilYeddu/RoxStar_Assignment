import { Draft } from '../models/Draft.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');

/**
 * @desc Create a new voice draft
 * @route POST /api/drafts
 */
export const createDraft = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }

    const {
      title,
      duration,
      effectApplied = 'none',
      effectParams,
      waveformPeaks,
      createdBy = 'Guest Artist'
    } = req.body;

    if (!title || !title.trim()) {
      // Clean up uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Draft title is required' });
    }

    let parsedEffectParams = {};
    if (effectParams) {
      try {
        parsedEffectParams = typeof effectParams === 'string' ? JSON.parse(effectParams) : effectParams;
      } catch {
        parsedEffectParams = {};
      }
    }

    let parsedWaveform = [];
    if (waveformPeaks) {
      try {
        parsedWaveform = typeof waveformPeaks === 'string' ? JSON.parse(waveformPeaks) : waveformPeaks;
      } catch {
        parsedWaveform = [];
      }
    }

    const draft = await Draft.create({
      title: title.trim(),
      fileName: req.file.filename,
      fileUrl: `/api/drafts/audio/${req.file.filename}`,
      mimeType: req.file.mimetype || 'audio/wav',
      duration: parseFloat(duration) || 0,
      fileSize: req.file.size,
      effectApplied,
      effectParams: parsedEffectParams,
      waveformPeaks: parsedWaveform,
      createdBy
    });

    res.status(201).json({
      success: true,
      message: 'Draft saved successfully',
      data: draft
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    next(err);
  }
};

/**
 * @desc Get all drafts with pagination & filter
 * @route GET /api/drafts
 */
export const getDrafts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.effect && req.query.effect !== 'all') {
      filter.effectApplied = req.query.effect;
    }
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: 'i' };
    }

    const [drafts, total] = await Promise.all([
      Draft.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Draft.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: drafts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get single draft by ID
 * @route GET /api/drafts/:id
 */
export const getDraftById = async (req, res, next) => {
  try {
    const draft = await Draft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }
    res.status(200).json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Stream audio file with HTTP Range support
 * @route GET /api/drafts/audio/:filename
 */
export const streamDraftAudio = async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Audio file not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.webm' ? 'audio/webm' : ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Delete a draft and its audio file
 * @route DELETE /api/drafts/:id
 */
export const deleteDraft = async (req, res, next) => {
  try {
    const draft = await Draft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    // Delete local file if it exists
    if (draft.fileName) {
      const filePath = path.join(uploadDir, draft.fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn(`[Draft] Could not delete file: ${unlinkErr.message}`);
        }
      }
    }

    await Draft.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Draft and associated audio deleted successfully',
      deletedId: req.params.id
    });
  } catch (err) {
    next(err);
  }
};
