import {Quiz, PRIZES, validateBank} from '../static/engine.js';
import {StudioAudio} from '../static/audio.js';
const results = [];
function record(message) { results.push(message); document.getElementById('results').textContent = `RUNNING (${results.length})\n${results.join('\n')}`; }
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
function test(name, run) { run(); record(`PASS ${name}`); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) { for (let i = 0; i < 120; i++) { if (predicate()) return; await wait(50); } throw new Error(`Timeout: ${label}`); }
try {
  const bank = await (await fetch('../static/questions.json')).json();
  const correct = quiz => { quiz.select(quiz.correctIndex); assert(quiz.answer(), 'correct answer rejected'); };
  const reach = (quiz, level) => { quiz.start(); while (quiz.state.level < level) { correct(quiz); quiz.next(); } };
  test('180 domande tecniche, 15 livelli e validazione dati', () => {
    equal(bank.length, 180, 'bank size'); validateBank(bank);
    for (let n = 1; n <= 15; n++) equal(bank.filter(q => q.level === n).length, 12, 'pool size');
    let rejected = false;
    try { validateBank(bank.filter(q => q.level !== 15)); } catch { rejected = true; }
    assert(rejected, 'missing level accepted');
    let generalRejected = false;
    try { validateBank(bank.map((q, i) => i === 0 ? {...q, subject: 'Cultura generale'} : q)); } catch { generalRejected = true; }
    assert(generalRejected, 'general subject accepted');
  });
  test('Pool completo anche allo start e alla ripresa di vecchie partite', () => {
    const full = new Quiz(bank, () => 0.999);
    full.start();
    for (let level = 1; level <= 15; level++) {
      equal(full.question.subject, 'Functional Programming', 'FP excluded from pool');
      assert(new Quiz(bank).restore(full.snapshot()), 'restore full pool');
      correct(full); if (level < 15) full.next();
    }
    const old = new Quiz(bank, () => 0); old.start();
    const saved = JSON.parse(old.snapshot()); saved.includeFunctional = false;
    const restored = new Quiz(bank, () => 0.999);
    assert(restored.restore(JSON.stringify(saved)), 'old save cannot resume');
    equal(restored.question.id, old.question.id, 'saved question changed');
    correct(restored); restored.next();
    equal(restored.question.subject, 'Functional Programming', 'old preference still filters pool');
  });
  test('Partita perfetta, scala premi e traguardi', () => {
    const quiz = new Quiz(bank); quiz.start();
    for (let level = 1; level <= 15; level++) {
      equal(quiz.state.level, level, 'level'); correct(quiz);
      equal(quiz.state.earned, PRIZES[level - 1], 'prize');
      equal(quiz.state.guaranteed, level >= 15 ? 1000000 : level >= 10 ? 32000 : level >= 5 ? 1000 : 0, 'guarantee');
      const restored = new Quiz(bank); assert(restored.restore(quiz.snapshot()), 'restore after correct');
      if (level < 15) { assert(quiz.next(), 'next'); assert(new Quiz(bank).restore(quiz.snapshot()), 'restore next question'); }
    }
    equal(quiz.state.outcome, 'win', 'victory'); assert(!quiz.next(), 'advance after victory'); assert(!quiz.help('switch'), 'help after victory');
  });
  test('Errore a tutti i livelli e persistenza del verdetto', () => {
    for (let level = 1; level <= 15; level++) {
      const quiz = new Quiz(bank); reach(quiz, level); quiz.select((quiz.correctIndex + 1) % 4); equal(quiz.answer(), false, 'wrong answer');
      equal(quiz.state.earned, level > 10 ? 32000 : level > 5 ? 1000 : 0, 'fallback prize');
      equal(quiz.state.phase, 'finished', 'end'); assert(new Quiz(bank).restore(quiz.snapshot()), 'restore wrong');
    }
  });
  test('Ritiro a tutti i livelli', () => {
    for (let level = 1; level <= 15; level++) {
      const quiz = new Quiz(bank); reach(quiz, level); assert(quiz.walk(), 'walk');
      equal(quiz.state.earned, PRIZES[level - 2] || 0, 'walk prize'); assert(new Quiz(bank).restore(quiz.snapshot()), 'restore walk');
    }
  });
  test('50:50 preserva la corretta e cancella una selezione eliminata', () => {
    const quiz = new Quiz(bank, () => 0.25); quiz.start();
    const wrong = [0,1,2,3].filter(i => i !== quiz.correctIndex); quiz.select(wrong[1]);
    assert(quiz.help('fifty'), 'fifty'); equal(quiz.state.eliminated.length, 2, 'removed');
    assert(!quiz.state.eliminated.includes(quiz.correctIndex), 'correct removed');
    assert(!quiz.select(quiz.state.eliminated[0]), 'selected eliminated');
    if (quiz.state.eliminated.includes(wrong[1])) equal(quiz.state.selected, null, 'selection reset');
    assert(!quiz.help('fifty'), 'reused fifty'); assert(new Quiz(bank).restore(quiz.snapshot()), 'restore fifty');
  });
  test('Switch: altra domanda, stesso livello, aiuti consumati e reset dei benefici', () => {
    const quiz = new Quiz(bank); reach(quiz, 8); const old = quiz.question.id;
    quiz.help('fifty'); quiz.help('audience'); quiz.select(quiz.correctIndex); quiz.help('switch');
    assert(quiz.question.id !== old, 'question not replaced'); equal(quiz.state.level, 8, 'switch level');
    equal(quiz.state.helps, {fifty: true, audience: true, switch: true}, 'used helps');
    equal(quiz.state.eliminated, [], 'reset eliminated'); equal(quiz.state.poll, null, 'reset audience'); equal(quiz.state.selected, null, 'reset selection');
    assert(!quiz.help('switch'), 'reused switch'); assert(new Quiz(bank).restore(quiz.snapshot()), 'restore switch');
  });
  test('Pubblico: percentuali corrette, esclusioni, nessun nuovo voto', () => {
    for (let run = 0; run < 100; run++) {
      const quiz = new Quiz(bank); quiz.start(); if (run % 2) quiz.help('fifty'); quiz.help('audience');
      equal(quiz.state.poll.reduce((a,b) => a+b, 0), 100, 'poll total');
      for (const index of quiz.state.eliminated) equal(quiz.state.poll[index], 0, 'eliminated votes');
      const poll = [...quiz.state.poll]; assert(!quiz.help('audience'), 'audience reused'); equal(quiz.state.poll, poll, 'poll changed');
      assert(new Quiz(bank).restore(quiz.snapshot()), 'restore poll');
    }
  });
  test('Azioni non valide e salvataggi corrotti', () => {
    const quiz = new Quiz(bank); quiz.start(); equal(quiz.answer(), null, 'empty answer'); assert(!quiz.select(5), 'bad selection');
    assert(!quiz.help('unknown'), 'bad help'); assert(!quiz.next(), 'premature next');
    for (const value of ['null', '{', '{}', '[]']) assert(!quiz.restore(value), 'bad restore');
    const state = JSON.parse(quiz.snapshot()); state.earned = 123456; assert(!new Quiz(bank).restore(JSON.stringify(state)), 'invalid prize');
    state.earned = 0; state.order = [0,0,1,2]; assert(!new Quiz(bank).restore(JSON.stringify(state)), 'duplicate option');
  });
  test('Randomizzazione di domande e risposte', () => {
    const questions = new Set(), orders = new Set();
    for (let i = 0; i < 70; i++) { const quiz = new Quiz(bank); quiz.start(); questions.add(quiz.question.id); orders.add(quiz.state.order.join(',')); }
    assert(questions.size > 1 && orders.size > 1, 'randomization absent');
  });
  // UI reale in iframe: selezione, aiuti, modali, ripresa e risultato.
  localStorage.removeItem('cvem.partita.v1'); localStorage.setItem('cvem.audio.v1', 'off');
  const frame = document.getElementById('app'); frame.src = '../static/';
  await until(() => frame.contentDocument?.getElementById('start')?.textContent === 'Entra in gioco ↗', 'app loaded');
  let doc = frame.contentDocument;
  assert(!doc.getElementById('functional'), 'initial checkbox still present');
  equal(doc.getElementById('bank-count').textContent, '180', 'full pool count');
  doc.getElementById('start').click();
  assert(!doc.getElementById('game').hidden, 'game not shown');
  assert(doc.querySelectorAll('.answer').length === 4, 'answer count');
  assert(doc.getElementById('confirm').disabled, 'confirm without selection');
  doc.getElementById('fifty').click(); assert(doc.querySelectorAll('.eliminated').length === 2, 'UI fifty');
  doc.getElementById('audience').click(); assert(doc.getElementById('modal').open, 'audience modal');
  assert(doc.querySelectorAll('.audience-row').length === 4, 'poll bars'); doc.querySelector('#modal-actions button').click();
  const oldQuestion = doc.getElementById('question').textContent;
  doc.getElementById('switch').click(); doc.querySelector('#modal-actions .primary').click();
  assert(doc.getElementById('question').textContent !== oldQuestion, 'UI switch unchanged');
  assert(doc.getElementById('fifty').disabled && doc.getElementById('switch').disabled, 'UI help reuse');
  const model = new Quiz(bank); assert(model.restore(localStorage.getItem('cvem.partita.v1')), 'UI state restore');
  doc.querySelectorAll('.answer')[model.correctIndex].click(); doc.getElementById('confirm').click();
  assert(doc.getElementById('walk').disabled, 'walk during reveal');
  await until(() => doc.getElementById('modal').open, 'correct modal');
  assert(doc.getElementById('modal-kicker').textContent === 'RISPOSTA ESATTA', 'correct verdict');
  doc.querySelector('#modal-actions button').click();
  assert(doc.getElementById('round-label').textContent.includes('02'), 'next level');
  const savedQuestion = doc.getElementById('question').textContent;
  frame.contentWindow.location.reload();
  await until(() => frame.contentDocument !== doc && frame.contentDocument?.getElementById('resume')?.hidden === false, 'resume available');
  doc = frame.contentDocument;
  doc.getElementById('resume').click();
  record('PASS Pool completo senza spunta e ripresa della partita');
  equal(doc.getElementById('question').textContent, savedQuestion, 'resume question');
  doc.getElementById('walk').click(); doc.querySelector('#modal-actions .primary').click();
  assert(!doc.getElementById('result').hidden, 'result screen'); equal(doc.getElementById('result-prize').textContent, '€ 100', 'UI walk prize');
  doc.getElementById('again').click(); assert(!doc.getElementById('fifty').disabled, 'new game help reset');
  const model2 = new Quiz(bank); model2.restore(localStorage.getItem('cvem.partita.v1'));
  doc.querySelectorAll('.answer')[(model2.correctIndex + 1) % 4].click(); doc.getElementById('confirm').click();
  await until(() => !doc.getElementById('result').hidden, 'wrong result');
  equal(doc.getElementById('result-prize').textContent, '€ 0', 'UI loss');
  assert(doc.getElementById('result-detail').textContent.includes('Risposta corretta'), 'missing explanation');
  record('PASS Interfaccia: nuova partita, aiuti, conferma, spiegazione, ripresa, ritiro, errore e riavvio');
  const music = new StudioAudio();
  assert(await music.enable(), 'audio context unavailable');
  for (const cue of ['select', 'help', 'switch', 'suspense', 'correct', 'wrong', 'win']) music.cue(cue);
  assert(music.context.state === 'running' && music.enabled, 'audio not running');
  music.disable(); assert(!music.enabled && music.timer === null, 'audio not stopped');
  await music.context.close();
  record('PASS Audio: avvio Web Audio, musica, tutti gli effetti e disattivazione');
  const customMusic = new StudioAudio();
  await customMusic.loadConfig('./audio-config.json');
  assert(await customMusic.enable(), 'custom audio unavailable');
  assert(customMusic.buffers.has('music') && customMusic.buffers.has('correct'), 'local WAV not decoded');
  assert(customMusic.musicSource?.loop && customMusic.timer === null, 'custom music not looped');
  assert(!customMusic.buffers.has('wrong') && !customMusic.buffers.has('win'), 'bad files decoded');
  assert(!customMusic.tracks.select, 'external audio accepted');
  customMusic.cue('correct'); customMusic.cue('wrong'); customMusic.cue('win');
  customMusic.disable();
  assert(customMusic.sources.size === 0 && customMusic.musicSource === null, 'custom sources not stopped');
  assert(await customMusic.enable(), 'custom audio cannot resume');
  customMusic.disable(); await customMusic.context.close();
  record('PASS Audio locale: configurazione, decodifica WAV, loop, mute e fallback per file mancanti o invalidi');
  const finalRound = new Quiz(bank); reach(finalRound, 15);
  localStorage.setItem('cvem.partita.v1', finalRound.snapshot());
  frame.style.width = '375px';
  frame.contentWindow.location.reload();
  await until(() => frame.contentDocument !== doc && frame.contentDocument?.getElementById('resume')?.hidden === false, 'last level resume');
  doc = frame.contentDocument; doc.getElementById('resume').click();
  assert(doc.documentElement.scrollWidth <= 375, 'mobile horizontal overflow');
  for (const button of doc.querySelectorAll('.answer')) assert(button.getBoundingClientRect().height >= 44, 'mobile tap target');
  doc.querySelectorAll('.answer')[finalRound.correctIndex].click(); doc.getElementById('confirm').click();
  await until(() => !doc.getElementById('result').hidden, 'victory screen');
  equal(doc.getElementById('result-prize').textContent, '€ 1.000.000', 'victory prize');
  assert(doc.getElementById('result-title').textContent.includes('milione'), 'victory heading');
  record('PASS Layout mobile senza overflow e vittoria da un milione');
  document.getElementById('results').textContent = `ALL PASSED (${results.length})\n${results.join('\n')}`;
} catch (error) {
  document.getElementById('results').textContent = `FAILED: ${error.stack}\n${results.join('\n')}`;
}
// Segnala la conclusione al runner: Web Audio e gli iframe usano tempo reale.
await fetch('/tests/report', {method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({result: document.getElementById('results').textContent})}).catch(() => {});
