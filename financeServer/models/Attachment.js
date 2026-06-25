import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({

  // which transaction this file belongs to
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },

  // original file name the user uploaded
  file_name: {
    type: String,
    required: true,
    trim: true
  },

  // path where multer saved the file on the server
  file_path: {
    type: String,
    required: true,
    trim: true
  },

  // file type — lets you show a PDF icon vs image icon in the UI
  file_type: {
    type: String,
    enum: ['pdf', 'jpg', 'jpeg', 'png', 'pdf'],
    required: true
  },

  // file size in bytes — lets you enforce 5MB limit
  file_size: {
    type: Number,
    required: true
  },

}, {
  timestamps: true
});

attachmentSchema.index({ transaction: 1 });

export default mongoose.model('Attachment', attachmentSchema);