import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';

// ── GET all categories ────────────────────
export const getCategories = async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      // return categories matching type OR 'both'
      filter.$or = [
        { type: req.query.type },
        { type: 'both' }
      ];
    }

    if (req.query.group)   filter.group     = req.query.group;
    if (req.query.active !== 'false') filter.is_active = true;

    const categories = await Category.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      count:   categories.length,
      data:    categories
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single category ───────────────────
export const getSingleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error:   'Category not found'
      });
    }

    // count how many transactions use this category
    const txnCount = await Transaction.countDocuments({
      category: req.params.id
    });

    res.json({
      success: true,
      data:    category,
      txn_count: txnCount
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST create category ──────────────────
export const createCategory = async (req, res) => {
  try {
    const { name, type, group, description, color } = req.body;

    // check duplicate name
    const exists = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' }
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        error:   `Category "${name}" already exists`
      });
    }

    const category = await Category.create({
      name,
      type:        type        || 'both',
      group:       group       || 'general',
      description: description || null,
      color:       color       || '#2E5EA8'
    });

    res.status(201).json({ success: true, data: category });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── PUT update category ───────────────────
export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const allowed = ['name', 'type', 'group', 'description', 'color', 'is_active'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) category[field] = req.body[field];
    });

    await category.save();
    res.json({ success: true, data: category });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE category ───────────────────────
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // check if transactions use this category
    const txnCount = await Transaction.countDocuments({
      category: req.params.id
    });

    if (txnCount > 0) {
      // soft delete — keep for historical transactions
      category.is_active = false;
      await category.save();

      return res.json({
        success:      true,
        message:      `Category deactivated — ${txnCount} transaction(s) linked to it`,
        soft_deleted: true
      });
    }

    await category.deleteOne();

    res.json({
      success:      true,
      message:      'Category permanently deleted',
      soft_deleted: false
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};