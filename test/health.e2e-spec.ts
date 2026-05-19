import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DYNAMODB_CLIENT } from '../src/database/dynamodb.provider';

const BASE = '/api/v1/health';

const mockDynamoSend = jest.fn();

describe('Health API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DYNAMODB_CLIENT)
      .useValue({ send: mockDynamoSend })
      .compile();

    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  // ────────────────────────────────────── GET /health/liveness ─────────────

  describe('GET /health/liveness', () => {
    it('200 — always returns ok regardless of dependencies', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/liveness`)
        .expect(200);

      expect(body.status).toBe('ok');
    });

    it('200 — returns ok even when DynamoDB is down', async () => {
      mockDynamoSend.mockRejectedValue(new Error('DynamoDB unreachable'));

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/liveness`)
        .expect(200);

      expect(body.status).toBe('ok');
    });
  });

  // ───────────────────────────────────── GET /health/readiness ─────────────

  describe('GET /health/readiness', () => {
    it('200 — returns healthy status when DynamoDB responds', async () => {
      mockDynamoSend.mockResolvedValue({ Items: [], Count: 0 });

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/readiness`)
        .expect(200);

      expect(body.status).toBe('ok');
      expect(body.info.dynamodb.status).toBe('up');
    });

    it('503 — returns unhealthy status when DynamoDB is unreachable', async () => {
      mockDynamoSend.mockRejectedValue(new Error('Connection refused'));

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/readiness`)
        .expect(503);

      expect(body.status).toBe('error');
      expect(body.error.dynamodb.status).toBe('down');
    });
  });
});
