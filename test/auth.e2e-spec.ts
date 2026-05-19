import {
  HttpException,
  HttpStatus,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';

const BASE = '/api/v1/auth';

const mockLogin = jest.fn();
const mockRefresh = jest.fn();

const mockTokens = {
  accessToken: 'eyJ.access.token',
  idToken: 'eyJ.id.token',
  refreshToken: 'eyJ.refresh.token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

const mockRefreshedTokens = {
  accessToken: 'eyJ.new.access.token',
  idToken: 'eyJ.new.id.token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({ login: mockLogin, refresh: mockRefresh })
      .compile();

    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    );
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  // ──────────────────────────────────────── POST /auth/login ────────────────

  describe('POST /auth/login', () => {
    it('200 — returns tokens on valid credentials', async () => {
      mockLogin.mockResolvedValue(mockTokens);

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com', password: 'P@ssw0rd!' })
        .expect(200);

      expect(body.accessToken).toBeDefined();
      expect(body.idToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.expiresIn).toBe(3600);
      expect(body.tokenType).toBe('Bearer');
    });

    it('200 — forwards username and password to AuthService', async () => {
      mockLogin.mockResolvedValue(mockTokens);

      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com', password: 'P@ssw0rd!' })
        .expect(200);

      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'P@ssw0rd!');
    });

    it('400 — missing username', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ password: 'P@ssw0rd!' })
        .expect(400);
    });

    it('400 — missing password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com' })
        .expect(400);
    });

    it('400 — empty username', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: '', password: 'P@ssw0rd!' })
        .expect(400);
    });

    it('400 — empty password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com', password: '' })
        .expect(400);
    });

    it('400 — extra fields are rejected (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({
          username: 'user@example.com',
          password: 'P@ssw0rd!',
          role: 'admin',
        })
        .expect(400);
    });

    it('401 — invalid credentials', async () => {
      mockLogin.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com', password: 'wrong' })
        .expect(401);

      expect(body.message).toBe('Invalid credentials');
    });

    it('429 — Cognito rate limit exceeded', async () => {
      mockLogin.mockRejectedValue(
        new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      );

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ username: 'user@example.com', password: 'P@ssw0rd!' })
        .expect(429);

      expect(body.message).toBe('Too many requests');
    });
  });

  // ─────────────────────────────────────── POST /auth/refresh ──────────────

  describe('POST /auth/refresh', () => {
    it('200 — returns new access and id tokens', async () => {
      mockRefresh.mockResolvedValue(mockRefreshedTokens);

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({
          username: 'user@example.com',
          refreshToken: 'eyJ.refresh.token',
        })
        .expect(200);

      expect(body.accessToken).toBeDefined();
      expect(body.idToken).toBeDefined();
      expect(body.expiresIn).toBe(3600);
      expect(body.tokenType).toBe('Bearer');
    });

    it('200 — does not return a new refreshToken', async () => {
      mockRefresh.mockResolvedValue(mockRefreshedTokens);

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({
          username: 'user@example.com',
          refreshToken: 'eyJ.refresh.token',
        })
        .expect(200);

      expect(body.refreshToken).toBeUndefined();
    });

    it('200 — forwards username and refreshToken to AuthService', async () => {
      mockRefresh.mockResolvedValue(mockRefreshedTokens);

      await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({
          username: 'user@example.com',
          refreshToken: 'eyJ.refresh.token',
        })
        .expect(200);

      expect(mockRefresh).toHaveBeenCalledWith(
        'user@example.com',
        'eyJ.refresh.token',
      );
    });

    it('400 — missing username', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({ refreshToken: 'eyJ.refresh.token' })
        .expect(400);
    });

    it('400 — missing refreshToken', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({ username: 'user@example.com' })
        .expect(400);
    });

    it('400 — empty refreshToken', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({ username: 'user@example.com', refreshToken: '' })
        .expect(400);
    });

    it('401 — expired or invalid refresh token', async () => {
      mockRefresh.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const { body } = await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .send({ username: 'user@example.com', refreshToken: 'expired-token' })
        .expect(401);

      expect(body.message).toBe('Invalid credentials');
    });
  });
});
