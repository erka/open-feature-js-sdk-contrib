# Flipt Provider

[Flipt](https://www.flipt.io/) is an open source developer friendly feature flagging solution, that allows for easy management and fast feature evaluation.

This provider is an implementation on top of the official [Flipt Node Server Side SDK](https://www.npmjs.com/package/@flipt-io/flipt).

## Installation

```
$ npm install @openfeature/flipt-provider
```

### Peer Dependencies

Both the OpenFeature SDK and the Flipt Node Server SDK are required as peer dependencies.

Please make sure to install `@flipt-io/flipt` at versions >= `1.0.0`, as the client API is different in earlier versions.

The peer dependency will also enforce the above version.

## Example initialization and usage

To initialize the OpenFeature client with Flipt, you can use the following code snippet:

```ts
import { FliptProvider } from '@openfeature/flipt';

const provider = new FliptProvider('namespace-of-choice', { url: 'http://your.upstream.flipt.host' });
OpenFeature.setProvider(provider);
```

After the provider gets initialized, you can start evaluations of feature flags like so:

```ts
const client = OpenFeature.getClient();
const details = await client.getStringDetails('nonExistent', 'default', {
  targetingKey: 'myentity',
  email: 'john@flipt.io',
});
```

## Evaluation Context Transformation

OpenFeature standardizes the evaluation context to include a `targetingKey`, and some other additional arbitrary properties that each provider can use fit for their use case.

For Flipt, we translate the `targetingKey` as the `entityId`, and the evaluation context as the
`context` in Flipt vernacular. The targeting key stays in the context map as well: Flipt matches a
rule whose segment constrains the `targetingKey` property against the context map, and it evaluates
rules at all only when the targeting key is also the entity id. You can find the meaning of those
two words [here](https://www.flipt.io/docs/reference/evaluation/variant-evaluation) in our API docs.

For example, an OpenFeature Evaluation context that has this structure:

```json
{
  "targetingKey": "my-targeting-id",
  "email": "john@flipt.io",
  "userId": "this-very-long-user-id"
}
```

will get transformed to the following for Flipt:

```json
{
  "entityId": "my-targeting-id",
  "context": {
    "targetingKey": "my-targeting-id",
    "email": "john@flipt.io",
    "userId": "this-very-long-user-id"
  }
}
```

## Building

Run `nx package providers-flipt` to build the library.

## Running unit tests

Run `nx test providers-flipt` to execute the unit tests via [Jest](https://jestjs.io).

## Provider conformance suite

The provider runs the OpenFeature Provider TCK against a throwaway Flipt backend:

```sh
nx run providers-flipt:tck
```

The suite starts a container, so Docker has to be running. The backend is the shared testbed
published from [flipt-io/openfeature-tck](https://github.com/flipt-io/openfeature-tck): Flipt plus
a control server that starts, stops and reseeds the bundled Flipt process, so the suite can
simulate outages and configuration changes without restarting the container. The Compose file pins
the image `ghcr.io/flipt-io/openfeature-tck:0.1.0`; set `FLIPT_TESTBED_IMAGE` to a locally built
tag when changing the testbed.

The suite declares `OBJECT`, `TARGETING`, `DISABLED_FLAGS` and `LARGE_INTEGERS`. It withholds
lifecycle, events, reinitialization, stale and configuration change, because the provider has no
observable lifecycle or event support, and it withholds variants, string typing and fully typed
values, because Flipt stores scalar values as variant-key text. It withholds standard reasons
because Flipt answers the same `DEFAULT_EVALUATION_REASON` for a rule-less flag and for a rule
that matched nothing, so the provider cannot tell `STATIC` from `DEFAULT`. Numeric coercion is not
among the capabilities because JavaScript has one numeric type and cannot ask the question.

The Flipt-specific reason behaviour is covered by the vendor scenario, which the build downloads
from the tagged testbed repository into `src/tck/features/`. This repository keeps no copy of it.
The pin is `src/tck/tck-spec.json`, which names the files to fetch, and `src/tck/fetch-spec.mjs`
does the downloading. Set `FLIPT_TCK_SPEC_SOURCE` to a local directory holding the same files to
build without network access.
