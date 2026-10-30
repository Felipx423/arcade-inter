import { randomTicket, selectPrize, totalUnits } from './random.mjs';

const DATABASE = 'maquina-de-brindes-v1';
const request = operation => new Promise((resolve, reject) => {
  operation.onsuccess = () => resolve(operation.result);
  operation.onerror = () => reject(operation.error);
});
const finished = transaction => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve;
  transaction.onabort = () => reject(transaction.error || new Error('A operação foi cancelada.'));
  transaction.onerror = () => {}; // onabort informa a falha da transação inteira.
});

export function openDatabase(name = DATABASE) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore('prizes', { keyPath: 'id' });
      opening.result.createObjectStore('state', { keyPath: 'key' });
    };
    opening.onsuccess = () => {
      const db = opening.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('Feche outras abas da máquina e tente novamente.'));
  });
}

async function transact(db, stores, mode, action) {
  const tx = db.transaction(stores, mode);
  const complete = finished(tx);
  try {
    const value = await action(tx);
    await complete;
    return value;
  } catch (error) {
    try { tx.abort(); } catch { /* A transação pode já ter terminado. */ }
    await complete.catch(() => {});
    throw error;
  }
}

export async function readSnapshot(db) {
  return transact(db, ['prizes', 'state'], 'readonly', async tx => {
    const [prizes, result] = await Promise.all([
      request(tx.objectStore('prizes').getAll()),
      request(tx.objectStore('state').get('result')),
    ]);
    prizes.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return { prizes, result: result?.value || null };
  });
}

function validQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
    throw new Error('Informe uma quantidade inteira entre 0 e 100.000.');
  }
}

export async function savePrize(db, { id, name, quantity, photo }) {
  name = name.trim();
  if (!name || name.length > 80) throw new Error('Informe um nome com até 80 caracteres.');
  validQuantity(quantity);
  return transact(db, ['prizes', 'state'], 'readwrite', async tx => {
    const store = tx.objectStore('prizes');
    const previous = id ? await request(store.get(id)) : null;
    if (id && !previous) throw new Error('Esse brinde já foi excluído.');
    const image = photo || previous?.photo;
    if (!(image instanceof Blob) || !image.size) throw new Error('Escolha uma foto para o brinde.');
    const prize = {
      id: id || crypto.randomUUID(), name, quantity, photo: image,
      createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now(),
    };
    await request(store.put(prize));
    return prize;
  });
}

export async function restockPrize(db, id) {
  return transact(db, ['prizes', 'state'], 'readwrite', async tx => {
    const store = tx.objectStore('prizes');
    const prize = await request(store.get(id));
    if (!prize) throw new Error('Esse brinde já foi excluído.');
    validQuantity(prize.quantity + 1);
    prize.quantity += 1;
    prize.updatedAt = Date.now();
    await request(store.put(prize));
  });
}

export async function removePrize(db, id) {
  return transact(db, ['prizes', 'state'], 'readwrite', tx => request(tx.objectStore('prizes').delete(id)));
}

export async function drawPrize(db, pickTicket = randomTicket) {
  // Resultado e estoque pertencem à mesma transação: ambos salvam ou nenhum salva.
  // Transações readwrite também serializam cliques vindos de duas abas.
  return transact(db, ['prizes', 'state'], 'readwrite', async tx => {
    const state = tx.objectStore('state');
    const existing = await request(state.get('result'));
    if (existing?.value) return existing.value;
    const prizes = await request(tx.objectStore('prizes').getAll());
    const total = totalUnits(prizes);
    if (!total) throw new Error('Todos os brindes acabaram. Reponha o estoque para continuar.');
    const selected = selectPrize(prizes, pickTicket(total));
    const result = {
      id: crypto.randomUUID(), prizeId: selected.id, name: selected.name,
      photo: selected.photo, drawnAt: Date.now(),
    };
    selected.quantity -= 1;
    selected.updatedAt = Date.now();
    await request(tx.objectStore('prizes').put(selected));
    await request(state.put({ key: 'result', value: result }));
    return result;
  });
}

export async function clearResult(db) {
  return transact(db, ['prizes', 'state'], 'readwrite', tx => request(tx.objectStore('state').delete('result')));
}

export async function addExamples(db, examples) {
  return transact(db, ['prizes', 'state'], 'readwrite', async tx => {
    const store = tx.objectStore('prizes');
    if (await request(store.count())) throw new Error('Os exemplos só podem ser carregados com o cadastro vazio.');
    for (const example of examples) {
      await request(store.put({ ...example, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }));
    }
  });
}
