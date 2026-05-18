import { InMemoryMessagesRepository } from './messages.repository';
import { MessageStatus } from './entities/message.entity';

describe('InMemoryMessagesRepository', () => {
  let repository: InMemoryMessagesRepository;

  beforeEach(() => {
    repository = new InMemoryMessagesRepository();
  });

  describe('create', () => {
    it('returns a message with uuid, SENT status and a sentAt date', async () => {
      const msg = await repository.create('Hello', 'alice');

      expect(msg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(msg.content).toBe('Hello');
      expect(msg.sender).toBe('alice');
      expect(msg.status).toBe(MessageStatus.SENT);
      expect(msg.sentAt).toBeInstanceOf(Date);
    });

    it('generates unique IDs for each message', async () => {
      const a = await repository.create('A', 'alice');
      const b = await repository.create('B', 'alice');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('findById', () => {
    it('returns the message when it exists', async () => {
      const created = await repository.create('Hi', 'bob');
      expect(await repository.findById(created.id)).toEqual(created);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.findById('ghost')).toBeUndefined();
    });
  });

  describe('findBySender', () => {
    it('returns only messages from the given sender', async () => {
      await repository.create('A', 'alice');
      await repository.create('B', 'bob');
      await repository.create('C', 'alice');

      const result = await repository.findBySender('alice');

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.sender === 'alice')).toBe(true);
    });

    it('returns empty array when sender has no messages', async () => {
      expect(await repository.findBySender('unknown')).toEqual([]);
    });
  });

  describe('findByDateRange', () => {
    it('returns messages within the range', async () => {
      const before = new Date(Date.now() - 5000);
      const created = await repository.create('Now', 'carol');
      const after = new Date(Date.now() + 5000);

      const result = await repository.findByDateRange(before, after);

      expect(result).toContainEqual(created);
    });

    it('excludes messages outside the range', async () => {
      await repository.create('Old', 'carol');
      const start = new Date(Date.now() + 10000);
      const end = new Date(Date.now() + 20000);

      const result = await repository.findByDateRange(start, end);

      expect(result).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('returns all stored messages', async () => {
      await repository.create('A', 'alice');
      await repository.create('B', 'bob');

      expect(await repository.findAll()).toHaveLength(2);
    });

    it('returns empty array when store is empty', async () => {
      expect(await repository.findAll()).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('updates and returns the message with the new status', async () => {
      const created = await repository.create('Hi', 'alice');
      const updated = await repository.updateStatus(created.id, MessageStatus.READ);

      expect(updated?.status).toBe(MessageStatus.READ);
      expect(updated?.id).toBe(created.id);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.updateStatus('ghost', MessageStatus.READ)).toBeUndefined();
    });

    it('persists the status change', async () => {
      const created = await repository.create('Hi', 'alice');
      await repository.updateStatus(created.id, MessageStatus.RECEIVED);

      const found = await repository.findById(created.id);
      expect(found?.status).toBe(MessageStatus.RECEIVED);
    });
  });
});
