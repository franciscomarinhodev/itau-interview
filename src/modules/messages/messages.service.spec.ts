import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryMessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './repositories/messages.repository.abstract';
import { MessageStatus } from './entities/message.entity';

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: MessagesRepository, useClass: InMemoryMessagesRepository },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('create', () => {
    it('creates a message with SENT status and a uuid', async () => {
      const msg = await service.create({ content: 'Hello', sender: 'alice' });

      expect(msg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(msg.content).toBe('Hello');
      expect(msg.sender).toBe('alice');
      expect(msg.status).toBe(MessageStatus.SENT);
      expect(msg.sentAt).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('returns the message when found', async () => {
      const created = await service.create({ content: 'Hi', sender: 'bob' });
      expect(await service.findById(created.id)).toEqual(created);
    });

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMany', () => {
    it('filters by sender', async () => {
      await service.create({ content: 'A', sender: 'alice' });
      await service.create({ content: 'B', sender: 'bob' });
      await service.create({ content: 'C', sender: 'alice' });

      const result = await service.findMany({ sender: 'alice' });

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.sender === 'alice')).toBe(true);
    });

    it('filters by date range', async () => {
      const before = new Date(Date.now() - 5000);
      await service.create({ content: 'Now', sender: 'carol' });
      const after = new Date(Date.now() + 5000);

      const result = await service.findMany({
        startDate: before.toISOString(),
        endDate: after.toISOString(),
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((m) => m.sender === 'carol')).toBe(true);
    });

    it('returns all messages from sender', async () => {
      await service.create({ content: 'X', sender: 'alice' });
      await service.create({ content: 'Y', sender: 'alice' });

      const result = await service.findMany({ sender: 'alice' });

      expect(result).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('updates the status of an existing message', async () => {
      const created = await service.create({ content: 'Hi', sender: 'alice' });
      const updated = await service.updateStatus(created.id, {
        status: MessageStatus.READ,
      });
      expect(updated.status).toBe(MessageStatus.READ);
    });

    it('throws NotFoundException for unknown id', async () => {
      await expect(
        service.updateStatus('ghost', { status: MessageStatus.RECEIVED }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
