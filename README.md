# Campus Notification & Vehicle Maintenance System

A microservices-based system comprising three interconnected services for campus notifications and vehicle maintenance scheduling with advanced logging middleware.

##  Project Overview

This project consists of three main microservices:

1. **Logging Middleware** (Port 3000) - HTTP request/response logging with Winston
2. **Vehicle Maintenance Scheduler** (Port 3001) - 0/1 Knapsack optimization for maintenance scheduling
3. **Notification App** (Port 3002) - Campus notifications microservice with priority inbox

---

##  Project Structure

```
RA2311056010083/
├── logging_middleware/
│   ├── index.js              # Express server setup with logging
│   ├── logger.js             # Winston logger configuration
│   ├── middleware.js         # Request/response logging middleware
│   ├── package.json          # Dependencies
│   └── logs/                 # Daily rotated log files
│
├── vehicle_maintenance_scheduler/
│   ├── index.js              # Express server setup
│   ├── routes.js             # API routes for scheduling
│   ├── apiClient.js          # HTTP client for evaluation service
│   ├── knapsack.js           # 0/1 Knapsack DP algorithm
│   └── package.json          # Dependencies
│
├── notification_app/
│   ├── index.js              # Express server setup
│   ├── routes.js             # Notification API routes
│   ├── apiClient.js          # HTTP client for evaluation service
│   ├── priorityInbox.js      # Priority scoring logic
│   └── package.json          # Dependencies
│
├── notification_system_design.md  # System design documentation
├── README.md                 # This file
└── .env                      # Environment variables (AUTH_TOKEN)
```

---

##  Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Ports 3000, 3001, and 3002 available

### Installation

Install dependencies for all services:

```bash
# Logging Middleware
cd logging_middleware
npm install

# Vehicle Maintenance Scheduler
cd ../vehicle_maintenance_scheduler
npm install

# Notification App
cd ../notification_app
npm install
```

### Environment Setup

Create a `.env` file in the root directory with:

```env
AUTH_TOKEN=<your_evaluation_service_auth_token>
EVAL_SERVICE_BASE=http://20.207.122.201/evaluation-service
```

---

##  Running the Services

### Start All Services (in separate terminals)

**Terminal 1 - Logging Middleware:**
```bash
cd logging_middleware
npm start
# Server running on http://localhost:3000
```

**Terminal 2 - Vehicle Maintenance Scheduler:**
```bash
cd vehicle_maintenance_scheduler
npm start
# Server running on http://localhost:3001
```

**Terminal 3 - Notification App:**
```bash
cd notification_app
npm start
# Server running on http://localhost:3002
```

---

## 📡 API Documentation

### 1. Logging Middleware (Port 3000)

**Health Check:**
```
GET http://localhost:3000/health
```
Response:
```json
{
  "status": "ok",
  "service": "logging-middleware",
  "uptime": 45.123,
  "timestamp": "2026-05-02T10:30:45.000Z"
}
```

**Echo Endpoint:**
```
POST http://localhost:3000/echo
Content-Type: application/json

{"message": "test"}
```

**Error Demo:**
```
GET http://localhost:3000/error-demo
```

---

### 2. Vehicle Maintenance Scheduler (Port 3001)

**Health Check:**
```
GET http://localhost:3001/health
```

**Get Maintenance Schedule (0/1 Knapsack):**
```
GET http://localhost:3001/api/schedule?mode=dp&depot=1
```
Query Parameters:
- `mode` - Algorithm type: `dp` (0/1 Knapsack) or `greedy` (Impact/Duration ratio)
- `depot` - (Optional) Filter by depot ID

Response:
```json
{
  "success": true,
  "results": [
    {
      "depotId": 1,
      "mechanicHoursBudget": 40,
      "algorithm": "0/1 Knapsack (DP)",
      "totalTasksConsidered": 5,
      "tasksScheduled": 3,
      "selectedTasks": [...],
      "totalImpact": 150,
      "totalDuration": 38
    }
  ]
}
```

**Get Depots:**
```
GET http://localhost:3001/api/depots
```

**Get Vehicles/Tasks:**
```
GET http://localhost:3001/api/vehicles
```

**Custom Schedule:**
```
POST http://localhost:3001/api/schedule/custom
Content-Type: application/json

{
  "vehicles": [...],
  "budget": 50,
  "mode": "dp"
}
```

---

### 3. Notification App (Port 3002)

**Health Check:**
```
GET http://localhost:3002/health
```

**Get All Notifications:**
```
GET http://localhost:3002/api/notifications
```
Response:
```json
{
  "success": true,
  "count": 15,
  "notifications": [...]
}
```

