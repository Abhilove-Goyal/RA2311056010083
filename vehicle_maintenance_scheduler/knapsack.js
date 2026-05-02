// knapsack.js
// 0/1 Knapsack solver using bottom-up Dynamic Programming.
//
// Problem mapping:
//   items    → vehicles/tasks
//   weight   → Duration (hours)
//   value    → Impact (importance score)
//   capacity → MechanicHours budget for the depot
//
// Time  complexity: O(n × W)
// Space complexity: O(n × W)  — could be optimised to O(W) with 1-D DP
//                               but we keep 2-D to enable backtracking.

/**
 * Solve the 0/1 knapsack problem.
 *
 * @param {Array<{TaskID: string, Duration: number, Impact: number}>} items
 * @param {number} capacity  - Maximum total Duration allowed
 * @returns {{
 *   selectedTasks: Array<{TaskID, Duration, Impact}>,
 *   totalImpact: number,
 *   totalDuration: number
 * }}
 */
function knapsack(items, capacity) {
  const n = items.length;

  if (n === 0 || capacity <= 0) {
    return { selectedTasks: [], totalImpact: 0, totalDuration: 0 };
  }

  // ── Build DP table ──────────────────────────────────────────────
  // dp[i][w] = max impact using first i items with capacity w
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration: weight, Impact: value } = items[i - 1];
    for (let w = 0; w <= capacity; w++) {
      // Don't take item i-1
      dp[i][w] = dp[i - 1][w];
      // Take item i-1 if it fits and improves the score
      if (weight <= w) {
        const withItem = dp[i - 1][w - weight] + value;
        if (withItem > dp[i][w]) {
          dp[i][w] = withItem;
        }
      }
    }
  }

  // ── Backtrack to find which items were selected ─────────────────
  const selectedTasks = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(items[i - 1]);
      w -= items[i - 1].Duration;
    }
  }

  const totalImpact = dp[n][capacity];
  const totalDuration = selectedTasks.reduce((sum, t) => sum + t.Duration, 0);

  return {
    selectedTasks: selectedTasks.reverse(), // restore original order
    totalImpact,
    totalDuration,
  };
}

/**
 * Greedy approximation using Impact/Duration ratio.
 * O(n log n) — useful as a fast sanity-check / comparison.
 *
 * @param {Array<{TaskID, Duration, Impact}>} items
 * @param {number} capacity
 */
function greedyKnapsack(items, capacity) {
  const sorted = [...items].sort((a, b) => b.Impact / b.Duration - a.Impact / a.Duration);
  let remaining = capacity;
  const selected = [];

  for (const item of sorted) {
    if (item.Duration <= remaining) {
      selected.push(item);
      remaining -= item.Duration;
    }
  }

  return {
    selectedTasks: selected,
    totalImpact: selected.reduce((s, t) => s + t.Impact, 0),
    totalDuration: selected.reduce((s, t) => s + t.Duration, 0),
  };
}

module.exports = { knapsack, greedyKnapsack };
