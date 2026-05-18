import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto';
import { Message } from './entities/message.entity';
import { MessagesRepository } from './repositories/messages.repository.abstract';

@Injectable()
export class MessagesService {
  constructor(private readonly repository: MessagesRepository) {}

  create(dto: CreateMessageDto): Promise<Message> {
    return this.repository.create(dto.content, dto.sender);
  }

  async findById(id: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException(`Message "${id}" not found`);
    return message;
  }

  findMany(query: QueryMessagesDto): Promise<Message[]> {
    if (query.sender) return this.repository.findBySender(query.sender);
    return this.repository.findByDateRange(
      new Date(query.startDate!),
      new Date(query.endDate!),
    );
  }

  async updateStatus(
    id: string,
    dto: UpdateMessageStatusDto,
  ): Promise<Message> {
    const message = await this.repository.updateStatus(id, dto.status);
    if (!message) throw new NotFoundException(`Message "${id}" not found`);
    return message;
  }
}