**Get Unread Notifications:**
```
GET http://localhost:3002/api/notifications/unread
```

**Get Priority Inbox (Top N):**
```
GET http://localhost:3002/api/notifications/priority?n=10
```
Query Parameters:
- `n` - Number of top notifications (default: 10, max: 50)

Response:
```json
{
  "success": true,
  "topN": 10,
  "count": 10,
  "scoringExplained": {
    "typeWeights": {"Placement": 3, "Result": 2, "Event": 1},
    "recencyFormula": "1 / (1 + ageInHours)",
    "finalScore": "typeWeight × recencyWeight"
  },
  "notifications": [...]
}
```

**Get Notifications by Type:**
```
GET http://localhost:3002/api/notifications/type/Placement
```

**Get Recent Placement Notifications:**
```
GET http://localhost:3002/api/notifications/placement/recent
```

**Broadcast Notifications:**
```
POST http://localhost:3002/api/notifications/notify-all
Content-Type: application/json

{
  "title": "Notification Title",
  "message": "Notification Message",
  "type": "Event"
}
```

---

##  Logging System

The logging middleware uses **Winston** with daily log rotation:

- **Console Output**: Colored, human-readable format
- **Daily Logs**: `logs/app-YYYY-MM-DD.log`
- **Error Logs**: `logs/error-YYYY-MM-DD.log`
- **Exception Logs**: `logs/exceptions.log`
- **Rejection Logs**: `logs/rejections.log`

Each request is assigned a unique `X-Request-ID` header for tracing.

---

##  Vehicle Maintenance Algorithm

The system uses a **0/1 Knapsack** dynamic programming algorithm to optimize maintenance scheduling:

- **Input**: List of vehicles with (Duration, Impact) and mechanic-hours budget
- **Output**: Optimal subset of vehicles to maintain within budget
- **Optimization**: Maximizes total impact while staying within mechanic-hours constraint

Alternative **Greedy Algorithm**:
- Uses Impact/Duration ratio for quick approximation
- Suitable for real-time scheduling

---

##  Notification Prioritization

The priority inbox uses a **composite scoring system**:

```
Score = Type Weight × Recency Weight

Type Weights:
  - Placement: 3.0
  - Result: 2.0
  - Event: 1.0

Recency Weight = 1 / (1 + age_in_hours)
```

Notifications are ranked by composite score (highest first).

---

##  Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | 3000 (logging), 3001 (scheduler), 3002 (notification) |
| `AUTH_TOKEN` | JWT token for evaluation service | Required |
| `EVAL_SERVICE_BASE` | Evaluation service URL | `http://20.207.122.201/evaluation-service` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Winston log level | `info` |

---

##  Request Flow

```
Client Request
    ↓
Notification App / Vehicle Scheduler
    ↓
Logging Middleware (requestLogger)
    ↓
Routes Handler
    ↓
API Client → Evaluation Service
    ↓
Response Processing
    ↓
Logging Middleware (errorLogger - if error)
    ↓
Client Response
```

---

##  Testing

### Test Logging Middleware
```bash
curl -X GET http://localhost:3000/health
curl -X POST http://localhost:3000/echo -H "Content-Type: application/json" -d '{"test":"data"}'
```

### Test Vehicle Scheduler
```bash
curl -X GET "http://localhost:3001/api/schedule?mode=dp"
curl -X GET http://localhost:3001/api/depots
curl -X GET http://localhost:3001/api/vehicles
```

### Test Notification App
```bash
curl -X GET http://localhost:3002/api/notifications
curl -X GET "http://localhost:3002/api/notifications/priority?n=5"
curl -X GET http://localhost:3002/api/notifications/unread
```

---

##  Troubleshooting

### Port Already in Use
If port is already in use:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Missing AUTH_TOKEN
Ensure `.env` file has `AUTH_TOKEN` set. Services will use fallback without it but may fail on external API calls.

### Evaluation Service Connection
Check if evaluation service is accessible:
```bash
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://20.207.122.201/evaluation-service/notifications
```

---

## Additional Resources

- [Notification System Design](./notification_system_design.md)
- [Express.js Documentation](https://expressjs.com/)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Knapsack Algorithm](https://en.wikipedia.org/wiki/Knapsack_problem)

---

## Author

**Abhilove Goyal** (RA2311056010083)

---

## License

This project is part of an evaluation system developed by Afford Medical Technologies Private Limited.

---

## Security Notes

- **Sensitive Fields**: Password, token, secret, and authorization are redacted in logs
- **CORS Enabled**: All services support CORS
- **Request Tracing**: Unique IDs for request tracking
- **Error Handling**: Graceful error responses without stack traces in production

---

**Last Updated**: May 2, 2026
