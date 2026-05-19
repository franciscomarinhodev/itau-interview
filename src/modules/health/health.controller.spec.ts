import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DynamoDBHealthIndicator } from './indicators/dynamodb.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<Pick<HealthCheckService, 'check'>>;
  let dynamodbIndicator: jest.Mocked<
    Pick<DynamoDBHealthIndicator, 'isHealthy'>
  >;

  beforeEach(() => {
    healthService = { check: jest.fn() } as any;
    dynamodbIndicator = { isHealthy: jest.fn() } as any;
    controller = new HealthController(
      healthService as unknown as HealthCheckService,
      dynamodbIndicator as unknown as DynamoDBHealthIndicator,
    );
  });

  describe('liveness', () => {
    it('returns { status: ok } without touching DynamoDB', () => {
      expect(controller.liveness()).toEqual({ status: 'ok' });
      expect(dynamodbIndicator.isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('delegates to health.check and returns the result', async () => {
      const checkResult = { status: 'ok', details: {} } as any;
      healthService.check.mockResolvedValue(checkResult);

      const result = await controller.readiness();

      expect(result).toBe(checkResult);
      expect(healthService.check).toHaveBeenCalledWith([expect.any(Function)]);
    });

    it('passes a function that calls dynamodb.isHealthy', async () => {
      healthService.check.mockImplementation(async (indicators) => {
        await indicators[0]();
        return {} as any;
      });
      dynamodbIndicator.isHealthy.mockResolvedValue({
        dynamodb: { status: 'up' },
      } as any);

      await controller.readiness();

      expect(dynamodbIndicator.isHealthy).toHaveBeenCalledWith('dynamodb');
    });
  });
});
