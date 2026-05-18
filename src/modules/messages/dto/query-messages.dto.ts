import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

const FILTER_REQUIRED =
  'GET /api/v1/messages requires "sender" or both "startDate" and "endDate" (ISO 8601)';

export class QueryMessagesDto {
  @IsOptional()
  @IsString()
  sender?: string;

  @ValidateIf((o: QueryMessagesDto) => !o.sender)
  @IsDateString(
    {},
    {
      message:
        '"startDate" must be a valid ISO 8601 date (e.g. 2025-01-31T00:00:00Z)',
    },
  )
  @IsNotEmpty({ message: FILTER_REQUIRED })
  startDate?: string;

  @ValidateIf((o: QueryMessagesDto) => !o.sender)
  @IsDateString(
    {},
    {
      message:
        '"endDate" must be a valid ISO 8601 date (e.g. 2025-01-31T23:59:59Z)',
    },
  )
  @IsNotEmpty({ message: FILTER_REQUIRED })
  endDate?: string;
}
