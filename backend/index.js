require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// More robust Firebase initialization
function initializeFirebase() {
  try {
    const serviceAccountPath = path.join(__dirname, 'weatherstation-474f2-firebase-adminsdk-qfjdp-34e17889e5.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account key file not found');
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://weatherstation-474f2-default-rtdb.asia-southeast1.firebasedatabase.app/'
    });

    console.log('Firebase initialized successfully');
    return admin.database();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

// Async function to send emails to all registered users
async function sendEmailToAllUsers(subject, message) {
  try {
    // Get a list of users from Firebase Authentication
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users;

    // Filter out users without emails
    const usersWithEmails = users.filter(user => user.email);

    if (usersWithEmails.length === 0) {
      console.log('No users with email addresses found');
      return;
    }

    // Nodemailer transport setup with environment variables
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Loop through the users and send the email to each
    const emailPromises = usersWithEmails.map(async (userRecord) => {
      const userEmail = userRecord.email;
      const mailOptions = {
        from: `Weather Station Alert <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: subject,
        text: message,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${userEmail}:`, info.response);
      } catch (emailError) {
        console.error(`Error sending email to ${userEmail}:`, emailError);
      }
    });

    // Wait for all email sending promises to resolve
    await Promise.all(emailPromises);

  } catch (error) {
    console.error('Error fetching user list or sending emails:', error);
  }
}

// Initialize the app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Initialize database with error handling
let db;
try {
  db = initializeFirebase();
} catch (error) {
  console.error('Failed to initialize Firebase. Server cannot start.');
  process.exit(1);
}

// Time in milliseconds (2 minutes to prevent rapid successive emails)
const RATE_LIMIT_TIME = 2 * 60 * 1000; 

// WeatherDataManager class to manage data and trigger email alerts
class WeatherDataManager {
  constructor() {
    this.weatherData = [];
    this.dataCounter = 0;
    this.historicalRef = db.ref('weather_history');
    this.currentWeatherRef = db.ref('weather_now');
    this.lastEmailSentTime = 0;
    this.conditionFlags = {};
  }

  async addData(data) {
    this.dataCounter += 1;

    // Add a timestamp to the data
    const dataWithTimestamp = {
      ...data,
      timestamp: Date.now(),
    };

    // Store the most recent data point
    this.weatherData = [dataWithTimestamp];

    // Store historical data
    if (this.dataCounter === 10000) {
      try {
        await this.historicalRef.push(dataWithTimestamp);
        console.log('10000th data point pushed to weather_history:', dataWithTimestamp);
        this.dataCounter = 0;
      } catch (error) {
        console.error('Error storing data in weather_history:', error);
      }
    }

    // Push data to weather_now every 300th data point
    if (this.dataCounter % 300 === 0) {
      try {
        await this.currentWeatherRef.push(dataWithTimestamp);
        console.log('300th data point pushed to weather_now:', dataWithTimestamp);
      } catch (error) {
        console.error('Error storing data in weather_now:', error);
      }
    }

    // Trigger email alerts if conditions meet the thresholds
    this.checkWeatherConditionsAndSendAlerts(dataWithTimestamp);
  }

