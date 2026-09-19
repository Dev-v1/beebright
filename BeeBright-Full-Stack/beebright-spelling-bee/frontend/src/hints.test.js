import test from 'node:test';
import assert from 'node:assert/strict';
import { hideSpelling, sentenceHint } from './hints.js';

test('blank exact spellings including accents and phrases', () => {
  assert.equal(hideSpelling('The statue is made of bronze.', 'bronze'), 'The statue is made of ___.');
  assert.equal(hideSpelling('She practiced an étude.', 'étude'), 'She practiced an ___.');
  assert.equal(hideSpelling('They cooked it sous vide.', 'sous vide'), 'They cooked it ___.');
  assert.equal(hideSpelling('An umbrella covers an umbel.', 'umbel'), 'An umbrella covers an ___.');
});
test('do not manufacture a sentence from loading or error messages', () => {
  assert.equal(sentenceHint('Loading example sentence...', 'bronze'), 'Loading example sentence...');
  assert.equal(sentenceHint('Example sentence is temporarily unavailable.', 'bronze'), 'Example sentence is temporarily unavailable.');
});
