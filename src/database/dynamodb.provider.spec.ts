import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { dynamoDBProvider, DYNAMODB_CLIENT } from './dynamodb.provider';

type FactoryProvider = { provide: string; useFactory: () => unknown };
const provider = dynamoDBProvider as FactoryProvider;
const factory = provider.useFactory;

describe('dynamoDBProvider', () => {
  const originalRegion = process.env.AWS_REGION;
  const originalEndpoint = process.env.DYNAMODB_ENDPOINT;

  afterEach(() => {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;

    if (originalEndpoint === undefined) delete process.env.DYNAMODB_ENDPOINT;
    else process.env.DYNAMODB_ENDPOINT = originalEndpoint;
  });

  it('provides the DYNAMODB_CLIENT token', () => {
    expect(provider.provide).toBe(DYNAMODB_CLIENT);
  });

  it('factory returns a DynamoDBDocumentClient instance', () => {
    delete process.env.DYNAMODB_ENDPOINT;
    const client = factory();
    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('factory uses AWS_REGION env var when set', () => {
    process.env.AWS_REGION = 'eu-west-1';
    delete process.env.DYNAMODB_ENDPOINT;

    const client = factory() as DynamoDBDocumentClient;

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('factory defaults to us-east-1 when AWS_REGION is not set', () => {
    delete process.env.AWS_REGION;
    delete process.env.DYNAMODB_ENDPOINT;

    const client = factory() as DynamoDBDocumentClient;

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('factory includes endpoint when DYNAMODB_ENDPOINT is set', () => {
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';

    const client = factory() as DynamoDBDocumentClient;

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });
});
