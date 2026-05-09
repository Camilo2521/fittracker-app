/**
 * FitTracker — Frontend Configuration
 * Modify this file to change API endpoints per environment.
 */
const AppConfig = Object.freeze({

  api: {
    // Web browser
    baseUrl: 'http://localhost:3000/api/v1',

    // Android emulator / physical device (LAN IP of the PC running the backend)
    deviceUrl: 'http://192.168.80.12:3000/api/v1',

    timeout: 10000,   // ms
  },

  app: {
    name:    'FitTracker',
    version: '3.0.0',
  },

});
