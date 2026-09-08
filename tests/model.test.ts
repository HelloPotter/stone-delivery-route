import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStop,blocks,moveBlock,resetStops,missed,previousPending,coordinate} from '../lib/model.ts';
test('move a parking group intact',()=>{const a=makeStop('a'),b=makeStop('b'),c=makeStop('c');a.group=b.group='g';assert.equal(blocks([a,b,c]).length,2);assert.deepEqual(moveBlock([a,b,c],0,1).map(s=>s.customerId),['c','a','b'])});
test('reload clears daily conditions and delivery while retaining groups',()=>{const a={...makeStop('a'),group:'g',meat:true,cash:true,returns:true,done:true};const r=resetStops([a])[0];assert.equal(r.group,'g');assert.notEqual(r.id,a.id);assert.equal(r.meat||r.cash||r.returns||r.done,false)});
test('late delivery identifies earlier unfinished customers',()=>{const a=makeStop('a'),b=makeStop('b'),c={...makeStop('c'),done:true};a.group=b.group='g';assert.deepEqual(missed([a,b,c]),[a.id,b.id]);assert.equal(previousPending([a,b,c],b.id).length,0);assert.equal(previousPending([a,b,c],c.id).length,2)});
test('validates decimal and DMS coordinates',()=>{assert.equal(coordinate('91, 10'),null);assert.equal(coordinate('49.1,-123.2'),'49.1,-123.2');assert.ok(coordinate('49°11\'14.4"N 123°07\'58.7"W'))});
