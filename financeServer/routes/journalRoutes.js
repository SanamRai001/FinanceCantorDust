import express      from 'express';
import multer       from 'multer';
import {
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  deleteJournalEntry
} from '../controllers/journalController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';
import { storage } from '../config/cloudinary.js';

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

router.route('/')
  .get(protect, getJournalEntries)
  .post(protect, allow('admin', 'accountant'),
    upload.single('attachment'), createJournalEntry);

router.route('/:id')
  .get(protect, getJournalEntryById)
  .delete(protect, allow('admin'), deleteJournalEntry);

export default router;