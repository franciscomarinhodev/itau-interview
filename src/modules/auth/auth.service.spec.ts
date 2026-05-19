import {
  CognitoIdentityProviderClient,
  InvalidPasswordException,
  NotAuthorizedException,
  TooManyRequestsException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { HttpException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';
const AWS_REGION = 'us-east-1';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const actual = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider',
  );
  return {
    ...actual,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

const mockAuthResult = {
  AccessToken: 'access-token',
  IdToken: 'id-token',
  RefreshToken: 'refresh-token',
  ExpiresIn: 3600,
  TokenType: 'Bearer',
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({ AWS_REGION, COGNITO_CLIENT_ID: CLIENT_ID, COGNITO_CLIENT_SECRET: CLIENT_SECRET })[key],
            get: (key: string) =>
              ({ AWS_REGION, COGNITO_CLIENT_ID: CLIENT_ID, COGNITO_CLIENT_SECRET: CLIENT_SECRET })[key],
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns tokens on successful authentication', async () => {
      mockSend.mockResolvedValue({ AuthenticationResult: mockAuthResult });

      const result = await service.login('user@example.com', 'P@ssw0rd!');

      expect(result).toEqual({
        accessToken: mockAuthResult.AccessToken,
        idToken: mockAuthResult.IdToken,
        refreshToken: mockAuthResult.RefreshToken,
        expiresIn: mockAuthResult.ExpiresIn,
        tokenType: mockAuthResult.TokenType,
      });
    });

    it('calls InitiateAuth with USER_PASSWORD_AUTH flow', async () => {
      mockSend.mockResolvedValue({ AuthenticationResult: mockAuthResult });

      await service.login('user@example.com', 'P@ssw0rd!');

      const call = mockSend.mock.calls[0][0];
      expect(call.input.AuthFlow).toBe('USER_PASSWORD_AUTH');
      expect(call.input.AuthParameters.USERNAME).toBe('user@example.com');
      expect(call.input.AuthParameters.PASSWORD).toBe('P@ssw0rd!');
      expect(call.input.AuthParameters.SECRET_HASH).toBeDefined();
    });

    it('throws UnauthorizedException on NotAuthorizedException', async () => {
      mockSend.mockRejectedValue(
        new NotAuthorizedException({
          message: 'Incorrect username or password',
          $metadata: {},
        }),
      );
      await expect(service.login('user@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on UserNotFoundException', async () => {
      mockSend.mockRejectedValue(
        new UserNotFoundException({
          message: 'User does not exist',
          $metadata: {},
        }),
      );
      await expect(service.login('ghost@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on InvalidPasswordException', async () => {
      mockSend.mockRejectedValue(
        new InvalidPasswordException({
          message: 'Invalid password',
          $metadata: {},
        }),
      );
      await expect(service.login('user@example.com', 'weak')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws HttpException 429 on TooManyRequestsException', async () => {
      mockSend.mockRejectedValue(
        new TooManyRequestsException({
          message: 'Too many requests',
          $metadata: {},
        }),
      );
      await expect(service.login('user@example.com', 'pass')).rejects.toThrow(
        HttpException,
      );
    });

    it('converts unknown errors to InternalServerErrorException', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));
      await expect(service.login('user@example.com', 'pass')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('refresh', () => {
    it('returns new access and id tokens', async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'new-access',
          IdToken: 'new-id',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      });

      const result = await service.refresh(
        'user@example.com',
        'old-refresh-token',
      );

      expect(result).toEqual({
        accessToken: 'new-access',
        idToken: 'new-id',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
    });

    it('calls InitiateAuth with REFRESH_TOKEN_AUTH flow', async () => {
      mockSend.mockResolvedValue({ AuthenticationResult: mockAuthResult });

      await service.refresh('user@example.com', 'my-refresh-token');

      const call = mockSend.mock.calls[0][0];
      expect(call.input.AuthFlow).toBe('REFRESH_TOKEN_AUTH');
      expect(call.input.AuthParameters.REFRESH_TOKEN).toBe('my-refresh-token');
      expect(call.input.AuthParameters.SECRET_HASH).toBeDefined();
    });

    it('throws UnauthorizedException on NotAuthorizedException', async () => {
      mockSend.mockRejectedValue(
        new NotAuthorizedException({ message: 'Invalid token', $metadata: {} }),
      );
      await expect(
        service.refresh('user@example.com', 'bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
