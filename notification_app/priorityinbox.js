// priorityInbox.js
// Stage 6: Priority Inbox
//
// Ranks notifications by a composite score:
//   score = typeWeight * recencyWeight
//
// Type weights (Placement > Result > Event):
//   Placement : 3
//   Result    : 2
//   Event     : 1
//
// Recency weight:
//   Calculated as 1 / (1 + ageInHours)
//   So notifications from 0 hours ago → weight 1.0
//                        from 1 hour ago  → weight 0.5
//                        from 24 hours ago → weight ~0.04
//
// The final score = typeWeight * recencyWeight
// This naturally gives Placements a 3× boost over Events at the same age.

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

/**
 * Compute priority score for a single notification.
 * @param {{ Type: string, Timestamp: string }} notification
 * @returns {number}
 */
function computeScore(notification) {
  const typeWeight = TYPE_WEIGHTS[notification.Type] ?? 1;
  const ageMs = Date.now() - new Date(notification.Timestamp).getTime();
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
  const recencyWeight = 1 / (1 + ageHours);
  return typeWeight * recencyWeight;
}

/**
 * Return the top-N priority notifications from a list.
 *
 * @param {Array<{ID, Type, Message, Timestamp}>} notifications
 * @param {number} n  - how many to return (default 10)
 * @returns {Array<{notification, score}>}
 */
function getPriorityInbox(notifications, n = 10) {
  const scored = notifications
    .filter((notif) => !notif.isRead) // only unread
    .map((notif) => ({
      ...notif,
      priorityScore: parseFloat(computeScore(notif).toFixed(4)),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, n);

  return scored;
}

/**
 * Efficiently maintain top-N as new notifications arrive.
 * Uses a min-heap concept: if the new notification's score is higher
 * than the lowest in the current top-N, replace it.
 *
 * @param {Array} currentTopN  - current priority inbox (already scored)
 * @param {Object} newNotif    - incoming notification
 * @param {number} n           - max inbox size
 */
function updatePriorityInbox(currentTopN, newNotif, n = 10) {
  const scored = { ...newNotif, priorityScore: parseFloat(computeScore(newNotif).toFixed(4)) };
  const updated = [...currentTopN, scored]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, n);
  return updated;
}

module.exports = { getPriorityInbox, updatePriorityInbox, computeScore, TYPE_WEIGHTS };
