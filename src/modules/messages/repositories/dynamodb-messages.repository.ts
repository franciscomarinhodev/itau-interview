import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_CLIENT } from '../../../database/dynamodb.provider';
import { DynamoDBRepository } from '../../../database/dynamodb.repository';
import { DEFAULT_DYNAMODB_TABLE } from '../../../config/constants';
import { Message, MessageStatus } from '../entities/message.entity';
import { MessagesRepository } from './messages.repository.abstract';

@Injectable()
export class DynamoDBMessagesRepository
  extends DynamoDBRepository
  implements MessagesRepository
{
  protected readonly tableName: string;

  private readonly GSI_DATE = 'GSI_DATE';
  private readonly GSI_SENDER = 'GSI_SENDER';

  constructor(
    @Inject(DYNAMODB_CLIENT) client: DynamoDBDocumentClient,
    config: ConfigService,
  ) {
    super(client);
    this.tableName = config.get<string>(
      'DYNAMODB_TABLE',
      DEFAULT_DYNAMODB_TABLE,
    );
  }

  // ------------------------------------------------------------------ writes

  async create(content: string, sender: string): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      content,
      sender,
      sentAt: new Date(),
      status: MessageStatus.SENT,
    };

    await this.putItem(
      {
        PK: this.pk(message.id),
        GSI_DATE_PK: this.gsiDatePk(message.sentAt),
        GSI_DATE_SK: this.compositeSort(message.sentAt, message.id),
        GSI_SENDER_PK: this.gsiSenderPk(message.sender),
        GSI_SENDER_SK: this.compositeSort(message.sentAt, message.id),
        id: message.id,
        content: message.content,
        sender: message.sender,
        sentAt: message.sentAt.toISOString(),
        status: message.status,
      },
      { conditionExpression: 'attribute_not_exists(PK)' },
    );

    return message;
  }

  async updateStatus(
    id: string,
    status: MessageStatus,
  ): Promise<Message | undefined> {
    const item = await this.updateItem({
      key: { PK: this.pk(id) },
      updateExpression: 'SET #s = :status',
      expressionNames: { '#s': 'status' },
      expressionValues: { ':status': status },
      conditionExpression: 'attribute_exists(id)',
    });
    return item ? this.toEntity(item) : undefined;
  }

  // ------------------------------------------------------------------- reads

  async findById(id: string): Promise<Message | undefined> {
    const item = await this.getItem({ PK: this.pk(id) });
    return item ? this.toEntity(item) : undefined;
  }

  async findBySender(sender: string): Promise<Message[]> {
    const items = await this.queryItems({
      indexName: this.GSI_SENDER,
      keyCondition: 'GSI_SENDER_PK = :pk',
      expressionValues: { ':pk': this.gsiSenderPk(sender) },
    });
    return items.map(this.toEntity);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Message[]> {
    const days = this.getDaysInRange(startDate, endDate);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const isSingleDay = days.length === 1;

    const pages = await Promise.all(
      days.map((day) => {
        const dateOnly = day.slice(0, 10);

        const startSk =
          day === firstDay ? `${day}#` : `${dateOnly}T00:00:00.000Z#`;
        const endSk =
          day === lastDay
            ? `${isSingleDay ? endDate.toISOString() : day}#~`
            : `${dateOnly}T23:59:59.999Z#~`;
        return this.queryItems({
          indexName: this.GSI_DATE,
          keyCondition:
            'GSI_DATE_PK = :pk AND GSI_DATE_SK BETWEEN :start AND :end',
          expressionValues: {
            ':pk': `MESSAGES#${dateOnly}`,
            ':start': startSk,
            ':end': endSk,
          },
        });
      }),
    );

    return pages.flat().map(this.toEntity);
  }

  async findAll(): Promise<Message[]> {
    const items = await this.scanItems();
    return items.map(this.toEntity);
  }

  // ------------------------------------------------------------ key builders

  private pk(id: string): string {
    return `MSG#${id}`;
  }

  private gsiDatePk(date: Date): string {
    return `MESSAGES#${date.toISOString().slice(0, 10)}`;
  }

  private gsiSenderPk(sender: string): string {
    return `SENDER#${sender}`;
  }

  /** Shared SK format for GSI_DATE and GSI_SENDER: <ISO timestamp>#<id> */
  private compositeSort(date: Date, id: string): string {
    return `${date.toISOString()}#${id}`;
  }

  private getDaysInRange(start: Date, end: Date): string[] {
    const startDateOnly = start.toISOString().slice(0, 10);
    const endDateOnly = end.toISOString().slice(0, 10);

    if (startDateOnly === endDateOnly) {
      return [start.toISOString()];
    }

    const days: string[] = [start.toISOString()];

    const cursor = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 1,
      ),
    );
    const endMidnight = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    while (cursor < endMidnight) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    days.push(end.toISOString());

    return days;
  }

  // --------------------------------------------------------------- mapping

  private toEntity(item: Record<string, unknown>): Message {
    return {
      id: item.id as string,
      content: item.content as string,
      sender: item.sender as string,
      sentAt: new Date(item.sentAt as string),
      status: item.status as MessageStatus,
    };
  }
}
