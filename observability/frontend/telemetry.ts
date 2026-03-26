/**
 * OpenTelemetry instrumentation for GrayFSM Frontend
 *
 * Configures distributed tracing, browser metrics, and error logging
 * with automatic span creation for HTTP requests, user interactions,
 * and performance monitoring.
 */

import { basicTracerProvider, context } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  FetchInstrumentation,
} from '@opentelemetry/instrumentation-fetch';
import {
  XMLHttpRequestInstrumentation,
} from '@opentelemetry/instrumentation-xml-http-request';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import {
  Resource,
  detectResources,
  envDetector,
  browserDetector,
} from '@opentelemetry/resources';
import { SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { CompositePropagator } from '@opentelemetry/core';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';
import { trace, context as apiContext } from '@opentelemetry/api';

interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  tracesSampler?: (context: any) => number;
  enableAutoInstrumentation?: boolean;
  enableErrorTracking?: boolean;
  enablePerformanceMonitoring?: boolean;
}

class FrontendTelemetryProvider {
  private config: TelemetryConfig;
  private tracerProvider: WebTracerProvider | null = null;

  constructor(config: TelemetryConfig) {
    this.config = {
      enableAutoInstrumentation: true,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      tracesSampler: () => 1.0, // Sample all traces in development
      ...config,
    };
  }

  /**
   * Initialize telemetry provider
   */
  async initialize(): Promise<void> {
    // Detect resource attributes
    const resource = Resource.default().merge(
      new Resource({
        [SERVICE_NAME]: this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'deployment.environment': this.config.environment,
      })
    );

    // Create tracer provider
    this.tracerProvider = new WebTracerProvider({
      resource,
    });

    // Add OTLP exporter
    if (this.config.otlpEndpoint) {
      const exporter = new OTLPTraceExporter({
        url: this.config.otlpEndpoint,
        headers: {
          'Content-Type': 'application/x-protobuf',
        },
      });
      this.tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    }

    // Set as global tracer provider
    trace.setGlobalTracerProvider(this.tracerProvider);

    // Set context manager
    apiContext.setGlobalContextManager(new ZoneContextManager());

    // Setup propagators
    this.setupPropagators();

    // Instrument libraries
    if (this.config.enableAutoInstrumentation) {
      this.instrumentLibraries();
    }

    // Setup error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    // Setup performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }
  }

  /**
   * Setup trace context propagators
   */
  private setupPropagators(): void {
    const propagator = new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new JagerPropagator(),
      ],
    });

    // Note: Global propagator registration happens automatically in newer versions
  }

  /**
   * Instrument HTTP libraries
   */
  private instrumentLibraries(): void {
    // Fetch instrumentation
    new FetchInstrumentation({
      responseHook: (span, response) => {
        span.setAttribute('http.response_size', response.size || 0);
      },
    }).enable();

    // XMLHttpRequest instrumentation
    new XMLHttpRequestInstrumentation({
      responseHook: (span, xhr) => {
        if (xhr.response) {
          const size = new Blob([xhr.response]).size;
          span.setAttribute('http.response_size', size);
        }
      },
    }).enable();
  }

  /**
   * Setup error tracking and reporting
   */
  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError(
        event.error,
        'uncaught_exception',
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError(
        event.reason,
        'unhandled_promise_rejection'
      );
    });
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('web.lcp', lastEntry.renderTime || lastEntry.loadTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.debug('LCP observer not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric('web.fid', entry.processingDuration);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.debug('FID observer not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric('web.cls', entry.value);
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.debug('CLS observer not supported');
      }
    }

    // Monitor navigation timing
    window.addEventListener('load', () => {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;
      const connectTime = perfData.responseEnd - perfData.requestStart;

      this.recordMetric('page.load_time', pageLoadTime);
      this.recordMetric('page.dom_ready_time', domReadyTime);
      this.recordMetric('page.connect_time', connectTime);
    });
  }

  /**
   * Record an error with context
   */
  private recordError(
    error: Error | any,
    errorType: string,
    context?: Record<string, any>
  ): void {
    const tracer = trace.getTracer('grayfsm-frontend-errors');
    const span = tracer.startSpan('error', {
      attributes: {
        'error.type': errorType,
        'error.message': error?.message || String(error),
        'error.stack': error?.stack || undefined,
        ...context,
      },
    });
    span.end();
  }

  /**
   * Record a performance metric
   */
  private recordMetric(
    name: string,
    value: number,
    attributes?: Record<string, any>
  ): void {
    const tracer = trace.getTracer('grayfsm-frontend-metrics');
    const span = tracer.startSpan(`metric.${name}`, {
      attributes: {
        'metric.name': name,
        'metric.value': value,
        ...attributes,
      },
    });
    span.end();
  }

  /**
   * Get tracer instance
   */
  getTracer(name: string = 'grayfsm-frontend') {
    return trace.getTracer(name);
  }

  /**
   * Shutdown telemetry provider
   */
  async shutdown(): Promise<void> {
    if (this.tracerProvider) {
      await this.tracerProvider.shutdown();
    }
  }
}

// Global singleton instance
let telemetryProvider: FrontendTelemetryProvider | null = null;

/**
 * Initialize frontend telemetry
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<void> {
  telemetryProvider = new FrontendTelemetryProvider(config);
  await telemetryProvider.initialize();
}

/**
 * Get global tracer
 */
export function getTracer(name?: string) {
  return trace.getTracer(name || 'grayfsm-frontend');
}

/**
 * Create a new span for tracking operations
 */
export function createSpan(
  name: string,
  attributes?: Record<string, any>
) {
  const tracer = getTracer();
  return tracer.startSpan(name, { attributes });
}

/**
 * Track an async operation with automatic span management
 */
export async function trackAsync<T>(
  operationName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(operationName, { attributes });

  try {
    const result = await apiContext.with(
      apiContext.setSpan(apiContext.active(), span),
      fn
    );
    return result;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Shutdown telemetry provider
 */
export async function shutdownTelemetry(): Promise<void> {
  if (telemetryProvider) {
    await telemetryProvider.shutdown();
  }
}

// Export for use in React components
export { FrontendTelemetryProvider };
