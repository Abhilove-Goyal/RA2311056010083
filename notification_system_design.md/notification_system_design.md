# Notification System Design

---

## Stage 1

### REST API Design & Contract

#### Overview

The Campus Notification Platform supports real-time updates for students across three categories: **Placements**, **Events**, and **Results**. Below are the REST API endpoints, JSON schemas, headers, and the real-time notification mechanism.

---

### Endpoints

#### 1. Get All Notifications for a Student

```
GET /api/students/{studentId}/notifications
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "studentId": "student_1042",
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3000a14576bc",
      "type": "Result",
      "message": "mid-sem",
      "isRead": false,
      "timestamp": "2026-04-22T17:51:30Z"
    }
  ],
  "total": 42,
  "unreadCount": 5
}
```

---

#### 2. Get Unread Notifications

```
GET /api/students/{studentId}/notifications/unread
```

**Response (200 OK):**
```json
{
  "studentId": "student_1042",
  "notifications": [ ... ],
  "unreadCount": 5
}
```

---

#### 3. Mark Notification as Read

```
PATCH /api/notifications/{notificationId}/read
```

**Headers:** `Authorization: Bearer <jwt_token>`

**Response (200 OK):**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3000a14576bc",
  "isRead": true,
  "updatedAt": "2026-04-22T18:00:00Z"
}
```

---

#### 4. Mark All as Read

```
PATCH /api/students/{studentId}/notifications/read-all
```

**Response (200 OK):**
```json
{ "updatedCount": 5, "message": "All notifications marked as read" }
```

---

#### 5. Get Notifications by Type

```
GET /api/students/{studentId}/notifications?type=Placement
```

**Query Params:** `type` = `Placement` | `Result` | `Event`

---

#### 6. Create / Send Notification (Internal/Admin)

```
POST /api/notifications
```

**Body:**
```json
{
  "studentId": "student_1042",
  "type": "Placement",
  "message": "Google hiring drive on May 5th",
  "timestamp": "2026-04-22T17:51:30Z"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-generated",
  "studentId": "student_1042",
  "type": "Placement",
  "message": "Google hiring drive on May 5th",
  "isRead": false,
  "timestamp": "2026-04-22T17:51:30Z"
}
```

---

### Notification JSON Schema

```json
{
  "id":        "string (UUID)",
  "studentId": "string",
  "type":      "enum: Placement | Result | Event",
  "message":   "string",
  "isRead":    "boolean (default: false)",
  "timestamp": "string (ISO 8601)"
}
```

---

### Real-Time Notification Mechanism

**Chosen approach: Server-Sent Events (SSE)**

```
GET /api/students/{studentId}/notifications/stream
```

- The server keeps the HTTP connection open and pushes events as `text/event-stream`.
- Simpler than WebSockets for one-way server→client push.
- Auto-reconnects natively in browsers.
- Falls back to polling (`GET /notifications/unread`) if SSE is unavailable.

**SSE Event format:**
```
event: notification
data: {"id":"...","type":"Placement","message":"Google hiring","timestamp":"..."}
```

---

## Stage 2

### Database Design

#### Recommended Database: PostgreSQL (Relational)

**Why PostgreSQL over NoSQL:**
- Student and notification data is **structured and relational** (studentId FK).
- Complex queries needed: filter by studentId + isRead + type + date range.
- ACID compliance required — a notification must not be lost.
- PostgreSQL's JSONB column can store flexible `metadata` if needed later.

---

### Schema

```sql
-- Students table
CREATE TABLE students (
  id         SERIAL PRIMARY KEY,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      VARCHAR(50) NOT NULL REFERENCES students(student_id),
  type            notification_type NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

-- Indexes for performance
CREATE INDEX idx_notifications_student_id     ON notifications(student_id);
CREATE INDEX idx_notifications_is_read        ON notifications(student_id, is_read);
CREATE INDEX idx_notifications_created_at     ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type_created   ON notifications(student_id, type, created_at DESC);
```

---

### Problems at Scale (50,000 students, 5,000,000 notifications)

| Problem | Cause | Solution |
|---|---|---|
| Slow unread queries | Full table scan on 5M rows | Composite index on `(student_id, is_read)` |
| High write load | Bulk "Notify All" inserts | Async message queue (BullMQ) |
| Read bottleneck | All students query on page load | Read replicas + Redis cache |
| Storage growth | 5M+ rows with no archival | Partition by `created_at` (monthly) |

---

### SQL/NoSQL Queries

**Get unread notifications for student 1042:**
```sql
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = '1042'
  AND is_read = FALSE
ORDER BY created_at DESC;
```

**Count unread per student (for badge count):**
```sql
SELECT student_id, COUNT(*) AS unread_count
FROM notifications
WHERE is_read = FALSE
GROUP BY student_id;
```

**NoSQL equivalent (MongoDB):**
```js
db.notifications.find(
  { studentId: "1042", isRead: false },
  { sort: { timestamp: -1 } }
)
```

---

## Stage 3

### Query Optimisation Analysis

#### Original slow query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

#### Why is it slow?

1. **No index on `(studentID, isRead)`** → PostgreSQL does a full sequential scan across all 5,000,000 rows.
2. **`SELECT *`** fetches all columns including large `message` TEXT, increasing I/O.
3. At 50,000 students with avg 100 notifications each = 5M rows scanned per query.

**Estimated cost without index:** O(N) = O(5,000,000) rows scanned → ~200-500ms per query.

---

#### Fix: Composite Index

```sql
CREATE INDEX idx_notif_student_read_date
  ON notifications(student_id, is_read, created_at DESC);
```

**With this index:** Query becomes O(log N + K) where K = result rows → <5ms.

---

#### Should we add indexes on EVERY column?

**No. This advice is dangerous.**

| Concern | Explanation |
|---|---|
| **Write slowdown** | Every INSERT/UPDATE/DELETE must update all indexes. At 50K students × Notify All = 50K index writes per bulk send. |
| **Storage bloat** | Each index is a full B-tree copy of that column's data. 10 indexes ≈ 10× storage. |
| **Planner confusion** | Too many indexes can cause the query planner to pick the wrong one. |

**Recommendation:** Index only: `(student_id, is_read, created_at)` and `(type, created_at)`.

---

#### Query: Students who got Placement notifications in last 7 days

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Supporting index:**
```sql
CREATE INDEX idx_notif_type_created ON notifications(type, created_at DESC);
```

---

## Stage 4

### Caching Strategy for Notification Fetch

#### Problem

The DB is getting overwhelmed because every page load triggers:
```
GET /api/students/{studentId}/notifications/unread
→ SQL query on 5M row table
```

With 50,000 concurrent students: **50,000 DB queries/min**.

---

### Solutions & Tradeoffs

#### Strategy 1: Redis Cache (Recommended)

```
GET /api/students/{id}/notifications/unread
  → Check Redis key: notif:unread:{studentId}
  → Cache HIT → return cached list (TTL: 30s)
  → Cache MISS → query DB → store in Redis → return
```

**Cache invalidation:** When a new notification is created for studentId X, delete `notif:unread:{X}`.

| Tradeoff | Detail |
|---|---|
| ✅ Reduces DB load by ~90% | Most reads are served from memory |
| ✅ <5ms response time | Redis in-memory lookup |
| ⚠️ Stale data window | Up to 30s old (acceptable for notifications) |
| ⚠️ Cache invalidation complexity | Must invalidate on write |

---

#### Strategy 2: Database Read Replicas

Route `SELECT` queries to a read replica; writes go to primary.

| Tradeoff | Detail |
|---|---|
| ✅ Linear read scaling | Add replicas as load grows |
| ⚠️ Replication lag | ~100ms lag; replica may be slightly behind |
| ⚠️ Cost | Each replica = another DB instance |

---

#### Strategy 3: Polling → SSE/WebSocket

Replace periodic polling with push-based SSE. Eliminates repeated DB reads entirely for idle users.

| Tradeoff | Detail |
|---|---|
| ✅ No unnecessary DB hits | Server pushes only when new data exists |
| ⚠️ Persistent connections | Needs careful connection management at scale |

---

#### Recommended Combination

1. **Redis** for unread count badge (TTL 30s)
2. **Read Replica** for full notification list
3. **SSE** for real-time delivery of new notifications

---

## Stage 5

### Reliable Bulk Notification (Notify All)

#### Original pseudocode problem:
```
function notify_all(student_ids, message):
  for student_id in student_ids:
    send_email(student_id, message)   # calls Email API
    save_to_db(student_id, message)   # DB insert
    push_to_app(student_id, message)  # real-time push
```

#### Shortcomings:

1. **Synchronous serial loop** — 50,000 iterations in a single request = timeout.
2. **send_email failure kills the loop** — 200 failed students = all subsequent students not processed.
3. **DB and email are coupled** — if DB insert fails after email send, data is inconsistent.
4. **No retry mechanism** — transient failures are permanent losses.
5. **No progress tracking** — caller has no visibility into partial success.

---

### Redesigned Reliable Implementation

```
function notify_all_reliable(student_ids, message, type):

  // Step 1: Write all notifications to DB first (source of truth)
  batch_insert_to_db(student_ids, message, type)
  // DB is now the reliable record. If anything downstream fails, we can re-derive.

  // Step 2: Push to message queue in batches
  BATCH_SIZE = 500
  for batch in chunks(student_ids, BATCH_SIZE):
    enqueue_job("send_notifications", {
      student_ids: batch,
      message: message,
      type: type,
      retries: 3,
      backoff: "exponential"
    })

  return { jobsEnqueued: ceil(len(student_ids) / BATCH_SIZE) }

// Worker (runs independently, consumes from queue):
function worker_process_notification_batch(job):
  for student_id in job.student_ids:
    try:
      send_email(student_id, job.message)       // fire email
      push_to_app(student_id, job.message)      // push to SSE/WebSocket
    except EmailError as e:
      log_failure(student_id, e)
      // DB already has the record — student will see it on next login
      // Queue will retry this job up to 3 times with exponential backoff
```

#### Why DB write first?

- DB is the **single source of truth**.
- Even if email/push fails, the student will see the notification when they log in.
- Retrying email is safe (idempotent with deduplication ID).

#### Queue: BullMQ (Redis-backed) or RabbitMQ

- Jobs are **persistent** — survive server restarts.
- **Dead-letter queue** captures permanently failed jobs for manual review.
- **Concurrency** — 50 workers process batches in parallel → 50,000 students in ~10s.

---

## Stage 6

### Priority Inbox Implementation

#### Approach

Rank unread notifications by a **composite score**:

```
score = typeWeight × recencyWeight

typeWeight:   Placement=3, Result=2, Event=1
recencyWeight: 1 / (1 + ageInHours)
```

This ensures:
- A Placement from 1 hour ago scores: `3 × (1/2) = 1.5`
- An Event from 0 hours ago scores: `1 × 1.0 = 1.0`
- A Placement from 24 hours ago: `3 × (1/25) = 0.12`

#### Maintaining Top-10 Efficiently

When a new notification arrives:
1. Compute its score.
2. If it's higher than the current minimum in the top-10, replace it.
3. Re-sort (only 10 elements → O(10 log 10) ≈ constant time).

This avoids re-sorting the entire notification list (which could be thousands of items) on every new arrival.

#### API Endpoint

```
GET /api/notifications/priority?n=10
```

See `priorityInbox.js` for full implementation.

**Response:**
```json
{
  "topN": 10,
  "scoringExplained": {
    "typeWeights": { "Placement": 3, "Result": 2, "Event": 1 },
    "recencyFormula": "1 / (1 + ageInHours)",
    "finalScore": "typeWeight × recencyWeight"
  },
  "notifications": [
    {
      "id": "b283218f-...",
      "type": "Placement",
      "message": "CSX Corporation hiring",
      "timestamp": "2026-04-22T17:51:18Z",
      "isRead": false,
      "priorityScore": 2.9841
    }
  ]
}
```
