import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set it in your .env file.');
}

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS is required in production. Set it in your .env file.');
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
