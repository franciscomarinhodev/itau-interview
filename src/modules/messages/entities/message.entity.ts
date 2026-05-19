import { ApiProperty } from '@nestjs/swagger';

export enum MessageStatus {
  SENT = 'sent',
  RECEIVED = 'received',
  READ = 'read',
}

export class Message {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Hello, world!' })
  content: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the sender',
  })
  sender: string;

  @ApiProperty({ example: '2025-02-10T14:00:00.000Z' })
  sentAt: Date;

  @ApiProperty({ enum: MessageStatus, example: MessageStatus.SENT })
  status: MessageStatus;
}
