import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RefreshTokenDto } from './refresh-token.dto';

const build = (plain: object) => plainToInstance(RefreshTokenDto, plain);

const VALID_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.valid.refresh';

describe('RefreshTokenDto', () => {
  it('passes with valid username and refreshToken', async () => {
    const errors = await validate(
      build({
        username: 'user@example.com',
        refreshToken: VALID_REFRESH_TOKEN,
      }),
    );
    expect(errors).toHaveLength(0);
  });

  describe('username', () => {
    it('fails when missing', async () => {
      const errors = await validate(
        build({ refreshToken: VALID_REFRESH_TOKEN }),
      );
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(
        build({ username: '', refreshToken: VALID_REFRESH_TOKEN }),
      );
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('fails when missing', async () => {
      const errors = await validate(build({ username: 'user@example.com' }));
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });

    it('fails when empty string', async () => {
      const errors = await validate(
        build({ username: 'user@example.com', refreshToken: '' }),
      );
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });

    it('fails when not a string', async () => {
      const errors = await validate(
        build({ username: 'user@example.com', refreshToken: 123 }),
      );
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });
  });
});
