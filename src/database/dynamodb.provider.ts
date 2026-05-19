import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DEFAULT_AWS_REGION } from '../config/constants';

export const DYNAMODB_CLIENT = 'DYNAMODB_CLIENT';

export const dynamoDBProvider: Provider = {
  provide: DYNAMODB_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const client = new DynamoDBClient({
      region: config.get<string>('AWS_REGION', DEFAULT_AWS_REGION),
      ...(config.get<string>('DYNAMODB_ENDPOINT') && {
        endpoint: config.get<string>('DYNAMODB_ENDPOINT'),
      }),
    });

    return DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  },
};
