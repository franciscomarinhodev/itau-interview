import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateMessageDto } from './create-message.dto';

const build = (plain: object) => plainToInstance(CreateMessageDto, plain);

describe('CreateMessageDto', () => {
  it('passes with valid content and sender', async () => {
    const errors = await validate(build({ content: 'Hello', sender: 'alice' }));
    expect(errors).toHaveLength(0);
  });

  describe('content', () => {
    it('fails when missing', async () => {
      const errors = await validate(build({ sender: 'alice' }));
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(build({ content: '', sender: 'alice' }));
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when not a string', async () => {
      const errors = await validate(build({ content: 123, sender: 'alice' }));
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });
  });

  describe('sender', () => {
    it('fails when missing', async () => {
      const errors = await validate(build({ content: 'Hello' }));
      expect(errors.some((e) => e.property === 'sender')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(build({ content: 'Hello', sender: '' }));
      expect(errors.some((e) => e.property === 'sender')).toBe(true);
    });

    it('fails when not a string', async () => {
      const errors = await validate(build({ content: 'Hello', sender: 42 }));
      expect(errors.some((e) => e.property === 'sender')).toBe(true);
    });
  });
});
