import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hello, world!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the authenticated user',
  })
  @IsUUID()
  sender: string;
}
