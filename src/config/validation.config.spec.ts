import { validationConfig } from './validation.config';

describe('validationConfig', () => {
  it('strips unknown properties and rejects non-whitelisted fields', () => {
    expect(validationConfig.whitelist).toBe(true);
    expect(validationConfig.forbidNonWhitelisted).toBe(true);
  });

  it('transforms payloads and stops at the first error', () => {
    expect(validationConfig.transform).toBe(true);
    expect(validationConfig.stopAtFirstError).toBe(true);
  });
});
