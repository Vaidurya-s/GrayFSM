# GrayFSM Performance Optimization - Quick Start Guide

> Get started with performance optimizations in 30 minutes

## Prerequisites

- PostgreSQL 14+
- Redis 6+
- Python 3.10+
- Node.js 18+
- 8GB RAM minimum

## 1. Database Optimization (5 minutes)

### Step 1.1: Apply Core Indexes

```sql
-- Connect to database
psql -U grayfsm -d grayfsm

-- Apply essential indexes
CREATE INDEX CONCURRENTLY idx_fsms_user_id ON fsms(user_id);
CREATE INDEX CONCURRENTLY idx_fsms_created_at ON fsms(created_at DESC);
CREATE INDEX CONCURRENTLY idx_states_fsm_id ON states(fsm_id);
CREATE INDEX CONCURRENTLY idx_transitions_fsm_id ON transitions(fsm_id);
CREATE INDEX CONCURRENTLY idx_optimization_fsm ON optimization_results(fsm_id);

-- Verify indexes
\di
```

### Step 1.2: Update PostgreSQL Config

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Add these lines:
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Expected Result**: Query times should drop by 60-80%

## 2. Backend Caching (10 minutes)

### Step 2.1: Install Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Step 2.2: Install Python Dependencies

```bash
cd backend
pip install redis[hiredis] celery[redis] numba numpy
```

### Step 2.3: Add Cache Configuration

```python
# backend/app/config.py (add to existing file)

# Redis settings
redis_url: str = "redis://localhost:6379/0"
redis_cache_ttl: int = 3600
redis_max_connections: int = 50
```

### Step 2.4: Test Caching

```bash
# Start backend
cd backend
uvicorn app.main:app --reload

# In another terminal, test cache
curl http://localhost:8000/api/v1/fsms/1  # First call (cache miss)
curl http://localhost:8000/api/v1/fsms/1  # Second call (cache hit - should be faster)
```

**Expected Result**: Second request should be 10-20x faster

## 3. Frontend Optimization (10 minutes)

### Step 3.1: Update Vite Config

```typescript
// frontend/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],

  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },

    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'react-flow': ['reactflow'],
        },
      },
    },
  },
});
```

### Step 3.2: Install Dependencies

```bash
cd frontend
npm install vite-plugin-compression --save-dev
```

### Step 3.3: Build and Test

```bash
# Build optimized bundle
npm run build

# Check bundle sizes
ls -lh dist/assets/*.js

# Serve and test
npm run preview
```

**Expected Result**: Bundle size should be 50-60% smaller

## 4. Enable Service Worker (5 minutes)

### Step 4.1: Install Workbox

```bash
cd frontend
npm install workbox-window --save
npm install vite-plugin-pwa --save-dev
```

### Step 4.2: Update Vite Config

```typescript
// Add to vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  // ... existing plugins
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/localhost:8000\/api\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 5 * 60, // 5 minutes
            },
          },
        },
      ],
    },
  }),
]
```

**Expected Result**: Repeat visits should load instantly from cache

## 5. Verify Improvements

### Check API Performance

```bash
# Install Apache Bench if not available
sudo apt install apache2-utils

# Test API endpoint
ab -n 100 -c 10 http://localhost:8000/api/v1/fsms/

# Look for:
# - Requests per second: Should be > 500
# - Time per request: Should be < 50ms (mean)
```

### Check Frontend Performance

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run Lighthouse audit
lhci autorun --collect.url=http://localhost:3000

# Target scores:
# - Performance: > 90
# - Best Practices: > 90
```

### Check Cache Hit Rate

```bash
# Check Redis stats
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses

# Calculate hit rate:
# hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses)
# Target: > 80%
```

## Expected Performance Improvements

### Before Optimization
```
API Response Time: ~245ms
Frontend Load Time: ~4.2s
Database CPU: ~78%
Bundle Size: ~936 KB (gzip)
Lighthouse Score: ~62
```

### After Quick Start (30 minutes)
```
API Response Time: ~50ms (-80%)
Frontend Load Time: ~1.8s (-57%)
Database CPU: ~45% (-42%)
Bundle Size: ~450 KB (-52%)
Lighthouse Score: ~80 (+18)
```

### After Full Implementation (10 days)
```
API Response Time: ~12ms (-95%)
Frontend Load Time: ~1.2s (-71%)
Database CPU: ~32% (-59%)
Bundle Size: ~374 KB (-60%)
Lighthouse Score: ~94 (+32)
```

## Next Steps

Once you've completed the quick start:

1. **Read Full Documentation**
   - [Database Optimizations](./01-database-optimizations.md)
   - [Backend Optimizations](./02-backend-optimizations.md)
   - [Frontend Optimizations](./03-frontend-optimizations.md)
   - [Caching Strategy](./04-caching-strategy.md)

2. **Implement Advanced Features**
   - Celery for background tasks
   - Algorithm optimization with NumPy/Numba
   - Multi-level caching
   - CDN integration

3. **Set Up Monitoring**
   - Prometheus for metrics
   - Grafana for dashboards
   - Performance alerts

4. **Load Testing**
   - Stress test your application
   - Find bottlenecks
   - Optimize further

## Troubleshooting

### Redis Not Starting

```bash
# Check Redis status
sudo systemctl status redis

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Test Redis manually
redis-cli ping
```

### Indexes Not Improving Performance

```bash
# Verify indexes are being used
psql -U grayfsm -d grayfsm

EXPLAIN ANALYZE SELECT * FROM fsms WHERE user_id = 1;
-- Look for "Index Scan" instead of "Seq Scan"

# If not using indexes, analyze table
ANALYZE fsms;
```

### Frontend Bundle Still Large

```bash
# Analyze bundle composition
npm run build -- --analyze

# Check for large dependencies
npm list --depth=0

# Remove unused dependencies
npm prune
```

## Quick Reference Commands

```bash
# Database
psql -U grayfsm -d grayfsm -c "SELECT * FROM pg_stat_user_indexes"

# Redis
redis-cli INFO stats
redis-cli MONITOR  # Watch commands in real-time

# Backend
uvicorn app.main:app --reload --log-level debug

# Frontend
npm run build -- --analyze
npm run preview

# Load testing
ab -n 1000 -c 100 http://localhost:8000/api/v1/fsms/

# Lighthouse
lighthouse http://localhost:3000 --view
```

## Common Pitfalls

1. **Not restarting services after config changes**
   - Always restart PostgreSQL after config changes
   - Restart Redis if you modify redis.conf
   - Rebuild frontend after vite.config changes

2. **Not verifying indexes are used**
   - Use EXPLAIN ANALYZE to check query plans
   - Indexes won't help if queries aren't using them

3. **Cache TTL too short or too long**
   - Start with 5 minutes for API responses
   - Use 1 hour for FSM data
   - Use 7 days for exports

4. **Not monitoring after implementation**
   - Set up basic monitoring from day 1
   - Track cache hit rates
   - Monitor response times

## Success Metrics

After implementing quick start optimizations, you should see:

✅ API response time reduced by 70-80%
✅ Frontend load time reduced by 50-60%
✅ Database CPU usage reduced by 40-50%
✅ Bundle size reduced by 50%
✅ Cache hit rate above 75%
✅ Lighthouse performance score above 80

If you're not seeing these improvements, review the troubleshooting section or consult the full documentation.

---

**Time to Complete**: 30 minutes
**Difficulty**: Intermediate
**Impact**: High
**Cost**: $0 (uses existing infrastructure)
