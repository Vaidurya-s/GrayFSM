/**
 * K6 Load Testing Script
 *
 * Alternative load testing using K6 for high-performance scenarios.
 *
 * Run with: k6 run k6_load_test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const optimizationDuration = new Trend('optimization_duration');
const exportDuration = new Trend('export_duration');
const fsmCreated = new Counter('fsm_created');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 100 },   // Ramp to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 200 },   // Spike to 200 users
    { duration: '2m', target: 200 },   // Stay at spike
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    errors: ['rate<0.1'],              // Custom error rate under 10%
    optimization_duration: ['p(95)<5000'], // 95% of optimizations under 5s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000/api/v1';

// Helper function to generate random FSM
function generateFSM(numStates = 4) {
  const states = Array.from({ length: numStates }, (_, i) => `S${i}`);
  const transitions = states.map((state, i) => ({
    from_state: state,
    to_state: states[(i + 1) % numStates],
    input: 'next'
  }));

  const outputs = {};
  states.forEach((state, i) => {
    outputs[state] = i.toString(2).padStart(Math.ceil(Math.log2(numStates)), '0');
  });

  return {
    name: `Test FSM ${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'K6 load test FSM',
    fsm_type: 'moore',
    states: states,
    initial_state: 'S0',
    transitions: transitions,
    outputs: outputs,
    visibility: 'private',
    tags: ['k6-test']
  };
}

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  group('FSM CRUD Operations', function () {
    // Create FSM
    const createResponse = http.post(
      `${BASE_URL}/fsms`,
      JSON.stringify(generateFSM(Math.floor(Math.random() * 8) + 4)),
      params
    );

    check(createResponse, {
      'FSM created successfully': (r) => r.status === 201,
      'FSM has ID': (r) => JSON.parse(r.body).data.id !== undefined,
    }) || errorRate.add(1);

    if (createResponse.status === 201) {
      fsmCreated.add(1);
      const fsmId = JSON.parse(createResponse.body).data.id;

      // Get FSM
      const getResponse = http.get(`${BASE_URL}/fsms/${fsmId}`, params);
      check(getResponse, {
        'FSM retrieved': (r) => r.status === 200,
      }) || errorRate.add(1);

      // Update FSM
      const updateResponse = http.put(
        `${BASE_URL}/fsms/${fsmId}`,
        JSON.stringify({
          name: `Updated FSM ${Date.now()}`,
          description: 'Updated by K6'
        }),
        params
      );
      check(updateResponse, {
        'FSM updated': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  group('Optimization Operations', function () {
    // Create FSM for optimization
    const createResponse = http.post(
      `${BASE_URL}/fsms`,
      JSON.stringify(generateFSM(8)),
      params
    );

    if (createResponse.status === 201) {
      const fsmId = JSON.parse(createResponse.body).data.id;

      // Optimize with greedy algorithm
      const startTime = Date.now();
      const optResponse = http.post(
        `${BASE_URL}/fsms/${fsmId}/optimize`,
        JSON.stringify({
          algorithm: 'greedy',
          async: false,
          options: { timeout_ms: 5000 }
        }),
        params
      );
      const optDuration = Date.now() - startTime;

      check(optResponse, {
        'Optimization completed': (r) => r.status === 200,
        'Optimization has results': (r) => {
          const body = JSON.parse(r.body);
          return body.data && body.data.dummy_states_added !== undefined;
        },
      }) || errorRate.add(1);

      optimizationDuration.add(optDuration);
    }
  });

  group('Export Operations', function () {
    // Create FSM for export
    const createResponse = http.post(
      `${BASE_URL}/fsms`,
      JSON.stringify(generateFSM(6)),
      params
    );

    if (createResponse.status === 201) {
      const fsmId = JSON.parse(createResponse.body).data.id;

      // Export to different formats
      const formats = ['verilog', 'vhdl', 'json'];
      const format = formats[Math.floor(Math.random() * formats.length)];

      const startTime = Date.now();
      const exportResponse = http.post(
        `${BASE_URL}/fsms/${fsmId}/export`,
        JSON.stringify({
          format: format,
          options: { include_comments: true }
        }),
        params
      );
      const exportDur = Date.now() - startTime;

      check(exportResponse, {
        'Export successful': (r) => r.status === 200,
        'Export has content': (r) => {
          const body = JSON.parse(r.body);
          return body.data && body.data.content && body.data.content.length > 0;
        },
      }) || errorRate.add(1);

      exportDuration.add(exportDur);
    }
  });

  group('List and Search Operations', function () {
    // List FSMs
    const listResponse = http.get(
      `${BASE_URL}/fsms?page=${Math.floor(Math.random() * 5) + 1}&page_size=20`,
      params
    );
    check(listResponse, {
      'FSMs listed': (r) => r.status === 200,
      'Has pagination': (r) => JSON.parse(r.body).pagination !== undefined,
    }) || errorRate.add(1);

    // Search FSMs
    const searchResponse = http.get(
      `${BASE_URL}/fsms?search=Test&fsm_type=moore`,
      params
    );
    check(searchResponse, {
      'Search completed': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group('Health Check', function () {
    const healthResponse = http.get(`${BASE_URL}/health`, params);
    check(healthResponse, {
      'Health check passed': (r) => r.status === 200,
      'Status is healthy': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      },
    });
  });

  // Think time between iterations
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'k6-summary.json': JSON.stringify(data),
    'k6-summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function htmlReport(data) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Report - GrayFSM</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #4CAF50; color: white; }
    .metric { display: inline-block; margin: 10px; padding: 15px; background: #e8f5e9; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
  </style>
</head>
<body>
  <div class="container">
    <h1>GrayFSM Load Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>

    <h2>Test Summary</h2>
    <div class="metric">
      <strong>Total Requests:</strong> ${data.metrics.http_reqs.values.count}
    </div>
    <div class="metric">
      <strong>Failed Requests:</strong> ${data.metrics.http_req_failed.values.rate * 100}%
    </div>
    <div class="metric">
      <strong>Avg Response Time:</strong> ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
    </div>
    <div class="metric">
      <strong>P95 Response Time:</strong> ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
    </div>

    <h2>Detailed Metrics</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Count/Rate</th>
        <th>Avg</th>
        <th>Min</th>
        <th>Max</th>
        <th>P95</th>
      </tr>
      ${Object.entries(data.metrics).map(([name, metric]) => `
        <tr>
          <td>${name}</td>
          <td>${metric.values.count || metric.values.rate || 'N/A'}</td>
          <td>${metric.values.avg ? metric.values.avg.toFixed(2) : 'N/A'}</td>
          <td>${metric.values.min ? metric.values.min.toFixed(2) : 'N/A'}</td>
          <td>${metric.values.max ? metric.values.max.toFixed(2) : 'N/A'}</td>
          <td>${metric.values['p(95)'] ? metric.values['p(95)'].toFixed(2) : 'N/A'}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</body>
</html>
  `;
  return html;
}

function textSummary(data, options) {
  let summary = '\n=== GrayFSM Load Test Summary ===\n\n';
  summary += `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  summary += `Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  return summary;
}
