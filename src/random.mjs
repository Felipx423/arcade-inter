// Cada unidade disponível é um bilhete. O intervalo é [0, total).
export function totalUnits(prizes) {
  return prizes.reduce((sum, prize) => sum + prize.quantity, 0);
}

export function randomTicket(total, fill = values => globalThis.crypto.getRandomValues(values)) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 0x100000000) {
    throw new RangeError('Quantidade total inválida para o sorteio.');
  }
  // Descarta a sobra do intervalo para não favorecer os primeiros bilhetes.
  const limit = Math.floor(0x100000000 / total) * total;
  const values = new Uint32Array(1);
  do { fill(values); } while (values[0] >= limit);
  return values[0] % total;
}

export function selectPrize(prizes, ticket) {
  const total = totalUnits(prizes);
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= total) {
    throw new RangeError('Bilhete fora do intervalo disponível.');
  }
  let boundary = 0;
  for (const prize of prizes) {
    boundary += prize.quantity;
    if (ticket < boundary) return prize;
  }
  throw new Error('Não foi possível selecionar um brinde.');
}
