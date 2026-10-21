import { join } from 'node:path';
import { Capability, runContainerizedProviderTck } from '@openfeature/tck';
import { FliptProvider } from '../lib/flipt-provider';

/**
 * The OpenFeature Provider TCK against the Flipt provider.
 *
 * The backend is the shared Flipt provider-TCK testbed published from
 * https://github.com/flipt-io/openfeature-tck: Flipt plus a control server that starts, stops and
 * reseeds the bundled Flipt process, so the suite can simulate outages and configuration changes
 * without restarting the container.
 *
 * Capabilities are declared for what this provider and backend together do. NUMERIC_COERCION is
 * not among them because JavaScript has one numeric type, so the suite cannot ask the question.
 * STANDARD_REASONS is withheld because Flipt answers the same DEFAULT_EVALUATION_REASON for a
 * rule-less flag and for a rule that matched nothing, so the provider cannot tell STATIC from
 * DEFAULT. The vendor behaviour is covered by the Flipt vendor scenarios instead, which the build
 * downloads from the tagged testbed repository into the directory below.
 */
runContainerizedProviderTck({
  name: 'flipt',
  composeFile: join(__dirname, 'docker-compose.yaml'),
  backendPorts: [8888],
  newProvider: (endpoint) => new FliptProvider('default', { url: `http://${endpoint.host}:${endpoint.port(8888)}` }),
  capabilities: [Capability.Object, Capability.Targeting, Capability.DisabledFlags, Capability.LargeIntegers],
  // Absolute, because paths resolve against the runner's working directory rather than this file's.
  extensionFeatures: join(__dirname, 'features'),
});
