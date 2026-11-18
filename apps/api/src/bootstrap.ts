import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    // SameSite + проверка Origin защищают cookie-endpoints от CSRF.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    ) {
      res.status(403).json({ message: 'Недопустимый Origin' });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
}
