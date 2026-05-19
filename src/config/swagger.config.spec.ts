const mockSetTitle = jest.fn().mockReturnThis();
const mockSetDescription = jest.fn().mockReturnThis();
const mockSetVersion = jest.fn().mockReturnThis();
const mockAddBearerAuth = jest.fn().mockReturnThis();
const mockBuild = jest.fn().mockReturnValue({});
const mockCreateDocument = jest.fn().mockReturnValue({});
const mockSetup = jest.fn();

jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: mockSetTitle,
    setDescription: mockSetDescription,
    setVersion: mockSetVersion,
    addBearerAuth: mockAddBearerAuth,
    build: mockBuild,
  })),
  SwaggerModule: {
    createDocument: mockCreateDocument,
    setup: mockSetup,
  },
}));

import { setupSwagger } from './swagger.config';

const mockApp = {} as any;

describe('setupSwagger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it('returns immediately in production without configuring swagger', () => {
    process.env.NODE_ENV = 'production';
    setupSwagger(mockApp, '/api/v1');
    expect(mockSetup).not.toHaveBeenCalled();
    expect(mockCreateDocument).not.toHaveBeenCalled();
  });

  it('configures swagger in development', () => {
    process.env.NODE_ENV = 'development';
    setupSwagger(mockApp, '/api/v1');
    expect(mockCreateDocument).toHaveBeenCalledWith(mockApp, {});
    expect(mockSetup).toHaveBeenCalledWith(
      '/api/v1/docs',
      mockApp,
      {},
      expect.objectContaining({
        swaggerOptions: { persistAuthorization: true },
      }),
    );
  });

  it('mounts docs under the provided apiPrefix', () => {
    process.env.NODE_ENV = 'development';
    setupSwagger(mockApp, '/v2');
    expect(mockSetup).toHaveBeenCalledWith(
      '/v2/docs',
      mockApp,
      {},
      expect.any(Object),
    );
  });
});
