import type { EvaluationContext } from '@openfeature/server-sdk';
import { transformContext } from './context-transformer';

describe('context-transformer', () => {
  describe('transformContext', () => {
    it('should transform context correctly', () => {
      const context: EvaluationContext = {
        targetingKey: 'entity',
        customProp: 'test',
      };

      const transformedContext: Record<string, string> = transformContext(context);

      expect(transformedContext['customProp']).toBe('test');
    });

    it('should keep the targeting key in the context', () => {
      // Flipt matches a rule whose segment constrains the targeting key against the context map,
      // so dropping the key here would leave every targeting rule unmatched.
      const context: EvaluationContext = {
        targetingKey: 'entity',
      };

      const transformedContext: Record<string, string> = transformContext(context);

      expect(transformedContext['targetingKey']).toBe('entity');
    });

    it('should turn every value into a string', () => {
      const context: EvaluationContext = {
        targetingKey: 'entity',
        count: 42,
      };

      const transformedContext: Record<string, string> = transformContext(context);

      expect(transformedContext['count']).toBe('42');
    });
  });
});
