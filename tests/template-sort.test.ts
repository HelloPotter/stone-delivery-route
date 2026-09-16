import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStop, sortByTemplate } from '../lib/model.ts';
test('template sort retains groups, flags, stop IDs and unknown customers', () => {
  const template = ['a','b','c','d'].map(makeStop);
  const stops = ['d','c','a','b','new'].map(makeStop);
  stops[1] = {...stops[1], group:'g', groupName:'停一站', meat:true, done:true};
  stops[2] = {...stops[2], group:'g', groupName:'停一站'};
  const before=JSON.stringify(stops);
  const result=sortByTemplate(stops,template);
  assert.deepEqual(result.map(s=>s.customerId),['a','c','b','d','new']);
  assert.equal(result[1],stops[1]);
  assert.equal(JSON.stringify(stops),before);
  assert.deepEqual(sortByTemplate(result,template),result);
  assert.deepEqual(sortByTemplate(stops,[]),stops);
});
