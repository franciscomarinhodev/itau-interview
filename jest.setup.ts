import { Logger } from '@nestjs/common';

// Provide fallback env vars so services that call config.getOrThrow() during
// module init don't throw when the full AppModule is loaded in e2e tests.
// Use ||= (falsy check) so that an empty-string value set by CI is also replaced;
// ??= only guards against null/undefined.
process.env.AWS_REGION ||= 'us-east-1';
process.env.COGNITO_CLIENT_ID ||= 'test-client-id';
process.env.COGNITO_CLIENT_SECRET ??= 'test-client-secret';
process.env.DYNAMODB_TABLE ||= 'Messages';

// Suppress all NestJS logger output during tests.
// pino is already configured with level: 'silent' when NODE_ENV=test (app.module.ts),
// but unit tests don't bootstrap the full app, so the default ConsoleLogger would
// still write to stdout. These spies prevent that without affecting test assertions.
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger, 'verbose').mockImplementation(() => undefined);
