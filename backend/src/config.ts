import 'dotenv/config';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
