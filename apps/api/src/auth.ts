import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { Database } from './database';
import { parse, publicUser } from './validation';

export type Identity = { sub: string; role: 'USER' | 'ADMIN' };
export type AuthRequest = Request & { user: Identity };
const credentials = z
  .object({
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,32}$/),
    password: z.string().min(8).max(128),
  })
  .strict();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieName = 'transit_refresh';
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'strict' as const,
  path: '/api/auth',
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  async issue(user: Identity) {
    const sid = randomUUID();
    const refresh = await this.jwt.signAsync(
      { sub: user.sub, sid, kind: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: '7d' },
    );
    await this.db.refreshSession.create({
      data: {
        id: sid,
        userId: user.sub,
        tokenHash: hash(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      accessToken: await this.jwt.signAsync(
        { ...user, kind: 'access' },
        { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: '15m' },
      ),
      refresh,
    };
  }
  async rotate(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Сессия истекла');
    let payload: { sub: string; sid: string; kind: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET! });
    } catch {
      throw new UnauthorizedException('Сессия истекла');
    }
    if (payload.kind !== 'refresh') throw new UnauthorizedException();
    // deleteMany — атомарное потребление: две параллельные ротации не пройдут.
    const consumed = await this.db.refreshSession.deleteMany({
      where: {
        id: payload.sid,
        userId: payload.sub,
        tokenHash: hash(token),
        expiresAt: { gt: new Date() },
      },
    });
    if (!consumed.count) throw new UnauthorizedException('Сессия уже использована');
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: publicUser,
    });
    return { ...(await this.issue({ sub: user.id, role: user.role })), user };
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private jwt: JwtService,
    @Inject(Database) private db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Войдите в аккаунт');
    let payload: Identity & { kind: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET! });
    } catch {
      throw new UnauthorizedException('Токен истёк');
    }
    if (payload.kind !== 'access') throw new UnauthorizedException();
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    req.user = { sub: user.id, role: user.role };
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (context.switchToHttp().getRequest<AuthRequest>().user.role !== 'ADMIN')
      throw new ForbiddenException('Только для администратора');
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  private async response(user: { id: string; role: 'USER' | 'ADMIN' }, res: Response) {
    const tokens = await this.auth.issue({ sub: user.id, role: user.role });
    res.cookie(cookieName, tokens.refresh, { ...cookieOptions(), maxAge: 7 * 86400000 });
    return { accessToken: tokens.accessToken, user };
  }
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = parse(credentials.extend({ name: z.string().trim().min(2).max(60) }), body);
    const passwordHash = await argon2.hash(data.password);
    const user = await this.db.user
      .create({ data: { login: data.login, name: data.name, passwordHash }, select: publicUser })
      .catch((error: { code?: string }) => {
        if (error.code === 'P2002') throw new ConflictException('Этот логин уже занят');
        throw error;
      });
    return this.response(user, res);
  }
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = parse(credentials, body);
    const user = await this.db.user.findUnique({ where: { login: data.login } });
    if (!user || !(await argon2.verify(user.passwordHash, data.password)))
      throw new UnauthorizedException('Неверный логин или пароль');
    const { passwordHash: _, ...safe } = user;
    return this.response(safe, res);
  }
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.rotate(req.cookies?.[cookieName]);
    res.cookie(cookieName, result.refresh, { ...cookieOptions(), maxAge: 7 * 86400000 });
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[cookieName];
    if (typeof token === 'string')
      await this.db.refreshSession.deleteMany({ where: { tokenHash: hash(token) } });
    res.clearCookie(cookieName, cookieOptions());
    return { ok: true };
  }
  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthRequest) {
    return this.db.user.findUniqueOrThrow({ where: { id: req.user.sub }, select: publicUser });
  }
}