  checkWeatherConditionsAndSendAlerts(data) {
    const { temperature, rain, pressure, light } = data;
    const currentTime = Date.now();
  
    // Reset ALL flags and last email time after 1 minute
    if (currentTime - this.lastEmailSentTime > 1 * 60 * 1000) {
      this.conditionFlags = {};
      this.lastEmailSentTime = 0;
    }


   // High Temperature Alert
   if (temperature > 40) {
    if (!this.conditionFlags['highTemperature']) {
      sendEmailToAllUsers('🔥 Extreme Heatwave Incoming! 🔥', 
        `🚨 ALERT: The temperature has skyrocketed to a scorching ${temperature}°C! 🌡️ It's dangerously hot out there! Stay cool, stay safe! 💦`
      );
      this.lastEmailSentTime = currentTime;
      this.conditionFlags['highTemperature'] = true;
    }
  }

  // Heavy Rain Alert
  if (rain > 750) {
    if (!this.conditionFlags['heavyRain']) {
      sendEmailToAllUsers('🌧️ Monsoon Madness: Heavy Rainfall Alert! 🌧️', 
        `🌪️ RAIN ALERT: A downpour is upon us with ${rain}mm of rainfall! ⚡ Get ready for some serious rain! 🌧️ Stay indoors and keep dry! 🏠`
      );
      this.lastEmailSentTime = currentTime;
      this.conditionFlags['heavyRain'] = true;
    }
  }

  // Low Pressure Alert
  if (pressure < 980) {
    if (!this.conditionFlags['lowPressure']) {
      sendEmailToAllUsers('🌪️ Storm Brewing: Low Pressure Alert! 🌪️', 
        `⚠️ WARNING: The atmospheric pressure has dropped to a dangerous ${pressure} hPa! ⛈️ A storm may be approaching—brace yourselves for impact! 🌩️`
      );
      this.lastEmailSentTime = currentTime;
      this.conditionFlags['lowPressure'] = true;
    }
  }

  // Light Condition Alert
  // For very bright conditions (high light value)
  if (light > 950) {
    if (!this.conditionFlags['brightConditions']) {
      sendEmailToAllUsers('☀️ Extremely Bright Conditions Alert! ☀️',           
        `🚨 NOTICE: Extremely high light detected (Light Value: ${light})! 🌞 It might be direct sunlight or very bright environment. Be cautious of potential sun exposure! 🕶️`
      );
      this.lastEmailSentTime = currentTime;
      this.conditionFlags['brightConditions'] = true;
    }
  }

   // For very dark conditions ( light value)
  if (light < 120) {
    if (!this.conditionFlags['darkConditions']) {
      sendEmailToAllUsers('🌑 Extremely Dark Conditions Alert! 🌑', 
        `🚨 NOTICE: Extremely low light detected (Light Value: ${light})! 🔦 It might be nighttime or heavy cloud cover. Take necessary precautions! 🌚`
      );
      this.lastEmailSentTime = currentTime;
      this.conditionFlags['darkConditions'] = true;
    }
  }
}

  async getHistoricalData(options = {}) {
    const { limit = 50, startTime = null, endTime = null } = options;

    try {
      let query = this.historicalRef.orderByChild('timestamp');

      // Apply start and end time filters if provided
      if (startTime && endTime) {
        query = query.startAt(startTime).endAt(endTime);
      }

      const snapshot = await query.limitToLast(limit).once('value');
      const data = snapshot.val();

      return data ? Object.values(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit) : [];
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  getLatestData() {
    return this.weatherData;
  }
}

// Create a singleton instance of WeatherDataManager
const weatherDataManager = new WeatherDataManager();

// POST route to accept data from the ESP8266
app.post('/api/weather', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received data:', data);

    // Store the data using the WeatherDataManager
    await weatherDataManager.addData(data);

    res.status(200).send('Data received');
  } catch (error) {
    console.error('Error processing weather data:', error);
    res.status(500).send('Error processing data');
  }
});

// GET route to retrieve the latest weather data
app.get('/api/weather', (req, res) => {
  console.log('GET /api/weather endpoint was hit');
  const latestData = weatherDataManager.getLatestData();
  res.json(latestData);
});

// New GET route to retrieve historical weather data
app.get('/api/weather/history', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : null;
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : null;

    const historicalData = await weatherDataManager.getHistoricalData({
      limit,
      startTime,
      endTime
    });

    res.json(historicalData);
  } catch (error) {
    console.error('Error retrieving historical data:', error);
    res.status(500).json({ error: 'Failed to retrieve historical data' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server.');
  server.close(() => {
    console.log('HTTP server closed.');
    // Close Firebase connection if needed
    admin.app().delete();
    process.exit(0);
  });
});

module.exports = app;