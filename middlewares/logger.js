const logger = (req, res, next) => {
  const now = new Date().toISOString();
  console.log(`🟢 [${now}] ${req.method} ${req.originalUrl}`);
  
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('📦 Body:', req.body);
  }

  next(); // Continuar con la siguiente función/middleware
};

module.exports = logger;
