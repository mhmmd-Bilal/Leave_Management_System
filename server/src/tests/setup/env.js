// Runs before every test file, BEFORE the app is imported (config/env.js reads process.env once).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.BCRYPT_ROUNDS = "4";
process.env.EXPOSE_TOKEN_IN_BODY = "true";
process.env.LOGIN_RATE_LIMIT_MAX = "100000";
process.env.RATE_LIMIT_MAX = "100000";
process.env.SMTP_HOST = "";
