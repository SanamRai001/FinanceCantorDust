import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';

const userSchema = new mongoose.Schema({

  name: {
    type:     String,
    required: true,
    trim:     true
  },
  email: {
    type:      String,
    required:  true,
    unique:    true,
    trim:      true,
    lowercase: true
  },
  password: {
    type:      String,
    required:  true,
    minlength: 6
  },
  role: {
    type:    String,
    enum:    ['admin', 'accountant', 'viewer'],
    default: 'viewer'
  },
  is_active: {
    type:    Boolean,
    default: true
  }

}, { timestamps: true });

// hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// check password on login
userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);