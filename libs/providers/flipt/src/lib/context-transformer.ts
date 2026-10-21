import type { EvaluationContext } from '@openfeature/server-sdk';

/**
 * The OpenFeature evaluation context as the Flipt context map.
 *
 * Every value becomes a string, because Flipt's context is a map of strings.
 *
 * The targeting key stays in the map. Flipt matches a rule whose segment constrains the
 * `targetingKey` property against the context map, and it evaluates rules at all only when the
 * targeting key is also the entity id, so the key has to be in both places. A rule that names the
 * targeting key and a context that carries it is the pairing Flipt expects, and the one the Go
 * and Java providers send.
 */
export function transformContext(context: EvaluationContext): Record<string, string> {
  const evalContext: Record<string, string> = {};
  for (const value in context) {
    evalContext[value] = context[value]?.toString() ?? '';
  }

  return evalContext;
}
