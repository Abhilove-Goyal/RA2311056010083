// routes.js - Express routes for Vehicle Maintenance Scheduler
const express = require('express');
const router = express.Router();
const { fetchDepots, fetchVehicles } = require('./apiClient');
const { knapsack, greedyKnapsack } = require('./knapsack');

/**
 * GET /schedule
 * Fetches all depots and vehicles from the evaluation service,
 * then runs the 0/1 knapsack DP for each depot independently.
 *
 * Query params:
 *   ?mode=dp|greedy   (default: dp)
 *   ?depot=<id>       (optional: run for a single depot only)
 */
router.get('/schedule', async (req, res) => {
  const mode = req.query.mode === 'greedy' ? 'greedy' : 'dp';
  const depotFilter = req.query.depot ? parseInt(req.query.depot, 10) : null;

  let depots, vehicles;
  try {
    [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to fetch data from evaluation service',
      detail: err.message,
    });
  }

  const filteredDepots = depotFilter
    ? depots.filter((d) => d.ID === depotFilter)
    : depots;

  if (filteredDepots.length === 0) {
    return res.status(404).json({ error: `Depot ID ${depotFilter} not found` });
  }

  const solve = mode === 'greedy' ? greedyKnapsack : knapsack;

  const results = filteredDepots.map((depot) => {
    const { selectedTasks, totalImpact, totalDuration } = solve(
      vehicles,
      depot.MechanicHours
    );
    return {
      depotId: depot.ID,
      mechanicHoursBudget: depot.MechanicHours,
      algorithm: mode === 'dp' ? '0/1 Knapsack (DP)' : 'Greedy (Impact/Duration ratio)',
      totalTasksConsidered: vehicles.length,
      tasksScheduled: selectedTasks.length,
      totalDurationUsed: totalDuration,
      remainingHours: depot.MechanicHours - totalDuration,
      totalImpactScore: totalImpact,
      scheduledTasks: selectedTasks,
    };
  });

  res.json({
    success: true,
    mode,
    scheduledAt: new Date().toISOString(),
    depots: results,
  });
});

/**
 * GET /depots
 * Proxy: returns raw depots from evaluation service
 */
router.get('/depots', async (req, res) => {
  try {
    const depots = await fetchDepots();
    res.json({ depots });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch depots', detail: err.message });
  }
});

/**
 * GET /vehicles
 * Proxy: returns raw vehicles/tasks from evaluation service
 */
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await fetchVehicles();
    res.json({ vehicles });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch vehicles', detail: err.message });
  }
});

/**
 * POST /schedule/custom
 * Body: { tasks: [{TaskID, Duration, Impact}], capacityHours: number }
 * Allows ad-hoc scheduling without calling external APIs.
 */
router.post('/schedule/custom', (req, res) => {
  const { tasks, capacityHours, mode } = req.body;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: '"tasks" must be a non-empty array' });
  }
  if (typeof capacityHours !== 'number' || capacityHours <= 0) {
    return res.status(400).json({ error: '"capacityHours" must be a positive number' });
  }

  const solve = mode === 'greedy' ? greedyKnapsack : knapsack;
  const result = solve(tasks, capacityHours);

  res.json({
    success: true,
    algorithm: mode === 'greedy' ? 'Greedy' : '0/1 Knapsack (DP)',
    capacityHours,
    ...result,
  });
});

module.exports = router;
