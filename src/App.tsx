import { prefersReducedMotion } from './motion';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import MachineScene from './MachineScene';
import { boundAim, capsulePositions, nearestCapsule } from './controller';
import * as storage from './storage';
import type { Aim, Capture, CapsulePose, DrawResult, GamePhase, Prize, Snapshot } from './types';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const totalOf = (p: Prize[]) => p.reduce((n, item) => n + item.quantity, 0);
function useBlobURL(blob?: Blob | null) {
  const [url, setURL] = useState('');
  useEffect(() => { if (!blob) { setURL(''); return; } const next = URL.createObjectURL(blob); setURL(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}
function Icon({ name }: { name: string }) { return <img className="ui-icon" src={`/icons/${name}.svg`} alt="" aria-hidden="true" />; }
function BlobImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const src = useBlobURL(blob); return src ? <img src={src} alt={alt} className={className} /> : null;
}
async function validatePhoto(file: File | null) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A foto deve ter no máximo 8 MB.');
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.src = url; await img.decode(); } catch { throw new Error('Não foi possível abrir a foto. Escolha outra imagem.'); } finally { URL.revokeObjectURL(url); }
}

export default function App() {
  const database = useRef<IDBDatabase | null>(null);
  const activeCapture = useRef<Capture | null>(null);
  const gpuRef = useRef(false);
  const liveCapsules = useRef<CapsulePose[]>([]);
  const updateCapsules = useCallback((poses: CapsulePose[]) => { liveCapsules.current = poses; }, []);
  const [snapshot, setSnapshot] = useState<Snapshot>({ prizes: [], result: null });
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [gpu, setGPU] = useState(false);
  const [gpuFailed, setGPUFailed] = useState(false);
  const [aim, setAim] = useState<Aim>({ x: 0, z: 0 });
  const aimRef = useRef<Aim>(aim);
  aimRef.current = aim;
  const [status, setStatus] = useState('Acendendo as luzes do arcade…');
  const [toast, setToast] = useState('');
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [managerOpen, setManagerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<'prizes' | 'help' | null>(null);
  const info = useRef<HTMLDialogElement>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const manager = useRef<HTMLDialogElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const [toDelete, setToDelete] = useState<Prize | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const preview = useBlobURL(file || editing?.photo);
  const drag = useRef<{ x: number; y: number; aim: Aim } | null>(null);
  const total = useMemo(() => totalOf(snapshot.prizes), [snapshot.prizes]);
  const busy = phase === 'saving' || phase === 'animating';
  const interactive = gpu && phase === 'idle' && !managerOpen && !infoOpen && !saving;

  const notify = useCallback((message: string) => {
    setToast(message); clearTimeout(toastTimeout.current); toastTimeout.current = setTimeout(() => setToast(''), 5500);
  }, []);
  const report = useCallback((error: unknown) => {
    const e = error as Error;
    notify(e.name === 'QuotaExceededError' ? 'O navegador está sem espaço. Tente uma foto menor.' : e.message || 'Não foi possível concluir. Tente novamente.');
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    storage.openDatabase().then(async db => {
      if (cancelled) { db.close(); return; }
      database.current = db;
      const data = await storage.readSnapshot(db);
      if (!cancelled) { setSnapshot(data); setPhase(data.result ? 'revealed' : 'idle'); }
    }).catch(error => { if (!cancelled) { report(error); setPhase('idle'); setStatus('Armazenamento indisponível. Verifique as permissões do navegador.'); } });
    return () => { cancelled = true; database.current?.close(); clearTimeout(toastTimeout.current); };
  }, [report]);

  const refresh = useCallback(async () => { if (database.current) { const data = await storage.readSnapshot(database.current); setSnapshot(data); return data; } }, []);
  const finishDelivery = useCallback(() => {
    if (!activeCapture.current) return;
    activeCapture.current = null; setCapture(null); setPhase('revealed');
    void refresh().catch(report);
  }, [refresh, report]);
  const ready = useCallback(() => { gpuRef.current = true; setGPU(true); }, []);
  const unavailable = useCallback(() => { gpuRef.current = false; setGPU(false); setGPUFailed(true); finishDelivery(); }, [finishDelivery]);
  const changeAim = useCallback((value: Aim) => {
    const next = boundAim(value);
    setAim(prev => (Math.abs(prev.x - next.x) < 1e-5 && Math.abs(prev.z - next.z) < 1e-5 ? prev : next));
  }, []);

  useEffect(() => {
    if (phase === 'idle') setStatus(total ? 'Mova a garra, escolha uma cápsula e aperte Pegar.' : 'Sua máquina está pronta. Cadastre os brindes para começar.');
    if (phase === 'revealed' && snapshot.result) setStatus(`Você ganhou: ${snapshot.result.name}.`);
  }, [phase, total, snapshot.result]);
  useEffect(() => {
    const onFocus = () => {
      if (database.current && !activeCapture.current && phase !== 'saving' && !saving) {
        void storage.readSnapshot(database.current).then(data => { setSnapshot(data); setPhase(data.result ? 'revealed' : 'idle'); }).catch(report);
      }
    };
    window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus);
  }, [phase, saving, report]);

  const grab = useCallback(async () => {
    if (!database.current || !gpuRef.current || phase !== 'idle' || managerOpen || infoOpen || saving || !total || activeCapture.current) return;
    setPhase('saving'); setStatus('Preparando sua surpresa…');
    // O bloqueio síncrono também cobre dois cliques antes de o React renderizar.
    const guard = { id: 'saving' } as Capture;
    activeCapture.current = guard;
    try {
      const currentAim = aimRef.current;
      const positions = liveCapsules.current.length === Math.min(12, total)
        ? liveCapsules.current.map(p => ({ ...p }))
        : capsulePositions(total).map(p => ({ ...p, y: 2.385 }));
      const targetIndex = nearestCapsule(positions, currentAim);
      const result = await storage.drawPrize(database.current);
      const request: Capture = { id: result.id, result, target: positions[targetIndex], targetY: positions[targetIndex].y, targetIndex, count: total, reduced: prefersReducedMotion() };
      setSnapshot(await storage.readSnapshot(database.current));
      activeCapture.current = request;
      if (!gpuRef.current) { finishDelivery(); return; }
      setCapture(request); setPhase('animating');
    } catch (error) { activeCapture.current = null; setCapture(null); const saved = await refresh().catch(() => undefined); setPhase(saved?.result ? 'revealed' : 'idle'); report(error); }
  }, [phase, managerOpen, infoOpen, saving, total, finishDelivery, refresh, report]);

  const handleGrab = useCallback(() => { void grab(); }, [grab]);

  const next = useCallback(async () => {
    if (!database.current || phase !== 'revealed' || saving) return;
    setPhase('saving');
    try { await storage.clearResult(database.current); await refresh(); setAim({ x: 0, z: 0 }); setPhase('idle'); }
    catch (error) { setPhase('revealed'); report(error); }
  }, [phase, saving, refresh, report]);

  const grabRef = useRef(grab);
  grabRef.current = grab;
  useEffect(() => {
    if (!interactive) return;
    const keys = new Set<string>(); let frame = 0; let last = 0;
    const recognized = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
    const tick = (time: number) => {
      const delta = Math.min((time - (last || time)) / 1000, .05); last = time;
      const x = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      const z = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
      if (x || z) setAim(previous => {
        const nextAim = boundAim({ x: previous.x + x * delta * 1.8, z: previous.z + z * delta * 1.4 });
        return Math.abs(previous.x - nextAim.x) < 1e-5 && Math.abs(previous.z - nextAim.z) < 1e-5 ? previous : nextAim;
      });
      if (keys.size) frame = requestAnimationFrame(tick); else { frame = 0; last = 0; }
    };
    const down = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input, textarea, select, dialog')) return;
      if (recognized.includes(event.key)) {
        event.preventDefault();
        if (!keys.has(event.key)) {
          const dx = ['ArrowRight', 'd'].includes(event.key) ? .09 : ['ArrowLeft', 'a'].includes(event.key) ? -.09 : 0;
          const dz = ['ArrowDown', 's'].includes(event.key) ? .07 : ['ArrowUp', 'w'].includes(event.key) ? -.07 : 0;
          setAim(previous => boundAim({ x: previous.x + dx, z: previous.z + dz }));
        }
        keys.add(event.key); if (!frame) frame = requestAnimationFrame(tick);
      }
      else if ((event.key === 'Enter' || event.key === ' ') && !(event.target as Element)?.closest('button, a')) { event.preventDefault(); void grabRef.current(); }
    };
    const up = (event: KeyboardEvent) => { keys.delete(event.key); };
    const blur = () => { keys.clear(); cancelAnimationFrame(frame); frame = 0; last = 0; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { blur(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [interactive]);

  useEffect(() => {
    if (managerOpen && !manager.current?.open) manager.current?.showModal();
    if (!managerOpen && manager.current?.open) manager.current.close();
  }, [managerOpen]);
  useEffect(() => {
    if (toDelete && !confirmation.current?.open) confirmation.current?.showModal();
    if (!toDelete && confirmation.current?.open) confirmation.current.close();
  }, [toDelete]);

  useEffect(() => {
    if (infoOpen && !info.current?.open) info.current?.showModal();
    if (!infoOpen && info.current?.open) info.current.close();
  }, [infoOpen]);

  const resetForm = useCallback(() => { setEditing(null); setName(''); setQuantity('1'); setFile(null); setFormKey(key => key + 1); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!database.current || saving) return; setSaving(true);
    try { await validatePhoto(file); await storage.savePrize(database.current, { id: editing?.id, name, quantity: Number(quantity), photo: file }); await refresh(); resetForm(); notify(editing ? 'Brinde atualizado.' : 'Brinde cadastrado!'); }
    catch (error) { report(error); } finally { setSaving(false); }
  };
  const restock = useCallback(async (prize: Prize) => {
    if (!database.current || saving) return; setSaving(true);
    try { await storage.restockPrize(database.current, prize.id); await refresh(); if (editing?.id === prize.id) setQuantity(String(prize.quantity + 1)); notify('Mais uma unidade no estoque!'); } catch (error) { report(error); } finally { setSaving(false); }
  }, [saving, refresh, editing?.id, notify, report]);
  const remove = async () => {
    if (!database.current || !toDelete || saving) return; setSaving(true);
    try { await storage.removePrize(database.current, toDelete.id); await refresh(); if (editing?.id === toDelete.id) resetForm(); setToDelete(null); notify('Brinde excluído.'); } catch (error) { report(error); } finally { setSaving(false); }
  };
  const examples = async () => {
    if (!database.current || snapshot.prizes.length || saving) return; setSaving(true);
    try {
      const records = [];
      for (const [name, quantity, path] of [['Caneca — exemplo', 5, 'caneca.svg'], ['Ecobag — exemplo', 3, 'ecobag.svg'], ['Fone — exemplo', 1, 'fone.svg']] as const) {
        const response = await fetch(`./examples/${path}`); if (!response.ok) throw new Error('Não foi possível carregar os exemplos.'); records.push({ name, quantity, photo: await response.blob() });
      }
      await storage.addExamples(database.current, records); await refresh(); notify('Exemplos carregados. Pode voltar à máquina!');
    } catch (error) { report(error); } finally { setSaving(false); }
  };
  const step = (dx: number, dz: number) => { if (interactive) changeAim({ x: aimRef.current.x + dx, z: aimRef.current.z + dz }); };

  const prizeGallery = useMemo(() => (
    <div className="prize-gallery">
      {snapshot.prizes.filter(p => p.quantity > 0).map(p => <article key={p.id}><BlobImage blob={p.photo} alt={p.name} /><h3>{p.name}</h3><p>{fmt(p.quantity)} disponíveis</p></article>)}
      {!total && <p>Os próximos brindes aparecem aqui assim que a máquina for abastecida.</p>}
    </div>
  ), [snapshot.prizes, total]);

  const inventoryList = useMemo(() => (
    <div className="inventory-list">
      {snapshot.prizes.map(prize => <article className="inventory-card" key={prize.id}><BlobImage blob={prize.photo} alt={prize.name} /><div className="inventory-info"><h4>{prize.name}</h4><p>{prize.quantity ? `${fmt(prize.quantity)} ${prize.quantity === 1 ? 'unidade' : 'unidades'}` : 'Esgotado'}<span>{total && prize.quantity ? `${(prize.quantity / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de chance` : 'Fora do sorteio'}</span></p></div><div className="inventory-actions"><button disabled={saving} aria-label={`Repor uma unidade: ${prize.name}`} onClick={() => void restock(prize)}>+1 unidade</button><button disabled={saving} aria-label={`Editar: ${prize.name}`} onClick={() => { setEditing(prize); setName(prize.name); setQuantity(String(prize.quantity)); setFile(null); setFormKey(key => key + 1); manager.current?.querySelector('.manager-content')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button><button className="delete-button" disabled={saving} aria-label={`Excluir: ${prize.name}`} onClick={() => setToDelete(prize)}>Excluir</button></div></article>)}
    </div>
  ), [snapshot.prizes, total, saving, restock]);

  return <div className="app-shell">
    <a className="skip-link" href="#game-controls">Pular para os controles</a>
    <header className="topbar">
      <a className="brand" href="#game-controls" aria-label="Pega! Início">Pega</a>
      <nav className="main-nav" aria-label="Navegação principal">
        <button className="nav-link" onClick={() => { setInfoOpen(null); setManagerOpen(false); document.querySelector<HTMLButtonElement>('.grab-button')?.focus(); }}>Jogar</button>
        <button className="nav-link" disabled={busy} onClick={() => setInfoOpen('prizes')}>Brindes</button>
        <button className="nav-link" disabled={busy} onClick={() => setInfoOpen('help')}>Como funciona</button>
      </nav>
      <button className="manage-button" type="button" onClick={() => setManagerOpen(true)} disabled={busy}>Meus brindes</button>
    </header>
    <main className="arcade-main" aria-label="Arcade Pega!">
      <div className="scene-host" aria-label="Máquina de garra 3D, vista frontal">
        <MachineScene total={total} aim={aim} capture={capture} result={phase === 'revealed' ? snapshot.result : null} interactive={interactive} canGrab={interactive && total > 0}
          onAim={changeAim} onPositions={updateCapsules} onGrab={handleGrab} onDelivered={finishDelivery} onReady={ready} onUnavailable={unavailable} onStatus={setStatus} />
      </div>
      {phase === 'idle' && !total && <div className="empty-callout"><strong>{snapshot.prizes.length ? 'Brindes esgotados' : 'A próxima surpresa é sua.'}</strong><p>Abasteça a máquina para começar a jogar.</p><button onClick={() => setManagerOpen(true)}>Adicionar brindes</button></div>}
      {gpuFailed && <div className="gpu-note" role="alert">O 3D está indisponível. Seus dados estão preservados. Você pode continuar organizando os brindes.</div>}
      {phase === 'revealed' && snapshot.result && <section className="result-card" aria-labelledby="result-name"><div className="result-thumb"><BlobImage blob={snapshot.result.photo} alt={snapshot.result.name} /></div><div><span>SEU BRINDE</span><h2 id="result-name" tabIndex={-1}>{snapshot.result.name}</h2><p>Uma surpresa para chamar de sua.</p></div></section>}
    </main>
    <section className="control-dock" id="game-controls" aria-label="Controles da garra">
      <div className="joystick-wrap">
        <div className={`joystick-pad ${!interactive ? 'is-disabled' : ''}`} role="slider" tabIndex={interactive ? 0 : -1} aria-label="Joystick da garra. Arraste ou use setas e WASD" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(aim.x / 1.12 * 100)} aria-valuetext={`Horizontal ${Math.round(aim.x / 1.12 * 100)}%, profundidade ${Math.round(aim.z / .72 * 100)}%`} aria-disabled={!interactive}
          onPointerDown={event => { if (!interactive) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, aim: { ...aimRef.current } }; event.currentTarget.focus(); }}
          onPointerMove={event => { if (drag.current && interactive) changeAim({ x: drag.current.aim.x + (event.clientX - drag.current.x) * .025, z: drag.current.aim.z + (event.clientY - drag.current.y) * .02 }); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <span className="joystick-indicator" style={{ transform: `translate(${aim.x / 1.12 * 5}px, ${aim.z / .72 * 5}px)` }}><Icon name="joystick" /></span>
        </div>
        <button className="direction-toggle" aria-label="Mostrar botões de direção" aria-expanded={directionsOpen} aria-controls="direction-pad" disabled={!interactive} onClick={() => setDirectionsOpen(!directionsOpen)}><Icon name={directionsOpen ? 'x' : 'arrow-right'} /></button>
      </div>
      {directionsOpen && <div className="direction-pad" id="direction-pad" aria-label="Direções da garra">
        <button aria-label="Mover garra para trás" disabled={!interactive} onClick={() => step(0, -.18)}><Icon name="arrow-up" /></button>
        <button aria-label="Mover garra para esquerda" disabled={!interactive} onClick={() => step(-.18, 0)}><Icon name="arrow-left" /></button>
        <button aria-label="Mover garra para frente" disabled={!interactive} onClick={() => step(0, .18)}><Icon name="arrow-down" /></button>
        <button aria-label="Mover garra para direita" disabled={!interactive} onClick={() => step(.18, 0)}><Icon name="arrow-right" /></button>
        <span>Setas ou WASD</span>
      </div>}
      <button className="grab-button" type="button" disabled={busy || phase === 'loading' || saving || (phase !== 'revealed' && (!gpu || !database.current || total === 0))} onClick={() => void (phase === 'revealed' ? next() : grab())}>
        {phase === 'revealed' ? 'Próximo sorteio' : busy ? 'Pegando…' : 'Pegar'}
      </button>
      <div className="dock-stock" aria-label={`${fmt(total)} brindes disponíveis`}><Icon name="package" /><span><strong>{fmt(total)}</strong><small>brindes</small></span></div>
    </section>
    <p className={`live-status ${busy ? 'is-visible' : ''}`} role="status" aria-live="polite">{status}</p>

    <dialog ref={info} className="info-dialog" onCancel={() => setInfoOpen(null)} onClose={() => setInfoOpen(null)} aria-labelledby="info-title">
      <div className="info-heading"><h2 id="info-title">{infoOpen === 'help' ? 'Como funciona' : 'Dentro da máquina'}</h2><button className="icon-button" aria-label="Fechar informações" onClick={() => setInfoOpen(null)}><Icon name="x" /></button></div>
      {infoOpen === 'help' ? <div className="how-it-works"><p>Uma cápsula. Uma boa surpresa.</p><ol><li><strong>Mova a garra.</strong><span>Arraste o joystick da máquina ou da barra. Também vale usar as setas, WASD ou os botões de direção.</span></li><li><strong>Aperte Pegar.</strong><span>A garra busca a cápsula mais próxima da mira e entrega seu brinde. Você também pode usar Enter.</span></li><li><strong>Descubra seu prêmio.</strong><span>O brinde é sempre aleatório: cada unidade disponível tem uma chance, independentemente da mira.</span></li></ol><p className="info-footnote">O resultado fica salvo até você escolher Próximo sorteio. A máquina funciona offline neste navegador.</p></div> : prizeGallery}
    </dialog>

    <dialog className="manager-dialog" ref={manager} onCancel={() => setManagerOpen(false)} onClose={() => setManagerOpen(false)} aria-labelledby="manager-title">
      <div className="manager-header"><div><span>BASTIDORES DO ARCADE</span><h2 id="manager-title">Meus brindes<span>.</span></h2></div><button className="icon-button" aria-label="Fechar meus brindes" onClick={() => setManagerOpen(false)}><Icon name="x" /></button></div>
      <div className="manager-content"><p className="manager-intro">Suas fotos, seus brindes. A sorte fica por nossa conta.</p>
        <form onSubmit={submit} className="prize-form" key={formKey}><h3>{editing ? 'Editar brinde' : 'Abasteça a máquina'}</h3>
          <label>Nome do brinde<input name="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Caneca da turma" disabled={saving} /></label>
          <label>Quantidade disponível<input name="quantity" required type="number" min="0" max="100000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={saving} /></label>
          <label>Foto do brinde<div className="photo-field">{preview && <img src={preview} alt="Prévia da foto do brinde" />}<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required={!editing} disabled={saving} onChange={e => setFile(e.target.files?.[0] || null)} /></div><small>PNG, JPG ou WebP de até 8 MB.{editing ? ' Sem nova seleção, a foto atual será mantida.' : ''}</small></label>
          <div className="form-actions"><button className="primary-button" type="submit" disabled={saving || !database.current}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar brinde'}</button>{editing && <button className="secondary-button" type="button" disabled={saving} onClick={resetForm}>Cancelar edição</button>}</div>
        </form>
        <div className="inventory-title"><h3>Na máquina</h3><span>{fmt(total)} unidades</span></div>
        {!snapshot.prizes.length && <div className="inventory-empty"><strong>A primeira surpresa começa aqui.</strong><p>Cadastre um brinde com foto ou experimente as ilustrações de exemplo.</p><button className="secondary-button" onClick={() => void examples()} disabled={saving || !database.current}>Carregar exemplos ilustrativos</button></div>}
        {inventoryList}
        <p className="storage-note">As fotos e o estoque ficam neste navegador. Limpar os dados do site apaga o cadastro. A posição da garra não altera as chances do sorteio.</p>
      </div>
    </dialog>
    <dialog className="confirm-dialog" ref={confirmation} onCancel={() => setToDelete(null)} onClose={() => setToDelete(null)} aria-labelledby="confirm-title"><span className="dialog-kicker">ORGANIZAR OS BRINDES</span><h2 id="confirm-title">Excluir este brinde?</h2><p>“{toDelete?.name}” e seu estoque serão removidos. Um resultado já sorteado será preservado.</p><div><button className="secondary-button" disabled={saving} onClick={() => setToDelete(null)}>Cancelar</button><button className="danger-button" disabled={saving} onClick={() => void remove()}>Excluir brinde</button></div></dialog>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
