import { ValidationArguments, registerDecorator } from 'class-validator';

export const FILTER_REQUIRED =
  'GET /api/v1/messages requires "sender" or both "startDate" and "endDate" (ISO 8601)';

export function MaxDateRangeDays(days: number) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxDateRangeDays',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as Record<string, unknown>;
          if (!dto['startDate'] || !value) return true;
          const diff =
            new Date(value as string).getTime() -
            new Date(dto['startDate'] as string).getTime();
          return diff <= days * 24 * 60 * 60 * 1000;
        },
        defaultMessage: () => `Date range must not exceed ${days} days`,
      },
    });
  };
}
