// Adapted from server.js for Vercel serverless deployment
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const admin = require("firebase-admin");
require("../firebaseConfig");
const morgan = require('morgan');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Mongoose model for FCM tokens
const fcmTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true }
}, {
    timestamps: true
});
const FcmToken = mongoose.model('FcmToken', fcmTokenSchema);

// MongoDB connection function
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Do not use process.exit(1) in serverless
    // Instead, throw error to let the function fail naturally
    throw error;
  }
}

// Ensure DB connection on cold start
connectDB();

// Helper to get timestamp
function getTimestamp() {
  return new Date().toLocaleTimeString();
}

// Save FCM token endpoint
app.post("/saveToken", async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    console.log(`[${getTimestamp()}] No body received or body is not an object`);
    return res.status(400).json({ error: "No body received" });
  }
  const { token } = req.body;
  console.log(`[${getTimestamp()}] saveToken API triggered`);
  if (!token) {
    console.log(`[${getTimestamp()}] Token is required`);
    return res.status(400).json({ error: "Token is required"});
  }
  try {
    // Save token if not already present
    await FcmToken.updateOne(
      { token },
      { $setOnInsert: { token } },
      { upsert: true }
    );
    console.log(`[${getTimestamp()}] Token saved successfully`, token);
    res.json({ success: true, message: "Token saved" });
  } catch (err) {
    console.log(`[${getTimestamp()}] Failed to save token`, err);
    res.status(500).json({ error: "Failed to save token"});
  }
});

// Push notification endpoint
app.post("/push", async (req, res) => {
  // Default notification content
  const title = "Picklebay Notification";
  const body = "You have a new notification!";
  try {
    const tokens = await FcmToken.find().distinct("token");
    if (!tokens.length) {
      return res.status(404).json({ error: "No FCM tokens found" });
    }
    const message = {
      notification: { title, body },
      tokens
    };
    const response = await admin.messaging().sendMulticast(message);
    res.json({ success: true, response });
  } catch (err) {
    res.status(500).json({ error: "Failed to send notifications", details: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log(`[${getTimestamp()}] /health API triggered`);
  res.json({ status: 'ok' });
});

// For Vercel serverless
module.exports = app;

// For Render or local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} 