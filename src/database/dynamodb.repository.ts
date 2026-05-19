import { Inject } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_CLIENT } from './dynamodb.provider';

export interface QueryOptions {
  indexName?: string;
  keyCondition: string;
  expressionValues: Record<string, unknown>;
  expressionNames?: Record<string, string>;
}

export interface ScanOptions {
  filterExpression?: string;
  expressionValues?: Record<string, unknown>;
  expressionNames?: Record<string, string>;
}

export interface PutOptions {
  conditionExpression?: string;
}

export interface UpdateOptions {
  key: Record<string, unknown>;
  updateExpression: string;
  expressionValues: Record<string, unknown>;
  expressionNames?: Record<string, string>;
  conditionExpression?: string;
}

export abstract class DynamoDBRepository {
  protected abstract readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_CLIENT)
    private readonly client: DynamoDBDocumentClient,
  ) {}

  protected async putItem(
    item: Record<string, unknown>,
    options: PutOptions = {},
  ): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ...(options.conditionExpression && {
          ConditionExpression: options.conditionExpression,
        }),
      }),
    );
  }

  protected async getItem(
    key: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: key }),
    );
    return Item as Record<string, unknown> | undefined;
  }

  protected async queryItems(
    options: QueryOptions,
  ): Promise<Record<string, unknown>[]> {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: options.indexName,
        KeyConditionExpression: options.keyCondition,
        ExpressionAttributeValues: options.expressionValues,
        ...(options.expressionNames && {
          ExpressionAttributeNames: options.expressionNames,
        }),
      }),
    );
    return Items as Record<string, unknown>[];
  }

  protected async scanItems(
    options: ScanOptions = {},
  ): Promise<Record<string, unknown>[]> {
    const { Items = [] } = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ...(options.filterExpression && {
          FilterExpression: options.filterExpression,
        }),
        ...(options.expressionValues && {
          ExpressionAttributeValues: options.expressionValues,
        }),
        ...(options.expressionNames && {
          ExpressionAttributeNames: options.expressionNames,
        }),
      }),
    );
    return Items as Record<string, unknown>[];
  }

  protected async updateItem(
    options: UpdateOptions,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      const { Attributes } = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: options.key,
          UpdateExpression: options.updateExpression,
          ExpressionAttributeValues: options.expressionValues,
          ...(options.expressionNames && {
            ExpressionAttributeNames: options.expressionNames,
          }),
          ...(options.conditionExpression && {
            ConditionExpression: options.conditionExpression,
          }),
          ReturnValues: 'ALL_NEW',
        }),
      );
      return Attributes as Record<string, unknown> | undefined;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === 'ConditionalCheckFailedException'
      ) {
        return undefined;
      }
      throw err;
    }
  }
}
