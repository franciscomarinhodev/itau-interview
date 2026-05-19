import * as crypto from 'crypto';
import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  TooManyRequestsException,
  UserNotConfirmedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  HttpException,
  HttpStatus,
  Injectable,
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
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
    this.clientId = config.getOrThrow<string>('COGNITO_CLIENT_ID');
    this.clientSecret = config.getOrThrow<string>('COGNITO_CLIENT_SECRET');
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
            SECRET_HASH: this.secretHash(username),
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
      this.logger.warn(
        { username, error: (err as Error).name },
        'login failed',
      );
      this.handleCognitoError(err);
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
            SECRET_HASH: this.secretHash(username),
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
      this.logger.warn(
        { username, error: (err as Error).name },
        'token refresh failed',
      );
      this.handleCognitoError(err);
    }
  }

  // SECRET_HASH is required because the Cognito app client has generate_secret = true.
  // Formula: Base64(HMAC-SHA256(username + clientId, clientSecret))
  private secretHash(username: string): string {
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  private handleCognitoError(err: unknown): never {
    if (
      err instanceof NotAuthorizedException ||
      err instanceof UserNotFoundException ||
      err instanceof UserNotConfirmedException
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (err instanceof TooManyRequestsException) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw err;
  }
}
