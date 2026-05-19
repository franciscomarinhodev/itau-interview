import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { FILTER_REQUIRED, MaxDateRangeDays } from './max-date-range.decorator';

import { MAX_QUERY_RANGE_DAYS as MAX_RANGE_DAYS } from '../../../config/constants';

export class QueryMessagesDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by sender UUID. Takes priority over date range.',
  })
  @IsOptional()
  @IsUUID()
  sender?: string;

  @ApiPropertyOptional({
    example: '2025-01-31T00:00:00.000Z',
    description:
      'Range start (ISO 8601). Required when sender is absent. ' +
      `Maximum range is ${MAX_RANGE_DAYS} days.`,
  })
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

  @ApiPropertyOptional({
    example: '2025-01-31T23:59:59.000Z',
    description:
      `Range end (ISO 8601). Required when sender is absent. ` +
      `Must be at most ${MAX_RANGE_DAYS} days after startDate.`,
  })
  @ValidateIf((o: QueryMessagesDto) => !o.sender)
  @IsDateString(
    {},
    {
      message:
        '"endDate" must be a valid ISO 8601 date (e.g. 2025-01-31T23:59:59Z)',
    },
  )
  @IsNotEmpty({ message: FILTER_REQUIRED })
  @ValidateIf((o: QueryMessagesDto) => !o.sender)
  @MaxDateRangeDays(MAX_RANGE_DAYS)
  endDate?: string;
}
