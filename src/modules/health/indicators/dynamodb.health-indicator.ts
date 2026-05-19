import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_CLIENT } from '../../../database/dynamodb.provider';
import { DEFAULT_DYNAMODB_TABLE } from '../../../config/constants';

@Injectable()
export class DynamoDBHealthIndicator {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_CLIENT) private readonly client: DynamoDBDocumentClient,
    private readonly healthIndicatorService: HealthIndicatorService,
    config: ConfigService,
  ) {
    this.tableName = config.get<string>(
      'DYNAMODB_TABLE',
      DEFAULT_DYNAMODB_TABLE,
    );
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          Limit: 1,
        }),
      );
      return indicator.up();
    } catch {
      return indicator.down({ message: 'DynamoDB unreachable' });
    }
  }
}
