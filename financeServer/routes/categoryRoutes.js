import express from 'express';
import {
  getCategories,
  getSingleCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

const router = express.Router();

router.route('/')
  .get(protect, getCategories)
  .post(protect, allow('admin', 'accountant'), createCategory);

router.route('/:id')
  .get(protect, getSingleCategory)
  .put(protect, allow('admin', 'accountant'), updateCategory)
  .delete(protect, allow('admin'), deleteCategory);

export default router;