#!/usr/bin/env node
// Downloads the Flipt vendor scenarios from the tagged testbed repository into the directory the
// provider TCK reads them from.
//
// The scenarios live in one repository and every adopter runs the same ones, so a copy in this
// repository is a copy that goes stale. This script fetches the files the pin names and writes
// them next to the suite that runs them.
//
// The pin is tck-spec.json, beside this script. Set FLIPT_TCK_SPEC_SOURCE to a local directory to
// build without network access; it must hold the same files the tag holds, at the same paths.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pin = JSON.parse(await readFile(join(here, 'tck-spec.json'), 'utf8'));

const target = join(here, 'features');

if (!pin.files?.length) {
  throw new Error(
    'the pin names no files. The vendor scenarios would not run, and the suite would report ' + 'success without them.',
  );
}

const names = pin.files.map((file) => basename(file));
const duplicate = names.find((name, index) => names.indexOf(name) !== index);
if (duplicate) {
  throw new Error(
    `the pin names ${duplicate} more than once. The suite refuses two extension features with the ` +
      `same name, because the name identifies the feature a scenario came from.`,
  );
}

const source = process.env.FLIPT_TCK_SPEC_SOURCE;

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const file of pin.files) {
  const contents = source
    ? await readFile(join(source, file))
    : Buffer.from(await get(`https://raw.githubusercontent.com/${pin.repository}/${pin.version}/${file}`));

  await writeFile(join(target, basename(file)), contents);
  console.log(`wrote ${basename(file)} from ${source ?? `${pin.repository}@${pin.version}`}`);
}

console.log(`wrote ${names.length} feature file(s) to ${target}`);

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  return response.arrayBuffer();
}
