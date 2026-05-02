// routes.js - Campus Notifications API routes
const express = require('express');
const router = express.Router();
const { fetchNotifications } = require('./apiClient');
const { getPriorityInbox } = require('./priorityInbox');

// ── GET /notifications ────────────────────────────────────────────
// Returns all notifications from the evaluation service
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await fetchNotifications();
    res.json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── GET /notifications/unread ─────────────────────────────────────
// Returns only unread notifications, sorted by Timestamp desc
router.get('/notifications/unread', async (req, res) => {
  try {
    const notifications = await fetchNotifications();
    const unread = notifications
      .filter((n) => !n.isRead)
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    res.json({ success: true, count: unread.length, notifications: unread });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── GET /notifications/priority ───────────────────────────────────
// Stage 6: Priority Inbox — top N unread notifications by composite score
// Query params: ?n=10 (default 10)
router.get('/notifications/priority', async (req, res) => {
  const n = Math.min(parseInt(req.query.n, 10) || 10, 50);
  try {
    const notifications = await fetchNotifications();
    const prioritized = getPriorityInbox(notifications, n);
    res.json({
      success: true,
      topN: n,
      count: prioritized.length,
      scoringExplained: {
        typeWeights: { Placement: 3, Result: 2, Event: 1 },
        recencyFormula: '1 / (1 + ageInHours)',
        finalScore: 'typeWeight × recencyWeight',
      },
      notifications: prioritized,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── GET /notifications/type/:type ────────────────────────────────
// Filter notifications by type: Placement | Result | Event
router.get('/notifications/type/:type', async (req, res) => {
  const allowedTypes = ['Placement', 'Result', 'Event'];
  const type = req.params.type;
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: `Invalid type. Must be one of: ${allowedTypes.join(', ')}`,
    });
  }
  try {
    const notifications = await fetchNotifications();
    const filtered = notifications
      .filter((n) => n.Type === type)
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    res.json({ success: true, type, count: filtered.length, notifications: filtered });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── GET /notifications/student/:studentId ───────────────────────
// Returns unread notifications for a specific student (by studentId)
// (In the real system, filtering is done server-side; here we simulate it)
router.get('/notifications/student/:studentId', async (req, res) => {
  const { studentId } = req.params;
  try {
    const notifications = await fetchNotifications();
    // Simulate: in production this would be DB filtered by studentID = req.params.studentId
    const unread = notifications
      .filter((n) => !n.isRead)
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    res.json({
      success: true,
      studentId,
      note: 'Showing all unread notifications (simulated for studentId)',
      count: unread.length,
      notifications: unread,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── GET /notifications/placement/recent ─────────────────────────
// Stage 3 query equivalent: students who got placement notifications in last 7 days
router.get('/notifications/placement/recent', async (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const notifications = await fetchNotifications();
    const recent = notifications.filter(
      (n) => n.Type === 'Placement' && new Date(n.Timestamp) >= cutoff
    );
    res.json({
      success: true,
      daysWindow: days,
      count: recent.length,
      notifications: recent,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// ── POST /notifications/notify-all ──────────────────────────────
// Stage 5: Bulk notification (simulated - shows redesigned reliable flow)
// Body: { message: string, type: "Placement"|"Result"|"Event", studentIds: string[] }
router.post('/notifications/notify-all', async (req, res) => {
  const { message, type, studentIds } = req.body;

  if (!message || !type || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({
      error: 'Required: message (string), type (string), studentIds (array)',
    });
  }

  // Simulated batch processing with error resilience
  const results = { sent: [], failed: [] };
  const batchSize = 100;

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    for (const studentId of batch) {
      try {
        // In production: send email + save to DB + push to app in parallel
        // Here we simulate: 95% success rate
        if (Math.random() > 0.05) {
          results.sent.push(studentId);
        } else {
          results.failed.push({ studentId, reason: 'Simulated transient failure' });
        }
      } catch (err) {
        results.failed.push({ studentId, reason: err.message });
      }
    }
  }

  res.json({
    success: true,
    message,
    type,
    totalStudents: studentIds.length,
    successCount: results.sent.length,
    failureCount: results.failed.length,
    failed: results.failed,
    note: 'In production: uses message queue (BullMQ/RabbitMQ) for guaranteed delivery. DB write and email/push are decoupled.',
  });
});

module.exports = router;
