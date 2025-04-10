const prometheus = require('prom-client');

// Create a Registry which registers the metrics
const register = new prometheus.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'server'
});


// Enable the collection of default metrics

prometheus.collectDefaultMetrics({ register });
// Set up a histogram for request duration
const httpRequestDurationSeconds = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  registers: [register],
  buckets: [0.1, 0.5, 1, 2, 5, 10] // Customize the buckets as needed
});

register.registerMetric(httpRequestDurationSeconds);

// Middleware to measure request duration
const metricsDurationMiddleware = (req, res, next) => {
  const end = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
};

// Middleware to count api request on single path
const apiCallCounter = new prometheus.Counter({
    name: 'api_calls_total',
    help: 'Total number of API calls',
    labelNames: ['method', 'route']
  });
  
register.registerMetric(apiCallCounter);

const apiCallMiddleware = (req, res, next) => {
    res.on('finish', () => {
        const route = req.route?.path || req.path;
        apiCallCounter.inc({ method: req.method, route });
      });
      next();
}

// DATABASE

const dbQueryDuration = new prometheus.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2]
  });
  
register.registerMetric(dbQueryDuration);

module.exports = {
    register,
    metricsDurationMiddleware,
    apiCallMiddleware,
    dbQueryDuration
    };