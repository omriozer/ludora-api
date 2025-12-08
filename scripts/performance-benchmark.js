#!/usr/bin/env node

/**
 * Performance Benchmarking Script for Middleware Optimization
 *
 * Measures and compares performance before and after middleware optimization.
 * Tests various scenarios including Israeli context, Hebrew content, and educational paths.
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Benchmark configuration
const BENCHMARK_CONFIG = {
  baseUrl: process.env.BENCHMARK_URL || 'http://localhost:3003',
  iterations: process.env.BENCHMARK_ITERATIONS || 100,
  concurrency: process.env.BENCHMARK_CONCURRENCY || 10,
  outputFile: process.env.BENCHMARK_OUTPUT || './benchmark-results.json',
  timeout: 30000, // 30 seconds
  warmupIterations: 10
};

// Test scenarios for comprehensive benchmarking
const TEST_SCENARIOS = [
  {
    name: 'Israeli Context - Hebrew Educational Content',
    path: '/api/entities/games',
    method: 'GET',
    headers: {
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      'Content-Language': 'he',
      'X-Israeli-Context': 'true',
      'User-Agent': 'LudoraBenchmark/1.0'
    },
    expectedMiddlewares: ['israeli-context', 'performance-tracker', 'alert-system', 'response-processor'],
    weight: 0.3 // 30% of traffic
  },
  {
    name: 'Educational Content - English',
    path: '/api/entities/tools/calculator',
    method: 'GET',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'LudoraBenchmark/1.0'
    },
    expectedMiddlewares: ['performance-tracker', 'alert-system', 'response-processor'],
    weight: 0.25 // 25% of traffic
  },
  {
    name: 'Hebrew Content Upload',
    path: '/api/assets/upload',
    method: 'POST',
    headers: {
      'Accept-Language': 'he-IL',
      'Content-Type': 'application/json',
      'Content-Language': 'he',
      'User-Agent': 'LudoraBenchmark/1.0'
    },
    body: JSON.stringify({
      content: 'שלום עולם',
      title: 'תרגיל מתמטיקה',
      description: 'תרגיל לחיזוק הידע במתמטיקה'
    }),
    expectedMiddlewares: ['israeli-context', 'performance-tracker', 'alert-system', 'response-processor'],
    weight: 0.15 // 15% of traffic
  },
  {
    name: 'Student Dashboard - Peak Hours',
    path: '/api/dashboard/student',
    method: 'GET',
    headers: {
      'Accept-Language': 'he-IL,en;q=0.8',
      'Authorization': 'Bearer test-student-token',
      'User-Agent': 'LudoraBenchmark/1.0'
    },
    expectedMiddlewares: ['israeli-context', 'performance-tracker', 'alert-system', 'response-processor'],
    weight: 0.2 // 20% of traffic
  },
  {
    name: 'Non-Israeli Authentication',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'User-Agent': 'LudoraBenchmark/1.0'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword'
    }),
    expectedMiddlewares: ['response-processor'], // Minimal middleware activation
    weight: 0.1 // 10% of traffic
  }
];

// Metrics to collect
const METRICS = {
  responseTime: [],
  memoryUsage: [],
  cpuUsage: [],
  throughput: [],
  errorRate: [],
  middlewareLatency: [],
  compressionRatio: [],
  cacheHitRate: []
};

class PerformanceBenchmark {
  constructor(config) {
    this.config = config;
    this.results = {
      timestamp: new Date().toISOString(),
      config: config,
      scenarios: {},
      summary: {},
      comparison: null
    };
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmark() {
    console.log('🚀 Starting Performance Benchmark Suite...');
    console.log(`📊 Configuration: ${this.config.iterations} iterations, ${this.config.concurrency} concurrent`);

    // Warmup
    await this.warmup();

    // Run scenarios
    for (const scenario of TEST_SCENARIOS) {
      console.log(`\n📈 Running scenario: ${scenario.name}`);
      const result = await this.runScenario(scenario);
      this.results.scenarios[scenario.name] = result;
    }

    // Calculate summary metrics
    this.calculateSummary();

    // Save results
    await this.saveResults();

    // Display results
    this.displayResults();

    return this.results;
  }

  /**
   * Warmup the server
   */
  async warmup() {
    console.log('🔥 Warming up server...');

    for (let i = 0; i < this.config.warmupIterations; i++) {
      const scenario = TEST_SCENARIOS[Math.floor(Math.random() * TEST_SCENARIOS.length)];
      await this.makeRequest(scenario);
    }

    // Wait for batch processing to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Warmup complete');
  }

  /**
   * Run a specific test scenario
   */
  async runScenario(scenario) {
    const results = {
      name: scenario.name,
      iterations: this.config.iterations,
      metrics: {
        responseTimes: [],
        errors: [],
        statuses: [],
        throughput: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        memoryDelta: 0,
        compressionDetected: 0
      },
      startTime: performance.now()
    };

    const memoryBefore = process.memoryUsage();

    // Run concurrent batches
    const batchSize = this.config.concurrency;
    const batches = Math.ceil(this.config.iterations / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = [];
      const currentBatchSize = Math.min(batchSize, this.config.iterations - (batch * batchSize));

      for (let i = 0; i < currentBatchSize; i++) {
        batchPromises.push(this.makeRequest(scenario));
      }

      const batchResults = await Promise.allSettled(batchPromises);

      // Process batch results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.metrics.responseTimes.push(result.value.responseTime);
          results.metrics.statuses.push(result.value.statusCode);

          if (result.value.compressed) {
            results.metrics.compressionDetected++;
          }

          if (result.value.statusCode >= 400) {
            results.metrics.errors.push(result.value.error || 'Unknown error');
          }
        } else {
          results.metrics.errors.push(result.reason.message);
        }
      });

      // Show progress
      const progress = Math.round(((batch + 1) / batches) * 100);
      process.stdout.write(`\r  Progress: ${progress}% (${(batch + 1) * batchSize}/${this.config.iterations})`);
    }

    console.log(); // New line after progress

    const memoryAfter = process.memoryUsage();
    results.endTime = performance.now();
    results.totalDuration = results.endTime - results.startTime;

    // Calculate metrics
    this.calculateScenarioMetrics(results, memoryBefore, memoryAfter);

    return results;
  }

  /**
   * Make HTTP request for a scenario
   */
  async makeRequest(scenario) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const url = new URL(scenario.path, this.config.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: scenario.method,
        headers: scenario.headers || {},
        timeout: this.config.timeout
      };

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          resolve({
            statusCode: res.statusCode,
            responseTime: responseTime,
            contentLength: data.length,
            compressed: res.headers['content-encoding'] === 'gzip',
            hebrewOptimized: res.headers['x-compression-type'] === 'hebrew-optimized',
            israeliContext: res.headers['x-israeli-context'] === 'enabled',
            cacheStatus: res.headers['x-cache-status'],
            processingTime: parseFloat(res.headers['x-processing-time']) || 0,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (scenario.body) {
        req.write(scenario.body);
      }

      req.end();
    });
  }

  /**
   * Calculate metrics for a scenario
   */
  calculateScenarioMetrics(results, memoryBefore, memoryAfter) {
    const { responseTimes } = results.metrics;

    if (responseTimes.length === 0) {
      results.metrics.avgResponseTime = 0;
      results.metrics.p95ResponseTime = 0;
      results.metrics.p99ResponseTime = 0;
      results.metrics.errorRate = 100;
      return;
    }

    responseTimes.sort((a, b) => a - b);

    results.metrics.avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    results.metrics.p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
    results.metrics.p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    results.metrics.minResponseTime = responseTimes[0];
    results.metrics.maxResponseTime = responseTimes[responseTimes.length - 1];

    results.metrics.errorRate = (results.metrics.errors.length / this.config.iterations) * 100;
    results.metrics.throughput = (this.config.iterations / (results.totalDuration / 1000)).toFixed(2);

    results.metrics.memoryDelta = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      external: memoryAfter.external - memoryBefore.external
    };

    results.metrics.compressionRate = (results.metrics.compressionDetected / this.config.iterations) * 100;
  }

  /**
   * Calculate overall summary metrics
   */
  calculateSummary() {
    const allResponseTimes = [];
    let totalRequests = 0;
    let totalErrors = 0;
    let totalDuration = 0;

    for (const [name, scenario] of Object.entries(this.results.scenarios)) {
      allResponseTimes.push(...scenario.metrics.responseTimes);
      totalRequests += this.config.iterations;
      totalErrors += scenario.metrics.errors.length;
      totalDuration += scenario.totalDuration;
    }

    allResponseTimes.sort((a, b) => a - b);

    this.results.summary = {
      totalRequests,
      totalErrors,
      totalDuration: totalDuration / TEST_SCENARIOS.length, // Average duration
      overallErrorRate: (totalErrors / totalRequests) * 100,
      overallAvgResponseTime: allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length,
      overallP95ResponseTime: allResponseTimes[Math.floor(allResponseTimes.length * 0.95)],
      overallP99ResponseTime: allResponseTimes[Math.floor(allResponseTimes.length * 0.99)],
      overallThroughput: (totalRequests / (totalDuration / TEST_SCENARIOS.length / 1000)).toFixed(2),
      scenarioCount: TEST_SCENARIOS.length
    };
  }

  /**
   * Compare with previous benchmark results
   */
  async loadPreviousResults() {
    try {
      const previousData = await fs.readFile(this.config.outputFile, 'utf8');
      const previousResults = JSON.parse(previousData);
      return previousResults;
    } catch (error) {
      console.log('📝 No previous benchmark results found');
      return null;
    }
  }

  /**
   * Generate comparison with previous results
   */
  generateComparison(previous) {
    if (!previous || !previous.summary) {
      return null;
    }

    const current = this.results.summary;
    const prev = previous.summary;

    return {
      responseTime: {
        current: current.overallAvgResponseTime,
        previous: prev.overallAvgResponseTime,
        improvement: ((prev.overallAvgResponseTime - current.overallAvgResponseTime) / prev.overallAvgResponseTime * 100).toFixed(2)
      },
      throughput: {
        current: parseFloat(current.overallThroughput),
        previous: parseFloat(prev.overallThroughput),
        improvement: ((current.overallThroughput - prev.overallThroughput) / prev.overallThroughput * 100).toFixed(2)
      },
      errorRate: {
        current: current.overallErrorRate,
        previous: prev.overallErrorRate,
        improvement: ((prev.overallErrorRate - current.overallErrorRate) / prev.overallErrorRate * 100).toFixed(2)
      },
      p95ResponseTime: {
        current: current.overallP95ResponseTime,
        previous: prev.overallP95ResponseTime,
        improvement: ((prev.overallP95ResponseTime - current.overallP95ResponseTime) / prev.overallP95ResponseTime * 100).toFixed(2)
      }
    };
  }

  /**
   * Save benchmark results to file
   */
  async saveResults() {
    try {
      // Load previous results for comparison
      const previousResults = await this.loadPreviousResults();
      if (previousResults) {
        this.results.comparison = this.generateComparison(previousResults);
      }

      const outputPath = path.resolve(this.config.outputFile);
      await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 Results saved to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error saving results:', error.message);
    }
  }

  /**
   * Display benchmark results
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIDDLEWARE OPTIMIZATION BENCHMARK RESULTS');
    console.log('='.repeat(60));

    // Summary
    const { summary } = this.results;
    console.log('\n📈 OVERALL PERFORMANCE:');
    console.log(`   Total Requests: ${summary.totalRequests}`);
    console.log(`   Average Response Time: ${summary.overallAvgResponseTime.toFixed(2)}ms`);
    console.log(`   P95 Response Time: ${summary.overallP95ResponseTime.toFixed(2)}ms`);
    console.log(`   P99 Response Time: ${summary.overallP99ResponseTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${summary.overallThroughput} req/sec`);
    console.log(`   Error Rate: ${summary.overallErrorRate.toFixed(2)}%`);

    // Comparison with previous run
    if (this.results.comparison) {
      console.log('\n📊 PERFORMANCE COMPARISON:');
      const comp = this.results.comparison;

      this.displayMetricComparison('Response Time', comp.responseTime, 'ms', true);
      this.displayMetricComparison('Throughput', comp.throughput, 'req/sec', false);
      this.displayMetricComparison('Error Rate', comp.errorRate, '%', true);
      this.displayMetricComparison('P95 Response Time', comp.p95ResponseTime, 'ms', true);
    }

    // Scenario breakdown
    console.log('\n📋 SCENARIO BREAKDOWN:');
    for (const [name, scenario] of Object.entries(this.results.scenarios)) {
      console.log(`\n   ${name}:`);
      console.log(`     Avg Response Time: ${scenario.metrics.avgResponseTime.toFixed(2)}ms`);
      console.log(`     P95 Response Time: ${scenario.metrics.p95ResponseTime.toFixed(2)}ms`);
      console.log(`     Throughput: ${scenario.metrics.throughput} req/sec`);
      console.log(`     Error Rate: ${scenario.metrics.errorRate.toFixed(2)}%`);
      console.log(`     Compression Rate: ${scenario.metrics.compressionRate.toFixed(1)}%`);
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Display metric comparison with color coding
   */
  displayMetricComparison(metricName, comparison, unit, lowerIsBetter) {
    const improvement = parseFloat(comparison.improvement);
    const isImprovement = lowerIsBetter ? improvement > 0 : improvement > 0;
    const symbol = isImprovement ? '📈' : '📉';
    const sign = improvement > 0 ? '+' : '';

    console.log(`   ${symbol} ${metricName}:`);
    console.log(`     Previous: ${comparison.previous}${unit}`);
    console.log(`     Current: ${comparison.current}${unit}`);
    console.log(`     Change: ${sign}${comparison.improvement}%`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Ludora Middleware Performance Benchmark

Usage: node performance-benchmark.js [options]

Options:
  --url <url>           API base URL (default: http://localhost:3003)
  --iterations <num>    Number of requests per scenario (default: 100)
  --concurrency <num>   Concurrent requests (default: 10)
  --output <file>       Output file path (default: ./benchmark-results.json)
  --compare             Compare with previous results only
  --help, -h           Show this help message

Environment Variables:
  BENCHMARK_URL         API base URL
  BENCHMARK_ITERATIONS  Number of iterations
  BENCHMARK_CONCURRENCY Concurrency level
  BENCHMARK_OUTPUT      Output file path

Examples:
  node performance-benchmark.js
  node performance-benchmark.js --url https://api.ludora.app --iterations 200
  node performance-benchmark.js --compare
    `);
    process.exit(0);
  }

  // Parse arguments
  const config = { ...BENCHMARK_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--url':
        config.baseUrl = args[i + 1];
        break;
      case '--iterations':
        config.iterations = parseInt(args[i + 1]);
        break;
      case '--concurrency':
        config.concurrency = parseInt(args[i + 1]);
        break;
      case '--output':
        config.outputFile = args[i + 1];
        break;
      case '--compare':
        await compareResults(config);
        process.exit(0);
        break;
    }
  }

  try {
    const benchmark = new PerformanceBenchmark(config);
    const results = await benchmark.runBenchmark();

    // Exit with appropriate code
    if (results.summary.overallErrorRate > 5) {
      console.log('\n❌ High error rate detected. Check server health.');
      process.exit(1);
    } else {
      console.log('\n✅ Benchmark completed successfully.');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

/**
 * Compare current and previous results only
 */
async function compareResults(config) {
  try {
    const data = await fs.readFile(config.outputFile, 'utf8');
    const results = JSON.parse(data);

    console.log('📊 Latest Benchmark Results:');
    console.log(`   Timestamp: ${results.timestamp}`);
    console.log(`   Average Response Time: ${results.summary.overallAvgResponseTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${results.summary.overallThroughput} req/sec`);
    console.log(`   Error Rate: ${results.summary.overallErrorRate.toFixed(2)}%`);

    if (results.comparison) {
      console.log('\n📈 Performance Improvements:');
      Object.entries(results.comparison).forEach(([metric, data]) => {
        console.log(`   ${metric}: ${data.improvement}%`);
      });
    }
  } catch (error) {
    console.log('❌ No benchmark results found');
  }
}

// Export for programmatic use
export default PerformanceBenchmark;
export { BENCHMARK_CONFIG, TEST_SCENARIOS };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}