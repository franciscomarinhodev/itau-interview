import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBMessagesRepository } from './dynamodb-messages.repository';
import { MessageStatus } from '../entities/message.entity';

const ALICE = '550e8400-e29b-41d4-a716-446655440000';

const mockClient = { send: jest.fn() } as unknown as DynamoDBDocumentClient;
const mockConfig = {
  get: jest.fn().mockReturnValue('Messages'),
} as unknown as ConfigService;

const rawItem = (overrides: object = {}) => ({
  PK: 'MSG#abc',
  SK: 'MSG#abc',
  id: 'abc',
  content: 'Hello',
  sender: ALICE,
  sentAt: '2025-02-10T14:00:00.000Z',
  status: MessageStatus.SENT,
  ...overrides,
});

describe('DynamoDBMessagesRepository', () => {
  let repository: DynamoDBMessagesRepository;

  beforeEach(() => {
    repository = new DynamoDBMessagesRepository(mockClient, mockConfig);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('calls putItem with correct key structure and returns domain entity', async () => {
      const putItem = jest
        .spyOn(repository as any, 'putItem')
        .mockResolvedValue(undefined);

      const result = await repository.create('Hello', ALICE);

      expect(result.content).toBe('Hello');
      expect(result.sender).toBe(ALICE);
      expect(result.status).toBe(MessageStatus.SENT);
      expect(result.sentAt).toBeInstanceOf(Date);

      const item = putItem.mock.calls[0][0] as Record<string, unknown>;
      expect(item.PK).toBe(`MSG#${result.id}`);
      expect(item.SK).toBe(`MSG#${result.id}`);
      expect(item.GSI_DATE_PK).toMatch(/^MESSAGES#\d{4}-\d{2}-\d{2}$/);
      expect(item.GSI_DATE_SK).toMatch(/^\d{4}-\d{2}-\d{2}T.*#.+$/);
      expect(item.GSI_SENDER_PK).toBe(`SENDER#${ALICE}`);
      expect(item.GSI_SENDER_SK).toMatch(/^\d{4}-\d{2}-\d{2}T.*#.+$/);
    });
  });

  describe('findById', () => {
    it('returns the entity when item is found', async () => {
      jest.spyOn(repository as any, 'getItem').mockResolvedValue(rawItem());

      const result = await repository.findById('abc');

      expect(result?.id).toBe('abc');
      expect(result?.content).toBe('Hello');
      expect(result?.sentAt).toBeInstanceOf(Date);
    });

    it('calls getItem with PK and SK keys', async () => {
      const getItem = jest
        .spyOn(repository as any, 'getItem')
        .mockResolvedValue(rawItem());

      await repository.findById('abc');

      expect(getItem).toHaveBeenCalledWith({ PK: 'MSG#abc', SK: 'MSG#abc' });
    });

    it('returns undefined when item is not found', async () => {
      jest.spyOn(repository as any, 'getItem').mockResolvedValue(undefined);

      expect(await repository.findById('ghost')).toBeUndefined();
    });
  });

  describe('findBySender', () => {
    it('calls queryItems on GSI_SENDER with the prefixed sender key', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([rawItem()]);

      const result = await repository.findBySender(ALICE);

      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'GSI_SENDER',
          expressionValues: { ':pk': `SENDER#${ALICE}` },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].sender).toBe(ALICE);
    });
  });

  describe('findByDateRange', () => {
    it('same-day range: single query using exact start and end times as SK bounds', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([rawItem()]);

      const start = new Date('2025-02-10T10:30:00.000Z');
      const end = new Date('2025-02-10T18:45:00.000Z');

      await repository.findByDateRange(start, end);

      expect(queryItems).toHaveBeenCalledTimes(1);
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'GSI_DATE',
          expressionValues: expect.objectContaining({
            ':pk': 'MESSAGES#2025-02-10',
            ':start': '2025-02-10T10:30:00.000Z#',
            ':end': '2025-02-10T18:45:00.000Z#~',
          }),
        }),
      );
    });

    it('multi-day range: queries once per day', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([]);

      const start = new Date('2025-02-10T09:00:00.000Z');
      const end = new Date('2025-02-12T17:00:00.000Z');

      await repository.findByDateRange(start, end);

      expect(queryItems).toHaveBeenCalledTimes(3);
    });

    it('multi-day range: first day uses startDate time, middle uses full bounds, last day uses endDate time', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([]);

      const start = new Date('2025-02-10T09:00:00.000Z');
      const end = new Date('2025-02-12T17:00:00.000Z');

      await repository.findByDateRange(start, end);

      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          expressionValues: expect.objectContaining({
            ':pk': 'MESSAGES#2025-02-10',
            ':start': '2025-02-10T09:00:00.000Z#',
            ':end': '2025-02-10T23:59:59.999Z#~',
          }),
        }),
      );
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          expressionValues: expect.objectContaining({
            ':pk': 'MESSAGES#2025-02-11',
            ':start': '2025-02-11T00:00:00.000Z#',
            ':end': '2025-02-11T23:59:59.999Z#~',
          }),
        }),
      );
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          expressionValues: expect.objectContaining({
            ':pk': 'MESSAGES#2025-02-12',
            ':start': '2025-02-12T00:00:00.000Z#',
            ':end': '2025-02-12T17:00:00.000Z#~',
          }),
        }),
      );
    });

    it('getDaysInRange returns ISO timestamp for first and last, date-only for middle days', () => {
      const start = new Date('2026-05-10T17:00:40.676Z');
      const end = new Date('2026-05-19T18:00:40.676Z');

      const days = (repository as any).getDaysInRange(start, end);

      expect(days[0]).toBe('2026-05-10T17:00:40.676Z');
      expect(days[days.length - 1]).toBe('2026-05-19T18:00:40.676Z');
      expect(days.slice(1, -1)).toEqual([
        '2026-05-11',
        '2026-05-12',
        '2026-05-13',
        '2026-05-14',
        '2026-05-15',
        '2026-05-16',
        '2026-05-17',
        '2026-05-18',
      ]);
      expect(days).toHaveLength(10);
    });
  });

  describe('findAll', () => {
    it('calls scanItems and maps all items', async () => {
      jest
        .spyOn(repository as any, 'scanItems')
        .mockResolvedValue([rawItem({ id: '1' }), rawItem({ id: '2' })]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('calls updateItem with PK and SK keys and returns updated entity', async () => {
      const updateItem = jest
        .spyOn(repository as any, 'updateItem')
        .mockResolvedValue(rawItem({ status: MessageStatus.READ }));

      const result = await repository.updateStatus('abc', MessageStatus.READ);

      expect(updateItem).toHaveBeenCalledWith(
        expect.objectContaining({ key: { PK: 'MSG#abc', SK: 'MSG#abc' } }),
      );
      expect(result?.status).toBe(MessageStatus.READ);
    });

    it('returns undefined when item does not exist', async () => {
      jest.spyOn(repository as any, 'updateItem').mockResolvedValue(undefined);

      expect(
        await repository.updateStatus('ghost', MessageStatus.READ),
      ).toBeUndefined();
    });
  });
});
