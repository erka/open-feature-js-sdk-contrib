import type { AuthenticationStrategy } from '@flipt-io/flipt';
import { FliptClient } from '@flipt-io/flipt';
import type {
  EvaluationContext,
  Provider,
  JsonValue,
  ResolutionDetails,
  ProviderMetadata,
} from '@openfeature/server-sdk';
import {
  ProviderStatus,
  TypeMismatchError,
  ProviderNotReadyError,
  StandardResolutionReasons,
  FlagNotFoundError,
  GeneralError,
} from '@openfeature/server-sdk';
import { transformContext } from './context-transformer';

export interface FliptClientParameters {
  url: string;
  authenticationStrategy?: AuthenticationStrategy;
  headers?: Record<string, string>;
}

export class FliptProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'flipt-client-provider',
  };

  private _clientParameters: FliptClientParameters;
  private _namespace: string;
  private _client?: FliptClient;

  private _status: ProviderStatus = ProviderStatus.NOT_READY;

  constructor(namespace: string, clientParameters: FliptClientParameters) {
    this._clientParameters = clientParameters;
    this._namespace = namespace;
  }

  private set clientParameters(clientParameters: FliptClientParameters) {
    this._clientParameters = clientParameters;
  }

  private get clientParameters(): FliptClientParameters {
    return this._clientParameters;
  }

  private set namespace(namespace: string) {
    this._namespace = namespace;
  }

  private get namespace() {
    return this._namespace;
  }

  set status(status: ProviderStatus) {
    this._status = status;
  }

  get status() {
    return this._status;
  }

  private set client(client: FliptClient) {
    this._client = client;
  }

  private get client(): FliptClient {
    if (!this._client) {
      throw new ProviderNotReadyError('Provider is not initialized');
    }
    return this._client;
  }

  async initialize(): Promise<void> {
    this.client = new FliptClient({
      url: this.clientParameters.url,
      authenticationStrategy: this.clientParameters.authenticationStrategy,
      headers: this.clientParameters.headers,
    });
    this.status = ProviderStatus.READY;
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const evalContext: Record<string, string> = transformContext(context);

    try {
      const booleanEvaluation = await this.client.evaluation.boolean({
        namespaceKey: this.namespace,
        flagKey,
        entityId: context.targetingKey ?? '',
        context: evalContext,
      });

      switch (booleanEvaluation?.reason) {
        case 'FLAG_DISABLED_EVALUATION_REASON':
          return {
            value: defaultValue,
            reason: StandardResolutionReasons.DISABLED,
          };
        case 'UNKNOWN_EVALUATION_REASON':
          // Flipt answers UNKNOWN when the flag has no default variant. The caller's default and
          // the DEFAULT reason, not a type mismatch on an empty key.
          return {
            value: defaultValue,
            reason: StandardResolutionReasons.DEFAULT,
          };
        case 'MATCH_EVALUATION_REASON':
          return {
            value: booleanEvaluation?.enabled,
            reason: booleanReason(booleanEvaluation),
          };
        default:
          return {
            value: booleanEvaluation?.enabled,
            reason: StandardResolutionReasons.STATIC,
          };
      }
    } catch (e) {
      throw toOpenFeatureError(e);
    }
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    const value = await this.resolveFlagHelper(flagKey, 'string', defaultValue, context);
    return value as ResolutionDetails<string>;
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    const value = await this.resolveFlagHelper(flagKey, 'number', defaultValue, context);
    return value as ResolutionDetails<number>;
  }

  async resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    defaultValue: U,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<U>> {
    const value = await this.resolveFlagHelper(flagKey, 'json', defaultValue, context);
    return value as ResolutionDetails<U>;
  }

  private async resolveFlagHelper<U extends JsonValue>(
    flagKey: string,
    flagType: PrimitiveTypeName,
    defaultValue: PrimitiveType | U,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<PrimitiveType | U>> {
    const evalContext: Record<string, string> = transformContext(context);

    try {
      const variantEvaluation = await this.client.evaluation.variant({
        namespaceKey: this.namespace,
        flagKey,
        entityId: context.targetingKey ?? '',
        context: evalContext,
      });

      if (variantEvaluation.reason === 'FLAG_DISABLED_EVALUATION_REASON') {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DISABLED,
        };
      }

      if (
        !variantEvaluation.match &&
        variantEvaluation.reason !== 'MATCH_EVALUATION_REASON' &&
        variantEvaluation.reason !== 'DEFAULT_EVALUATION_REASON'
      ) {
        // Flipt answers UNKNOWN when the flag has no default variant. The caller's default and
        // the DEFAULT reason, not a type mismatch on an empty key.
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
        };
      }

      const flagValue: PrimitiveType | U = validateFlagType(
        flagType,
        flagType === 'json' ? variantEvaluation.variantAttachment : variantEvaluation.variantKey,
      );

      return {
        value: flagValue,
        reason:
          variantEvaluation.reason === 'MATCH_EVALUATION_REASON'
            ? StandardResolutionReasons.TARGETING_MATCH
            : StandardResolutionReasons.STATIC,
      };
    } catch (e) {
      if (e instanceof TypeMismatchError) {
        throw e;
      }

      throw toOpenFeatureError(e);
    }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The shape of a boolean evaluation response, as the client returns it. */
type BooleanEvaluationResponse = Awaited<ReturnType<FliptClient['evaluation']['boolean']>>;

/**
 * The reason for a boolean evaluation.
 *
 * Flipt answers MATCH for a boolean flag even when no rule was involved, so the segments it
 * matched are what tell a targeting match from a static resolution. The client's type does not
 * declare the field the API returns, so it is read from the response as it arrives.
 */
function booleanReason(response: BooleanEvaluationResponse): string {
  const segmentKeys = (response as { segmentKeys?: string[] }).segmentKeys ?? [];
  return segmentKeys.length > 0 ? StandardResolutionReasons.TARGETING_MATCH : StandardResolutionReasons.STATIC;
}

/**
 * Maps a failure from the Flipt client onto the OpenFeature error that describes it.
 *
 * The client throws the message the API returned and keeps neither the status nor the error code,
 * so the message is what there is to map on. Flipt's evaluation errors are stable strings:
 * `flag "<namespace>/<key>" not found` for a flag that is absent, and
 * `flag type <type> invalid` for a flag requested as a type it does not have.
 */
function toOpenFeatureError(error: unknown): Error {
  const message = getErrorMessage(error);
  if (/not found/i.test(message)) {
    return new FlagNotFoundError(message);
  }
  if (/flag type .* invalid/i.test(message)) {
    return new TypeMismatchError(message);
  }
  if (/unavailable/i.test(message)) {
    return new ProviderNotReadyError(message);
  }
  return new GeneralError(message);
}

type PrimitiveType = string | number;
type PrimitiveTypeName = 'string' | 'number' | 'json';

function validateFlagType<T extends PrimitiveTypeName, U extends JsonValue>(type: T, value: string): PrimitiveType | U {
  if (typeof value !== 'undefined') {
    switch (type) {
      case 'number': {
        const actualValue = parseFloat(value);
        if (!isNaN(actualValue)) {
          return actualValue;
        }

        throw new TypeMismatchError(`flag value does not match type ${type}`);
      }
      case 'string':
        return value;
      case 'json': {
        try {
          const obj: U = JSON.parse(value);
          return obj;
        } catch {
          throw new TypeMismatchError(`flag value does not match type ${type}`);
        }
      }
      default:
        return value;
    }
  }

  return value;
}
