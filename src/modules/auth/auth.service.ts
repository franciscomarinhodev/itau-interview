import * as crypto from 'crypto';
import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InvalidPasswordException,
  NotAuthorizedException,
  ResourceNotFoundException,
  TooManyRequestsException,
  UserNotConfirmedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('COGNITO_ENDPOINT');
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow<string>('AWS_REGION'),
      ...(endpoint && { endpoint }),
    });
    this.clientId = config.getOrThrow<string>('COGNITO_CLIENT_ID');
    if (!this.clientId) {
      throw new Error(
        'COGNITO_CLIENT_ID is empty — run: docker compose up cognito-setup, then copy the printed IDs into .env.local',
      );
    }
    // Empty in local dev (cognito-local client has no secret); set in production.
    this.clientSecret = config.get<string>('COGNITO_CLIENT_SECRET') ?? '';
  }

  async login(username: string, password: string) {
    this.logger.log({ username }, 'login attempt');
    try {
      const { AuthenticationResult } = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            ...this.secretHashParam(username),
          },
        }),
      );

      this.logger.log({ username }, 'login successful');
      return {
        accessToken: AuthenticationResult!.AccessToken,
        idToken: AuthenticationResult!.IdToken,
        refreshToken: AuthenticationResult!.RefreshToken,
        expiresIn: AuthenticationResult!.ExpiresIn,
        tokenType: AuthenticationResult!.TokenType,
      };
    } catch (err) {
      this.handleCognitoError(err, { username, operation: 'login' });
    }
  }

  async refresh(username: string, refreshToken: string) {
    this.logger.log({ username }, 'token refresh attempt');
    try {
      const { AuthenticationResult } = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
            ...this.secretHashParam(username),
          },
        }),
      );

      this.logger.log({ username }, 'token refresh successful');
      return {
        accessToken: AuthenticationResult!.AccessToken,
        idToken: AuthenticationResult!.IdToken,
        expiresIn: AuthenticationResult!.ExpiresIn,
        tokenType: AuthenticationResult!.TokenType,
      };
    } catch (err) {
      this.handleCognitoError(err, { username, operation: 'refresh' });
    }
  }

  // Returns { SECRET_HASH } when the client has a secret (production), or {}
  // when it does not (local dev with cognito-local, which has no client secret).
  private secretHashParam(username: string): Record<string, string> {
    if (!this.clientSecret) return {};
    return {
      SECRET_HASH: crypto
        .createHmac('sha256', this.clientSecret)
        .update(username + this.clientId)
        .digest('base64'),
    };
  }

  private handleCognitoError(
    err: unknown,
    ctx: { username: string; operation: string },
  ): never {
    const name = (err as Error)?.name ?? '';

    if (
      err instanceof NotAuthorizedException ||
      err instanceof UserNotFoundException ||
      err instanceof UserNotConfirmedException ||
      err instanceof InvalidPasswordException ||
      name === 'NotAuthorizedException' ||
      name === 'UserNotFoundException' ||
      name === 'UserNotConfirmedException' ||
      name === 'InvalidPasswordException'
    ) {
      this.logger.warn({ ...ctx, error: name }, 'authentication failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      err instanceof TooManyRequestsException ||
      name === 'TooManyRequestsException'
    ) {
      this.logger.warn({ ...ctx }, 'cognito rate limit reached');
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      err instanceof ResourceNotFoundException ||
      name === 'ResourceNotFoundException'
    ) {
      this.logger.error(
        { ...ctx, message: (err as Error).message },
        'cognito resource not found — verify COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID in .env.local',
      );
      throw new InternalServerErrorException('Authentication service error');
    }

    this.logger.error(
      { ...ctx, errorName: name, errorMessage: (err as Error)?.message, err },
      'unexpected cognito error',
    );
    throw new InternalServerErrorException('Authentication service error');
  }
}
