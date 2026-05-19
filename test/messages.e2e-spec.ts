import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DYNAMODB_CLIENT } from '../src/database/dynamodb.provider';
import { InMemoryMessagesRepository } from '../src/modules/messages/messages.repository';
import { MessagesRepository } from '../src/modules/messages/repositories/messages.repository.abstract';

const BASE = '/api/v1/messages';

const ALICE = '550e8400-e29b-41d4-a716-446655440000';
const BOB = '550e8400-e29b-41d4-a716-446655440001';
const CAROL = '550e8400-e29b-41d4-a716-446655440002';
const NO_MESSAGES_SENDER = '550e8400-e29b-41d4-a716-446655440099';

describe('Messages API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DYNAMODB_CLIENT)
      .useValue({ send: jest.fn() })
      .overrideProvider(MessagesRepository)
      .useClass(InMemoryMessagesRepository)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
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
  });

  afterEach(() => app.close());

  // ─────────────────────────────────────────────────────────── helpers ──────

  const createMessage = (body = { content: 'Hello', sender: ALICE }) =>
    request(app.getHttpServer()).post(BASE).send(body);

  // ────────────────────────────────────────────────── POST /messages ────────

  describe('POST /messages', () => {
    it('201 — creates a message and returns all required fields', async () => {
      const { body } = await createMessage().expect(201);

      expect(body.id).toBeDefined();
      expect(body.content).toBe('Hello');
      expect(body.sender).toBe(ALICE);
      expect(body.status).toBe('sent');
      expect(new Date(body.sentAt).toString()).not.toBe('Invalid Date');
    });

    it('201 — status defaults to "sent"', async () => {
      const { body } = await createMessage().expect(201);
      expect(body.status).toBe('sent');
    });

    it('400 — missing content', async () => {
      await createMessage({ content: '', sender: ALICE }).expect(400);
    });

    it('400 — missing sender', async () => {
      await createMessage({ content: 'Hello', sender: '' }).expect(400);
    });

    it('400 — non-string content', async () => {
      await request(app.getHttpServer())
        .post(BASE)
        .send({ content: 123, sender: ALICE })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────── GET /messages/:id ──────────

  describe('GET /messages/:id', () => {
    it('200 — returns the message when found', async () => {
      const { body: created } = await createMessage().expect(201);

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/${created.id}`)
        .expect(200);

      expect(body.id).toBe(created.id);
      expect(body.content).toBe('Hello');
      expect(body.sender).toBe(ALICE);
    });

    it('404 — message not found', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/non-existent-id`)
        .expect(404);
    });
  });

  // ──────────────────────────────────── GET /messages?sender=... ───────────

  describe('GET /messages?sender=...', () => {
    it('200 — returns messages filtered by sender', async () => {
      await createMessage({ content: 'A', sender: ALICE });
      await createMessage({ content: 'B', sender: BOB });
      await createMessage({ content: 'C', sender: ALICE });

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}?sender=${ALICE}`)
        .expect(200);

      expect(body).toHaveLength(2);
      expect(body.every((m: { sender: string }) => m.sender === ALICE)).toBe(
        true,
      );
    });

    it('200 — returns empty array when sender has no messages', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${BASE}?sender=${NO_MESSAGES_SENDER}`)
        .expect(200);

      expect(body).toEqual([]);
    });
  });

  // ─────────────────────────────── PATCH /messages/:id/status ─────────────

  describe('PATCH /messages/:id/status', () => {
    it('200 — updates status to "received"', async () => {
      const { body: created } = await createMessage().expect(201);

      const { body } = await request(app.getHttpServer())
        .patch(`${BASE}/${created.id}/status`)
        .send({ status: 'received' })
        .expect(200);

      expect(body.status).toBe('received');
      expect(body.id).toBe(created.id);
    });

    it('200 — updates status to "read"', async () => {
      const { body: created } = await createMessage().expect(201);

      const { body } = await request(app.getHttpServer())
        .patch(`${BASE}/${created.id}/status`)
        .send({ status: 'read' })
        .expect(200);

      expect(body.status).toBe('read');
    });

    it('200 — status change is persisted (GET confirms update)', async () => {
      const { body: created } = await createMessage().expect(201);

      await request(app.getHttpServer())
        .patch(`${BASE}/${created.id}/status`)
        .send({ status: 'read' });

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}/${created.id}`)
        .expect(200);

      expect(body.status).toBe('read');
    });

    it('400 — invalid status value', async () => {
      const { body: created } = await createMessage().expect(201);

      await request(app.getHttpServer())
        .patch(`${BASE}/${created.id}/status`)
        .send({ status: 'deleted' })
        .expect(400);
    });

    it('404 — message not found', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/ghost/status`)
        .send({ status: 'read' })
        .expect(404);
    });
  });

  // ──────────────────────── GET /messages?startDate=...&endDate=... ────────

  describe('GET /messages?startDate=...&endDate=...', () => {
    it('200 — returns messages within the date range', async () => {
      await createMessage({ content: 'In range', sender: CAROL });

      const start = new Date(Date.now() - 5000).toISOString();
      const end = new Date(Date.now() + 5000).toISOString();

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}?startDate=${start}&endDate=${end}`)
        .expect(200);

      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.some((m: { sender: string }) => m.sender === CAROL)).toBe(
        true,
      );
    });

    it('200 — returns empty array when no messages in range', async () => {
      const start = new Date('2000-01-01T00:00:00.000Z').toISOString();
      const end = new Date('2000-01-02T00:00:00.000Z').toISOString();

      const { body } = await request(app.getHttpServer())
        .get(`${BASE}?startDate=${start}&endDate=${end}`)
        .expect(200);

      expect(body).toEqual([]);
    });

    it('400 — missing endDate', async () => {
      const start = new Date().toISOString();
      await request(app.getHttpServer())
        .get(`${BASE}?startDate=${start}`)
        .expect(400);
    });

    it('400 — missing startDate', async () => {
      const end = new Date().toISOString();
      await request(app.getHttpServer())
        .get(`${BASE}?endDate=${end}`)
        .expect(400);
    });

    it('400 — invalid ISO date format for startDate', async () => {
      const end = new Date().toISOString();
      await request(app.getHttpServer())
        .get(`${BASE}?startDate=not-a-date&endDate=${end}`)
        .expect(400);
    });
  });

  // ──────────────────────────────────── GET /messages (no filters) ─────────

  describe('GET /messages (no filters)', () => {
    it('400 — requires "sender" or "startDate" + "endDate"', async () => {
      const { body } = await request(app.getHttpServer()).get(BASE).expect(400);

      expect(body.statusCode).toBe(400);
      expect(body.message).toBeDefined();
    });
  });
});
