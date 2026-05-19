import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { QueryMessagesDto } from './query-messages.dto';

const SENDER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const START = '2025-02-10T00:00:00.000Z';
const END = '2025-02-10T23:59:59.000Z';

const build = (plain: object) => plainToInstance(QueryMessagesDto, plain);

describe('QueryMessagesDto', () => {
  describe('no filters', () => {
    it('fails when no params are provided', async () => {
      const errors = await validate(build({}));
      expect(errors.length).toBeGreaterThan(0);
      const messages = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}),
      );
      expect(
        messages.some((m) => m.includes('sender') || m.includes('startDate')),
      ).toBe(true);
    });
  });

  describe('sender filter', () => {
    it('passes with a valid sender UUID', async () => {
      const errors = await validate(build({ sender: SENDER_UUID }));
      expect(errors).toHaveLength(0);
    });

    it('passes with sender even when dates are absent', async () => {
      const errors = await validate(build({ sender: SENDER_UUID }));
      expect(errors).toHaveLength(0);
    });

    it('fails when sender is not a valid UUID', async () => {
      const errors = await validate(build({ sender: 'not-a-uuid' }));
      expect(errors.some((e) => e.property === 'sender')).toBe(true);
    });

    it('fails when sender is not a string', async () => {
      const errors = await validate(build({ sender: 123 }));
      expect(errors.some((e) => e.property === 'sender')).toBe(true);
    });
  });

  describe('date range filter', () => {
    it('passes with both startDate and endDate', async () => {
      const errors = await validate(build({ startDate: START, endDate: END }));
      expect(errors).toHaveLength(0);
    });

    it('fails when only startDate is provided', async () => {
      const errors = await validate(build({ startDate: START }));
      expect(errors.some((e) => e.property === 'endDate')).toBe(true);
    });

    it('fails when only endDate is provided', async () => {
      const errors = await validate(build({ endDate: END }));
      expect(errors.some((e) => e.property === 'startDate')).toBe(true);
    });

    it('fails when startDate is not a valid ISO 8601 date', async () => {
      const errors = await validate(
        build({ startDate: 'not-a-date', endDate: END }),
      );
      const messages = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}),
      );
      expect(messages.some((m) => m.includes('ISO 8601'))).toBe(true);
    });

    it('fails when endDate is not a valid ISO 8601 date', async () => {
      const errors = await validate(
        build({ startDate: START, endDate: 'bad' }),
      );
      const messages = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}),
      );
      expect(messages.some((m) => m.includes('ISO 8601'))).toBe(true);
    });
  });

  describe('sender takes priority over dates', () => {
    it('passes when sender UUID is present even with missing dates', async () => {
      const errors = await validate(build({ sender: SENDER_UUID }));
      expect(errors).toHaveLength(0);
    });

    it('passes when all three params are provided', async () => {
      const errors = await validate(
        build({ sender: SENDER_UUID, startDate: START, endDate: END }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
