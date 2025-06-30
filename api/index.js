// Adapted from server.js for Vercel serverless deployment
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const admin = require("../firebaseConfig");
const morgan = require('morgan');
const cors = require('cors');
const Joi = require('joi');

const app = express();

// Middleware configuration - ORDER IS IMPORTANT
app.use(express.json());  // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded bodies
app.use(morgan('dev'));  // Logging
app.use(cors({ 
  origin: "*",
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Validation Schemas
const customNotificationSchema = Joi.object({
  title: Joi.string().required().trim().min(1).max(100)
    .messages({
      'string.empty': 'Title cannot be empty',
      'string.min': 'Title must be at least 1 character long',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required'
    }),
  body: Joi.string().required().trim().min(1).max(200)
    .messages({
      'string.empty': 'Body cannot be empty',
      'string.min': 'Body must be at least 1 character long',
      'string.max': 'Body cannot exceed 200 characters',
      'any.required': 'Body is required'
    })
});

const saveTokenSchema = Joi.object({
  token: Joi.string().required().trim().min(100).max(300)
    .pattern(/^[A-Za-z0-9:_-]+$/)
    .messages({
      'string.empty': 'FCM token cannot be empty',
      'string.min': 'FCM token must be at least 100 characters long',
      'string.max': 'FCM token cannot exceed 300 characters',
      'string.pattern.base': 'FCM token contains invalid characters',
      'any.required': 'FCM token is required'
    })
});

// Validation Middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{
          field: 'body',
          message: 'Request body must be a valid JSON object.'
        }]
      });
    }
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.context.key,
        message: detail.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    next();
  };
};

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
app.post("/saveToken", validateRequest(saveTokenSchema), async (req, res) => {
  const { token } = req.body;
  console.log(`[${getTimestamp()}] saveToken API triggered`);
  
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

// Static push notification endpoint
app.post("/push", async (req, res) => {
  try {
    const tokens = await FcmToken.find().distinct("token");
    if (!tokens.length) {
      return res.status(404).json({ error: "No FCM tokens found" });
    }

    const message = {
      tokens: tokens,
      notification: {
        title: "Picklebay Notification",
        body: "You have a new notification!"
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          color: "#FF4081"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1
          }
        }
      }
    };

    console.log(`[${getTimestamp()}] Sending static notification to ${tokens.length} devices`);
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Cleanup invalid tokens
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
        "messaging/invalid-argument",
        "messaging/invalid-recipient"
      ].includes(resp.error?.code)) {
        console.log(`[${getTimestamp()}] Removing invalid token: ${tokens[idx]} - Reason: ${resp.error?.code}`);
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length) {
      await FcmToken.deleteMany({ token: { $in: invalidTokens } });
      console.log(`[${getTimestamp()}] Removed ${invalidTokens.length} invalid tokens from DB`);
    }

    console.log(`[${getTimestamp()}] Static notification sent:`, {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    res.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
      invalidTokensRemoved: invalidTokens.length
    });
  } catch (err) {
    console.error(`[${getTimestamp()}] Failed to send static notifications:`, err);
    res.status(500).json({ error: "Failed to send notifications", details: err.message });
  }
});

// Custom push notification endpoint with validation
app.post("/push/custom", validateRequest(customNotificationSchema), async (req, res) => {
  const { title, body } = req.body;

  try {
    const tokens = await FcmToken.find().distinct("token");
    if (!tokens.length) {
      return res.status(404).json({ error: "No FCM tokens found" });
    }

    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          color: "#FF4081"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1
          }
        }
      }
    };

    console.log(`[${getTimestamp()}] Sending custom notification to ${tokens.length} devices:`, { title, body });
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Cleanup invalid tokens
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
        "messaging/invalid-argument",
        "messaging/invalid-recipient"
      ].includes(resp.error?.code)) {
        console.log(`[${getTimestamp()}] Removing invalid token: ${tokens[idx]} - Reason: ${resp.error?.code}`);
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length) {
      await FcmToken.deleteMany({ token: { $in: invalidTokens } });
      console.log(`[${getTimestamp()}] Removed ${invalidTokens.length} invalid tokens from DB`);
    }

    console.log(`[${getTimestamp()}] Custom notification sent:`, {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    res.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
      invalidTokensRemoved: invalidTokens.length
    });
  } catch (err) {
    console.error(`[${getTimestamp()}] Failed to send custom notifications:`, err);
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