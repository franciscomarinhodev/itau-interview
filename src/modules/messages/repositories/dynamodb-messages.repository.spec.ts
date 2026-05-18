import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBMessagesRepository } from './dynamodb-messages.repository';
import { MessageStatus } from '../entities/message.entity';

const mockClient = { send: jest.fn() } as unknown as DynamoDBDocumentClient;

const rawItem = (overrides: object = {}) => ({
  PK: 'MSG#abc',
  SK: 'MSG#abc',
  id: 'abc',
  content: 'Hello',
  sender: 'alice',
  sentAt: '2025-02-10T14:00:00.000Z',
  status: MessageStatus.SENT,
  ...overrides,
});

describe('DynamoDBMessagesRepository', () => {
  let repository: DynamoDBMessagesRepository;

  beforeEach(() => {
    repository = new DynamoDBMessagesRepository(mockClient);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('calls putItem with correct key structure and returns domain entity', async () => {
      const putItem = jest
        .spyOn(repository as any, 'putItem')
        .mockResolvedValue(undefined);

      const result = await repository.create('Hello', 'alice');

      expect(result.content).toBe('Hello');
      expect(result.sender).toBe('alice');
      expect(result.status).toBe(MessageStatus.SENT);
      expect(result.sentAt).toBeInstanceOf(Date);

      const item = putItem.mock.calls[0][0] as Record<string, unknown>;
      expect(item.PK).toBe(`MSG#${result.id}`);
      expect(item.SK).toBe(`MSG#${result.id}`);
      expect(item.GSI_DATE_PK).toMatch(/^MESSAGES#\d{4}-\d{2}-\d{2}$/);
      expect(item.GSI_DATE_SK).toMatch(/^\d{4}-\d{2}-\d{2}T.*#.+$/);
      expect(item.GSI_SENDER_PK).toBe('SENDER#alice');
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

      const result = await repository.findBySender('alice');

      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'GSI_SENDER',
          expressionValues: { ':pk': 'SENDER#alice' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].sender).toBe('alice');
    });
  });

  describe('findByDateRange', () => {
    it('queries GSI_DATE once for a same-day range', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([rawItem()]);

      const start = new Date('2025-02-10T00:00:00.000Z');
      const end = new Date('2025-02-10T23:59:59.000Z');

      await repository.findByDateRange(start, end);

      expect(queryItems).toHaveBeenCalledTimes(1);
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'GSI_DATE',
          expressionValues: expect.objectContaining({ ':pk': 'MESSAGES#2025-02-10' }),
        }),
      );
    });

    it('queries once per day for a multi-day range', async () => {
      const queryItems = jest
        .spyOn(repository as any, 'queryItems')
        .mockResolvedValue([]);

      const start = new Date('2025-02-10T00:00:00.000Z');
      const end = new Date('2025-02-12T23:59:59.000Z');

      await repository.findByDateRange(start, end);

      expect(queryItems).toHaveBeenCalledTimes(3);
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({ expressionValues: expect.objectContaining({ ':pk': 'MESSAGES#2025-02-10' }) }),
      );
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({ expressionValues: expect.objectContaining({ ':pk': 'MESSAGES#2025-02-11' }) }),
      );
      expect(queryItems).toHaveBeenCalledWith(
        expect.objectContaining({ expressionValues: expect.objectContaining({ ':pk': 'MESSAGES#2025-02-12' }) }),
      );
    });

    it('filters out items outside the exact range boundaries', async () => {
      const start = new Date('2025-02-10T12:00:00.000Z');
      const end = new Date('2025-02-10T18:00:00.000Z');

      jest.spyOn(repository as any, 'queryItems').mockResolvedValue([
        rawItem({ sentAt: '2025-02-10T10:00:00.000Z' }), // before start — excluded
        rawItem({ id: 'in', sentAt: '2025-02-10T14:00:00.000Z' }), // within range
        rawItem({ sentAt: '2025-02-10T20:00:00.000Z' }), // after end — excluded
      ]);

      const result = await repository.findByDateRange(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('in');
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

      expect(await repository.updateStatus('ghost', MessageStatus.READ)).toBeUndefined();
    });
  });
});
