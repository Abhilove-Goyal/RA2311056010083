// apiClient.js - Fetches notifications from the protected evaluation-service API
const axios = require('axios');

const BASE_URL = process.env.EVAL_SERVICE_BASE || 'http://20.207.122.201/evaluation-service';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch all notifications from the evaluation service.
 * GET /evaluation-service/notifications
 * Returns: [{ ID, Type, Message, Timestamp }]
 */
async function fetchNotifications() {
  const response = await client.get('/notifications');
  return response.data.notifications;
}

module.exports = { fetchNotifications };
