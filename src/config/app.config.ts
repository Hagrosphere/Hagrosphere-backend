export const AppConfig = () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.REDIS_TTL ?? '3600', 10), // seconds
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },

  cookie: {
    secret: process.env.COOKIE_SECRET,
    sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    secure: process.env.NODE_ENV === 'production',
  },

  cors: {
    origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER ?? 'hagrosphere',
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM ?? 'Hagrosphere <no-reply@hagrosphere.com>',
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@hagrosphere.com',
  },

  throttle: {
    // Auth endpoints: much tighter limits
    authTtl: 60_000,
    authLimit: 5,
    // General
    globalTtl: 60_000,
    globalLimit: 200,
  },
});
