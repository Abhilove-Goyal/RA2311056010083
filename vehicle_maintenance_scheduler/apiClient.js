// apiClient.js - Fetches data from the protected evaluation-service APIs
const axios = require('axios');

const BASE_URL = process.env.EVAL_SERVICE_BASE || 'http://20.207.122.201/evaluation-service';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch all depots (each with ID and MechanicHours budget)
 * GET /evaluation-service/depots
 */
async function fetchDepots() {
  const response = await client.get('/depots');
  return response.data.depots; // array of { ID, MechanicHours }
}

/**
 * Fetch all vehicles/tasks (each with TaskID, Duration, Impact)
 * GET /evaluation-service/vehicles
 */
async function fetchVehicles() {
  const response = await client.get('/vehicles');
  return response.data.vehicles; // array of { TaskID, Duration, Impact }
}

module.exports = { fetchDepots, fetchVehicles };
