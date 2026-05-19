describe('loggerConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('test env: level is silent, no transport', () => {
    process.env.NODE_ENV = 'test';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loggerConfig } = require('./logger.config');
    expect(loggerConfig.pinoHttp.level).toBe('silent');
    expect(loggerConfig.pinoHttp.transport).toBeUndefined();
  });

  it('production env: level is info, no transport', () => {
    process.env.NODE_ENV = 'production';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loggerConfig } = require('./logger.config');
    expect(loggerConfig.pinoHttp.level).toBe('info');
    expect(loggerConfig.pinoHttp.transport).toBeUndefined();
  });

  it('development env: level is debug, pino-pretty transport', () => {
    process.env.NODE_ENV = 'development';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loggerConfig } = require('./logger.config');
    expect(loggerConfig.pinoHttp.level).toBe('debug');
    expect(loggerConfig.pinoHttp.transport).toBeDefined();
    expect(loggerConfig.pinoHttp.transport.target).toBe('pino-pretty');
  });
});
