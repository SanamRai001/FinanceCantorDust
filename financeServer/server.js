import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import transactionRoutes from './routes/transactionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
dotenv.config();

const app = express();
import fs from 'fs';

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
// Connect to MongoDB
connectDB();


// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/export", exportRoutes);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));