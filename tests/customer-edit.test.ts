import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateCustomer, makeStop, newTask, type Data } from '../lib/model.ts';
test('renumber keeps all route links, grouping, progress and selection intact', () => {
  const customer = { id: 'temp', short: '', name: '店', address: '地址', coords: '', note: '' };
  const stop = { ...makeStop('temp'), done: true, group: 'group', groupName: '停一站' };
  const data: Data = { customers: [customer], task: { ...newTask(), stops: [stop], selecting: true, keepIds: [stop.id] }, template: [stop], last: [stop], history: [{ date: '2026-09-10', stops: [stop], startedAt: 100, endedAt: 200 }] };
  const result = updateCustomer(data, 'temp', { ...customer, id: '001234' });
  for (const stops of [result.task.stops, result.template, result.last, result.history[0].stops]) assert.deepEqual(stops[0], { ...stop, customerId: '001234' });
  assert.deepEqual(result.task.keepIds, [stop.id]);
  assert.equal(result.history[0].endedAt, 200);
  assert.equal(data.customers[0].id, 'temp');
  assert.equal(data.task.stops[0].customerId, 'temp');
  assert.throws(() => updateCustomer({ ...data, customers: [...data.customers, { ...customer, id: '001234' }] }, 'temp', { ...customer, id: '001234' }), /已存在/);
  assert.throws(() => updateCustomer(data, 'missing', customer), /已存在|已变化/);
});
