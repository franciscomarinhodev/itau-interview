import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBHealthIndicator } from './dynamodb.health-indicator';

const makeIndicator = (clientSend: jest.Mock) => {
  const upResult = { dynamodb: { status: 'up' } } as any;
  const downResult = {
    dynamodb: { status: 'down', message: 'DynamoDB unreachable' },
  } as any;
  const mockUp = jest.fn().mockReturnValue(upResult);
  const mockDown = jest.fn().mockReturnValue(downResult);

  const healthIndicatorService = {
    check: jest.fn().mockReturnValue({ up: mockUp, down: mockDown }),
  } as unknown as HealthIndicatorService;

  const client = { send: clientSend } as unknown as DynamoDBDocumentClient;
  const config = {
    get: jest.fn().mockReturnValue('Messages'),
  } as unknown as ConfigService;

  const indicator = new DynamoDBHealthIndicator(
    client,
    healthIndicatorService,
    config,
  );

  return { indicator, mockUp, mockDown };
};

describe('DynamoDBHealthIndicator', () => {
  describe('isHealthy', () => {
    it('returns up when DynamoDB scan succeeds', async () => {
      const send = jest.fn().mockResolvedValue({});
      const { indicator, mockUp, mockDown } = makeIndicator(send);

      const result = await indicator.isHealthy('dynamodb');

      expect(mockUp).toHaveBeenCalled();
      expect(mockDown).not.toHaveBeenCalled();
      expect(result).toEqual({ dynamodb: { status: 'up' } });
    });

    it('returns down when DynamoDB scan throws', async () => {
      const send = jest.fn().mockRejectedValue(new Error('Connection refused'));
      const { indicator, mockUp, mockDown } = makeIndicator(send);

      const result = await indicator.isHealthy('dynamodb');

      expect(mockDown).toHaveBeenCalledWith({
        message: 'DynamoDB unreachable',
      });
      expect(mockUp).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          dynamodb: { status: 'down', message: 'DynamoDB unreachable' },
        }),
      );
    });

    it('reads table name from ConfigService', () => {
      const send = jest.fn().mockResolvedValue({});
      const config = {
        get: jest.fn().mockReturnValue('CustomTable'),
      } as unknown as ConfigService;
      const healthSvc = {
        check: jest
          .fn()
          .mockReturnValue({
            up: jest.fn().mockReturnValue({}),
            down: jest.fn(),
          }),
      } as unknown as HealthIndicatorService;
      const client = { send } as unknown as DynamoDBDocumentClient;

      new DynamoDBHealthIndicator(client, healthSvc, config);

      expect(config.get).toHaveBeenCalledWith('DYNAMODB_TABLE', 'Messages');
    });
  });
});
