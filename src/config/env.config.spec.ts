describe('envConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('is global and loads from .env.local', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { envConfig } = require('./env.config');
    expect(envConfig.isGlobal).toBe(true);
    expect(envConfig.envFilePath).toBe('.env.local');
  });

  it('does not ignore env file outside production', () => {
    process.env.NODE_ENV = 'development';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { envConfig } = require('./env.config');
    expect(envConfig.ignoreEnvFile).toBe(false);
  });

  it('ignores env file in production', () => {
    process.env.NODE_ENV = 'production';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { envConfig } = require('./env.config');
    expect(envConfig.ignoreEnvFile).toBe(true);
  });
});
