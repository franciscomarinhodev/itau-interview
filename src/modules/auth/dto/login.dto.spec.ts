import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

const build = (plain: object) => plainToInstance(LoginDto, plain);

describe('LoginDto', () => {
  it('passes with valid username and password', async () => {
    const errors = await validate(
      build({ username: 'user@example.com', password: 'P@ssw0rd!' }),
    );
    expect(errors).toHaveLength(0);
  });

  describe('username', () => {
    it('fails when missing', async () => {
      const errors = await validate(build({ password: 'P@ssw0rd!' }));
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(
        build({ username: '', password: 'P@ssw0rd!' }),
      );
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('fails when not a string', async () => {
      const errors = await validate(
        build({ username: 123, password: 'P@ssw0rd!' }),
      );
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });
  });

  describe('password', () => {
    it('fails when missing', async () => {
      const errors = await validate(build({ username: 'user@example.com' }));
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(
        build({ username: 'user@example.com', password: '' }),
      );
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('fails when not a string', async () => {
      const errors = await validate(
        build({ username: 'user@example.com', password: 123 }),
      );
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });
});
