import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockTokens = {
  accessToken: 'access-token',
  idToken: 'id-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

const mockService: Partial<AuthService> = {
  login: jest.fn().mockResolvedValue(mockTokens),
  refresh: jest.fn().mockResolvedValue({
    accessToken: 'new-access',
    idToken: 'new-id',
    expiresIn: 3600,
    tokenType: 'Bearer',
  }),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('login() calls service.login and returns tokens', async () => {
    (mockService.login as jest.Mock).mockResolvedValue(mockTokens);

    const result = await controller.login({
      username: 'user@example.com',
      password: 'P@ssw0rd!',
    });

    expect(result).toEqual(mockTokens);
    expect(mockService.login).toHaveBeenCalledWith(
      'user@example.com',
      'P@ssw0rd!',
    );
  });

  it('refresh() calls service.refresh and returns new tokens', async () => {
    const refreshResult = {
      accessToken: 'new-access',
      idToken: 'new-id',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
    (mockService.refresh as jest.Mock).mockResolvedValue(refreshResult);

    const result = await controller.refresh({
      username: 'user@example.com',
      refreshToken: 'my-refresh-token',
    });

    expect(result).toEqual(refreshResult);
    expect(mockService.refresh).toHaveBeenCalledWith(
      'user@example.com',
      'my-refresh-token',
    );
  });
});
