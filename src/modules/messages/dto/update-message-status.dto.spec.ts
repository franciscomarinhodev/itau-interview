import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateMessageStatusDto } from './update-message-status.dto';
import { MessageStatus } from '../entities/message.entity';

const build = (plain: object) => plainToInstance(UpdateMessageStatusDto, plain);

describe('UpdateMessageStatusDto', () => {
  it.each(Object.values(MessageStatus))('passes with valid status "%s"', async (status) => {
    const errors = await validate(build({ status }));
    expect(errors).toHaveLength(0);
  });

  it('fails when status is an unknown value', async () => {
    const errors = await validate(build({ status: 'deleted' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isEnum).toMatch(
      /sent.*recebido|sent|received|read/i,
    );
  });

  it('fails when status is missing', async () => {
    const errors = await validate(build({}));
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
