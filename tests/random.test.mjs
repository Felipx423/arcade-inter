import test from 'node:test';
import assert from 'node:assert/strict';
import { totalUnits, selectPrize, randomTicket } from '../src/random.mjs';

test('10 canetas e 1 camiseta ocupam exatamente 10 e 1 bilhetes', () => {
  const prizes = [{ id: 'caneta', quantity: 10 }, { id: 'camiseta', quantity: 1 }];
  const results = Array.from({ length: 11 }, (_, ticket) => selectPrize(prizes, ticket).id);
  assert.equal(results.filter(id => id === 'caneta').length, 10);
  assert.equal(results.filter(id => id === 'camiseta').length, 1);
});

test('brindes esgotados não ocupam bilhetes', () => {
  const prizes = [{ id: 'vazio', quantity: 0 }, { id: 'ultimo', quantity: 1 }, { id: 'vazio2', quantity: 0 }];
  assert.equal(totalUnits(prizes), 1);
  assert.equal(selectPrize(prizes, 0).id, 'ultimo');
});

test('limites entre brindes apontam para a unidade correta', () => {
  const prizes = [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 3 }, { id: 'c', quantity: 1 }];
  assert.deepEqual([0, 1, 2, 4, 5].map(ticket => selectPrize(prizes, ticket).id), ['a', 'a', 'b', 'b', 'c']);
});

test('estoque vazio e bilhetes inválidos são rejeitados', () => {
  assert.equal(totalUnits([]), 0);
  for (const ticket of [-1, 1, 0.5, NaN]) {
    assert.throws(() => selectPrize([{ quantity: 1 }], ticket), RangeError);
  }
  assert.throws(() => selectPrize([], 0), RangeError);
});

test('sorteio descarta a sobra do intervalo para evitar viés', () => {
  let attempts = 0;
  const source = values => { values[0] = attempts++ === 0 ? 0xffffffff : 12; };
  assert.equal(randomTicket(11, source), 1);
  assert.equal(attempts, 2);
});

test('uma unidade sempre seleciona o único bilhete', () => {
  assert.equal(randomTicket(1, values => { values[0] = 0xffffffff; }), 0);
});

test('quantidade total inválida não inicia sorteio', () => {
  for (const total of [0, -1, 1.5, Infinity, 0x100000001]) assert.throws(() => randomTicket(total), RangeError);
});

