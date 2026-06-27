import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import transactionRoutes from './routes/transactionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import authRoutes from './routes/authRoutes.js'
import protect from './middleware/auth.js'
import categoryRoutes from './routes/categoryRoutes.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();


// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/transactions', protect, transactionRoutes);
app.use('/api/reports', protect, reportRoutes);
app.use("/api/party", protect, partyRoutes);
app.use("/api/export", protect, exportRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/categories', protect,categoryRoutes);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));