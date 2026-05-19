import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './repositories/messages.repository.abstract';
import { Message, MessageStatus } from './entities/message.entity';

const ALICE = '550e8400-e29b-41d4-a716-446655440000';
const BOB = '550e8400-e29b-41d4-a716-446655440001';
const CAROL = '550e8400-e29b-41d4-a716-446655440002';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'uuid-1',
  content: 'Hello',
  sender: ALICE,
  status: MessageStatus.SENT,
  sentAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('MessagesService', () => {
  let service: MessagesService;
  let repo: jest.Mocked<MessagesRepository>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySender: jest.fn(),
      findByDateRange: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<MessagesRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: MessagesRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('create', () => {
    it('delegates to repository and returns the created message', async () => {
      const message = makeMessage();
      repo.create.mockResolvedValue(message);

      const result = await service.create({ content: 'Hello', sender: ALICE });

      expect(repo.create).toHaveBeenCalledWith('Hello', ALICE);
      expect(result).toEqual(message);
    });
  });

  describe('findById', () => {
    it('returns the message when found', async () => {
      const message = makeMessage({ id: 'uuid-42' });
      repo.findById.mockResolvedValue(message);

      const result = await service.findById('uuid-42');

      expect(repo.findById).toHaveBeenCalledWith('uuid-42');
      expect(result).toEqual(message);
    });

    it('throws NotFoundException when repository returns undefined', async () => {
      repo.findById.mockResolvedValue(undefined);

      await expect(service.findById('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMany', () => {
    it('delegates to findBySender when sender is provided', async () => {
      const messages = [makeMessage(), makeMessage({ id: 'uuid-2' })];
      repo.findBySender.mockResolvedValue(messages);

      const result = await service.findMany({ sender: ALICE });

      expect(repo.findBySender).toHaveBeenCalledWith(ALICE);
      expect(result).toEqual(messages);
    });

    it('delegates to findByDateRange when date range is provided', async () => {
      const start = '2024-01-01T00:00:00.000Z';
      const end = '2024-01-02T00:00:00.000Z';
      const messages = [makeMessage({ sender: CAROL })];
      repo.findByDateRange.mockResolvedValue(messages);

      const result = await service.findMany({ startDate: start, endDate: end });

      expect(repo.findByDateRange).toHaveBeenCalledWith(
        new Date(start),
        new Date(end),
      );
      expect(result).toEqual(messages);
    });

    it('returns empty array when sender has no messages', async () => {
      repo.findBySender.mockResolvedValue([]);

      const result = await service.findMany({ sender: BOB });

      expect(result).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('updates and returns the message with the new status', async () => {
      const updated = makeMessage({ status: MessageStatus.READ });
      repo.findById.mockResolvedValue(makeMessage());
      repo.updateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus('uuid-1', {
        status: MessageStatus.READ,
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        'uuid-1',
        MessageStatus.READ,
      );
      expect(result.status).toBe(MessageStatus.READ);
    });

    it('throws NotFoundException when message does not exist', async () => {
      repo.findById.mockResolvedValue(undefined);

      await expect(
        service.updateStatus('ghost', { status: MessageStatus.RECEIVED }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
