import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  DynamoDBRepository,
  PutOptions,
  QueryOptions,
  ScanOptions,
  UpdateOptions,
} from './dynamodb.repository';

class ConcreteRepository extends DynamoDBRepository {
  protected readonly tableName = 'TestTable';

  callPutItem(item: Record<string, unknown>, options?: PutOptions) {
    return this.putItem(item, options);
  }

  callGetItem(key: Record<string, unknown>) {
    return this.getItem(key);
  }

  callQueryItems(options: QueryOptions) {
    return this.queryItems(options);
  }

  callScanItems(options?: ScanOptions) {
    return this.scanItems(options);
  }

  callUpdateItem(options: UpdateOptions) {
    return this.updateItem(options);
  }
}

const makeSend = () => jest.fn();

const makeClient = (send: jest.Mock) =>
  ({ send }) as unknown as DynamoDBDocumentClient;

describe('DynamoDBRepository', () => {
  let send: jest.Mock;
  let repo: ConcreteRepository;

  beforeEach(() => {
    send = makeSend();
    repo = new ConcreteRepository(makeClient(send));
  });

  describe('putItem', () => {
    it('sends a PutCommand with the correct TableName and Item', async () => {
      send.mockResolvedValue({});

      await repo.callPutItem({ PK: 'A', value: 1 });

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe('TestTable');
      expect(command.input.Item).toEqual({ PK: 'A', value: 1 });
      expect(command.input.ConditionExpression).toBeUndefined();
    });

    it('includes ConditionExpression when provided', async () => {
      send.mockResolvedValue({});

      await repo.callPutItem(
        { PK: 'A', value: 1 },
        {
          conditionExpression: 'attribute_not_exists(PK)',
        },
      );

      const command = send.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBe('attribute_not_exists(PK)');
    });
  });

  describe('getItem', () => {
    it('returns the Item when found', async () => {
      const item = { PK: 'A', SK: 'A', content: 'hello' };
      send.mockResolvedValue({ Item: item });

      const result = await repo.callGetItem({ PK: 'A', SK: 'A' });

      expect(result).toEqual(item);
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe('TestTable');
      expect(command.input.Key).toEqual({ PK: 'A', SK: 'A' });
    });

    it('returns undefined when Item is absent', async () => {
      send.mockResolvedValue({});

      const result = await repo.callGetItem({ PK: 'ghost', SK: 'ghost' });

      expect(result).toBeUndefined();
    });
  });

  describe('queryItems', () => {
    it('returns Items from the query result', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      send.mockResolvedValue({ Items: items });

      const result = await repo.callQueryItems({
        keyCondition: 'PK = :pk',
        expressionValues: { ':pk': 'A' },
      });

      expect(result).toEqual(items);
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe('TestTable');
      expect(command.input.KeyConditionExpression).toBe('PK = :pk');
    });

    it('includes IndexName and ExpressionAttributeNames when provided', async () => {
      send.mockResolvedValue({ Items: [] });

      await repo.callQueryItems({
        indexName: 'GSI_TEST',
        keyCondition: '#pk = :pk',
        expressionValues: { ':pk': 'A' },
        expressionNames: { '#pk': 'PK' },
      });

      const command = send.mock.calls[0][0];
      expect(command.input.IndexName).toBe('GSI_TEST');
      expect(command.input.ExpressionAttributeNames).toEqual({ '#pk': 'PK' });
    });

    it('omits ExpressionAttributeNames when not provided', async () => {
      send.mockResolvedValue({ Items: [] });

      await repo.callQueryItems({
        keyCondition: 'PK = :pk',
        expressionValues: { ':pk': 'A' },
      });

      const command = send.mock.calls[0][0];
      expect(command.input.ExpressionAttributeNames).toBeUndefined();
    });

    it('returns empty array when Items is absent', async () => {
      send.mockResolvedValue({});

      const result = await repo.callQueryItems({
        keyCondition: 'PK = :pk',
        expressionValues: { ':pk': 'A' },
      });

      expect(result).toEqual([]);
    });
  });

  describe('scanItems', () => {
    it('returns all Items when called with no options', async () => {
      const items = [{ id: '1' }];
      send.mockResolvedValue({ Items: items });

      const result = await repo.callScanItems();

      expect(result).toEqual(items);
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe('TestTable');
      expect(command.input.FilterExpression).toBeUndefined();
    });

    it('includes FilterExpression and ExpressionAttributeValues when provided', async () => {
      send.mockResolvedValue({ Items: [] });

      await repo.callScanItems({
        filterExpression: 'sender = :s',
        expressionValues: { ':s': 'alice' },
      });

      const command = send.mock.calls[0][0];
      expect(command.input.FilterExpression).toBe('sender = :s');
      expect(command.input.ExpressionAttributeValues).toEqual({
        ':s': 'alice',
      });
    });

    it('includes ExpressionAttributeNames when provided', async () => {
      send.mockResolvedValue({ Items: [] });

      await repo.callScanItems({
        filterExpression: '#s = :s',
        expressionValues: { ':s': 'alice' },
        expressionNames: { '#s': 'sender' },
      });

      const command = send.mock.calls[0][0];
      expect(command.input.ExpressionAttributeNames).toEqual({
        '#s': 'sender',
      });
    });

    it('returns empty array when Items is absent', async () => {
      send.mockResolvedValue({});

      const result = await repo.callScanItems();

      expect(result).toEqual([]);
    });
  });

  describe('updateItem', () => {
    const baseOptions: UpdateOptions = {
      key: { PK: 'A', SK: 'A' },
      updateExpression: 'SET #s = :s',
      expressionValues: { ':s': 'read' },
      expressionNames: { '#s': 'status' },
    };

    it('returns Attributes on success', async () => {
      const attrs = { PK: 'A', SK: 'A', status: 'read' };
      send.mockResolvedValue({ Attributes: attrs });

      const result = await repo.callUpdateItem(baseOptions);

      expect(result).toEqual(attrs);
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe('TestTable');
      expect(command.input.Key).toEqual({ PK: 'A', SK: 'A' });
      expect(command.input.ReturnValues).toBe('ALL_NEW');
    });

    it('includes ExpressionAttributeNames when provided', async () => {
      send.mockResolvedValue({ Attributes: {} });

      await repo.callUpdateItem(baseOptions);

      const command = send.mock.calls[0][0];
      expect(command.input.ExpressionAttributeNames).toEqual({
        '#s': 'status',
      });
    });

    it('omits ExpressionAttributeNames when not provided', async () => {
      send.mockResolvedValue({ Attributes: {} });

      await repo.callUpdateItem({
        key: { PK: 'A', SK: 'A' },
        updateExpression: 'SET status = :s',
        expressionValues: { ':s': 'read' },
      });

      const command = send.mock.calls[0][0];
      expect(command.input.ExpressionAttributeNames).toBeUndefined();
    });

    it('includes ConditionExpression when provided', async () => {
      send.mockResolvedValue({ Attributes: {} });

      await repo.callUpdateItem({
        ...baseOptions,
        conditionExpression: 'attribute_exists(PK)',
      });

      const command = send.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBe('attribute_exists(PK)');
    });

    it('returns undefined on ConditionalCheckFailedException', async () => {
      const err = Object.assign(new Error('condition failed'), {
        name: 'ConditionalCheckFailedException',
      });
      send.mockRejectedValue(err);

      const result = await repo.callUpdateItem(baseOptions);

      expect(result).toBeUndefined();
    });

    it('rethrows errors that are not ConditionalCheckFailedException', async () => {
      send.mockRejectedValue(new Error('network error'));

      await expect(repo.callUpdateItem(baseOptions)).rejects.toThrow(
        'network error',
      );
    });
  });
});
