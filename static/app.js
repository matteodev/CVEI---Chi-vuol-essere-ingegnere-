import {Quiz, PRIZES, SAFETY_LEVELS, LETTERS, money} from './engine.js';
import {StudioAudio} from './audio.js';
const $ = id => document.getElementById(id);
const SAVE_KEY = 'cvem.partita.v1';
const SOUND_KEY = 'cvem.audio.v1';
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};
const audio = new StudioAudio();
let quiz, busy = false, screen = 'welcome', modalRequired = false;
let soundPreference = storage.get(SOUND_KEY);
function updatePoolCount() {
  if (quiz) $('bank-count').textContent = quiz.bank.length;
}
const save = () => {
  if (!storage.set(SAVE_KEY, quiz.snapshot())) $('game-status').textContent = 'Salvataggio non disponibile: mantieni aperta questa scheda per continuare la partita.';
};
function showScreen(name) {
  screen = name;
  ['welcome', 'game', 'result'].forEach(id => { $(id).hidden = id !== name; });
  window.scrollTo({top: 0, behavior: 'instant'});
}
function updateSoundButton() {
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute('aria-label', audio.enabled ? 'Disattiva musica ed effetti' : 'Attiva musica ed effetti');
  $('sound').querySelector('span').textContent = audio.enabled ? 'Audio on' : 'Audio off';
}
async function startAudio() {
  if (soundPreference !== 'off') await audio.enable();
  updateSoundButton();
}
$('sound').addEventListener('click', async () => {
  if (audio.enabled) { audio.disable(); soundPreference = 'off'; }
  else { const enabled = await audio.enable(); soundPreference = enabled ? 'on' : 'off'; }
  storage.set(SOUND_KEY, soundPreference);
  updateSoundButton();
});
document.addEventListener('visibilitychange', () => {
  if (!audio.context) return;
  if (document.hidden) audio.context.suspend().catch(() => {});
  else if (audio.enabled) audio.context.resume().catch(() => {});
});
function paragraph(text, strong = false) {
  const p = document.createElement('p');
  if (strong) { const b = document.createElement('strong'); b.textContent = text; p.append(b); }
  else p.textContent = text;
  return p;
}
function openModal({kicker = '', title, body, actions = [{label: 'Ho capito', primary: true}], required = false}) {
  if ($('modal').open) $('modal').close();
  modalRequired = required;
  $('modal-kicker').textContent = kicker;
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(...body);
  $('modal-actions').replaceChildren();
  actions.forEach(action => {
    const button = document.createElement('button');
    button.className = `button ${action.primary ? 'primary' : 'secondary'}`;
    button.textContent = action.label;
    button.addEventListener('click', () => { $('modal').close(); modalRequired = false; action.run?.(); });
    $('modal-actions').append(button);
  });
  $('modal').showModal();
}
$('modal').addEventListener('cancel', event => { if (modalRequired) event.preventDefault(); });
function showRules() {
  const list = document.createElement('ul');
  list.className = 'rules-list';
  [
    'Rispondi a 15 domande su Data Engineering, Software Engineering, Functional Programming, Distributed Systems, Akka/Pekko e Kafka, Databases, DevOps, System Design e Soft Skills. Ogni livello pesca a caso dal proprio pool; anche l’ordine delle risposte cambia.',
    'Seleziona una risposta e confermala. Non c’è un limite di tempo. Da tastiera: A–D oppure 1–4 per scegliere, Invio per confermare.',
    '50:50 elimina due risposte errate. Il pubblico esprime un voto simulato: è un consiglio, non una certezza.',
    'Lo switch sostituisce la telefonata: cambia la domanda con una diversa dello stesso livello. Gli altri aiuti già consumati restano consumati.',
    'Ogni aiuto si usa una sola volta per partita. Se cambi domanda, i benefici degli aiuti precedenti non si trasferiscono.',
    'Le risposte corrette 5 e 10 garantiscono € 1.000 e € 32.000. Un errore termina la partita e ti lascia l’ultimo traguardo garantito; prima del quinto, € 0.',
    'Puoi ritirarti prima di confermare una risposta e conservare quanto hai già conquistato. Alla quindicesima risposta corretta vinci € 1.000.000 virtuali.',
    'La partita viene salvata in questo browser, quando lo spazio di archiviazione è disponibile. Musica ed effetti sono locali e funzionano offline. Il pulsante Audio li attiva o disattiva.'
  ].forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
  openModal({kicker: 'LE REGOLE DELLO STUDIO', title: 'L’ingegno ha le sue regole.', body: [list]});
}
$('rules').addEventListener('click', showRules);
function start() {
  quiz.start();
  busy = false;
  save();
  showScreen('game');
  renderGame();
  startAudio();
  $('question').focus({preventScroll: true});
}
function requestStart() {
  if (quiz.state && quiz.state.phase !== 'finished') {
    openModal({kicker: 'NUOVA PARTITA', title: 'Una nuova scalata?', body: [paragraph('La partita salvata verrà sostituita. Ripartirai dalla prima domanda con tutti e tre gli aiuti.')],
      actions: [{label: 'Tieni la partita'}, {label: 'Ricomincia', primary: true, run: start}]});
  } else start();
}
$('start').addEventListener('click', requestStart);
$('again').addEventListener('click', start);
$('resume').addEventListener('click', () => {
  updatePoolCount();
  showScreen('game');
  renderGame();
  startAudio();
  if (quiz.state.phase === 'correct') showCorrect();
  else $('question').focus({preventScroll: true});
});
$('home').addEventListener('click', () => { showScreen('welcome'); $('resume').hidden = true; $('start').focus(); });
function renderGame() {
  const s = quiz.state, q = quiz.question;
  audio.level = s.level;
  $('round-label').textContent = `DOMANDA ${String(s.level).padStart(2, '0')} / 15`;
  $('round-prize').textContent = money(PRIZES[s.level - 1]);
  const difficulty = Math.ceil(s.level / 3);
  $('difficulty-label').textContent = ['Riscaldamento', 'Fondamenta solide', 'Si alza il livello', 'Mente da progettista', 'Laurea con lode'][difficulty - 1];
  $('difficulty-dots').replaceChildren(...Array.from({length: 5}, (_, i) => { const dot = document.createElement('i'); if (i < difficulty) dot.className = 'on'; return dot; }));
  $('subject').textContent = q.subject.toLocaleUpperCase('it-IT');
  $('question-tag').textContent = SAFETY_LEVELS.includes(s.level) ? 'TRAGUARDO GARANTITO' : 'PRENDITI IL TUO TEMPO';
  $('question').textContent = q.text;
  $('answers').replaceChildren();
  s.order.forEach((original, index) => {
    const button = document.createElement('button');
    button.className = 'answer';
    const eliminated = s.eliminated.includes(index);
    if (s.selected === index) button.classList.add('selected');
    if (eliminated) button.classList.add('eliminated');
    if (s.phase !== 'question' && !busy) {
      if (index === quiz.correctIndex) button.classList.add('correct');
      else if (index === s.selected) button.classList.add('wrong');
    }
    button.disabled = busy || s.phase !== 'question' || eliminated;
    button.setAttribute('aria-pressed', String(s.selected === index));
    button.setAttribute('aria-label', `${LETTERS[index]}: ${q.answers[original]}${eliminated ? ', eliminata' : ''}`);
    const letter = document.createElement('span'); letter.className = 'answer-letter'; letter.textContent = `${LETTERS[index]}:`;
    const text = document.createElement('span'); text.textContent = q.answers[original];
    button.append(letter, text);
    button.addEventListener('click', () => select(index));
    $('answers').append(button);
  });
  ['fifty', 'audience', 'switch'].forEach(kind => {
    const used = s.helps[kind];
    const canReview = kind === 'audience' && s.poll !== null;
    $(kind).disabled = busy || s.phase !== 'question' || (used && !canReview);
    $(kind).classList.toggle('used', used && !canReview);
    $(kind).title = canReview ? 'Rivedi il voto già espresso' : used ? 'Aiuto già utilizzato' : 'Disponibile una volta per partita';
    $(kind).querySelector('small').textContent = used ? (canReview ? 'Rivedi il voto' : 'Già utilizzato') : {fifty: 'Due possibilità in meno', audience: 'Ascolta lo studio', switch: 'Cambia la domanda'}[kind];
  });
  $('confirm').disabled = busy || s.phase !== 'question' || s.selected === null;
  $('confirm').textContent = busy ? 'Accendiamola…' : 'È la mia risposta →';
  $('answer-hint').textContent = busy ? 'Il verdetto sta per arrivare.' : s.selected === null ? 'Scegli una risposta per accenderla.' : `Hai scelto ${LETTERS[s.selected]}. Vuoi accenderla?`;
  $('walk').disabled = busy || s.phase !== 'question';
  $('rules').disabled = busy;
  $('walk').textContent = `Mi ritiro con ${money(s.earned)} ↗`;
  $('guaranteed').textContent = `Traguardo garantito: ${money(s.guaranteed)}`;
  $('ladder').replaceChildren();
  for (let level = 15; level >= 1; level--) {
    const li = document.createElement('li'); li.className = 'rung';
    if (level === s.level) { li.classList.add('current'); li.setAttribute('aria-current', 'step'); }
    if (level < s.level || (level === s.level && s.phase === 'correct')) li.classList.add('passed');
    const safe = SAFETY_LEVELS.includes(level);
    if (safe) li.classList.add('safety');
    const number = document.createElement('span'); number.className = 'rung-number'; number.textContent = String(level).padStart(2, '0');
    const marker = document.createElement('span'); marker.className = 'rung-marker'; marker.textContent = safe ? '◆' : level < s.level ? '·' : '';
    const prize = document.createElement('span'); prize.className = 'rung-prize'; prize.textContent = money(PRIZES[level - 1]);
    li.append(number, marker, prize); $('ladder').append(li);
  }
}
function select(index) {
  if (busy || $('modal').open || !quiz.select(index)) return;
  audio.cue('select'); save(); renderGame();
  $('answers').children[index].focus({preventScroll: true});
}
async function confirm() {
  if (busy || $('modal').open || !quiz.active || quiz.state.selected === null) return;
  busy = true;
  // Il verdetto viene salvato prima dell’animazione: ricaricare la pagina non annulla la risposta.
  const correct = quiz.answer(); save();
  $('game').classList.add('resolving'); renderGame(); audio.cue('suspense');
  await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1700));
  busy = false; $('game').classList.remove('resolving'); renderGame();
  audio.cue(quiz.state.outcome === 'win' ? 'win' : correct ? 'correct' : 'wrong');
  $('game-status').textContent = correct ? 'Risposta esatta!' : 'Risposta errata. Partita conclusa.';
  if (quiz.state.phase === 'finished') showResult();
  else showCorrect();
}
$('confirm').addEventListener('click', confirm);
function showCorrect() {
  const s = quiz.state, q = quiz.question;
  const safe = SAFETY_LEVELS.includes(s.level);
  openModal({kicker: safe ? 'TRAGUARDO GARANTITO RAGGIUNTO' : 'RISPOSTA ESATTA', title: `${money(s.earned)}. Ben progettato.`,
    body: [paragraph(q.answers[q.correct], true), paragraph(q.explanation), paragraph(safe ? `Da ora hai almeno ${money(s.guaranteed)} garantiti, anche in caso di errore.` : `La prossima domanda vale ${money(PRIZES[s.level])}. Gli aiuti ancora disponibili ti aspettano.`)],
    required: true, actions: [{label: 'Avanti con la prossima →', primary: true, run: () => { quiz.next(); save(); renderGame(); $('question').focus({preventScroll: true}); }}]});
}
function showAudience() {
  const rows = document.createElement('div');
  quiz.state.poll.forEach((percent, index) => {
    const row = document.createElement('div'); row.className = 'audience-row';
    row.setAttribute('aria-label', `${LETTERS[index]}: ${quiz.question.answers[quiz.state.order[index]]}, ${percent} per cento`);
    const label = document.createElement('span'); label.textContent = LETTERS[index];
    const track = document.createElement('div'); track.className = 'audience-track';
    const fill = document.createElement('div'); fill.className = 'audience-fill'; fill.style.width = `${percent}%`; track.append(fill);
    const value = document.createElement('strong'); value.textContent = `${percent}%`;
    row.append(label, track, value); rows.append(row);
  });
  openModal({kicker: 'LA PAROLA ALLO STUDIO', title: 'Il pubblico ha votato.', body: [rows, paragraph('Voti simulati: il pubblico può sbagliare, soprattutto nelle domande più difficili. La scelta finale è tua.')]});
}
$('fifty').addEventListener('click', () => {
  if (busy || !quiz.help('fifty')) return;
  audio.cue('help'); save(); renderGame();
  $('game-status').textContent = '50:50 utilizzato. Due risposte errate sono state eliminate.';
  $('question').focus({preventScroll: true});
});
$('audience').addEventListener('click', () => {
  if (busy || !quiz.active) return;
  if (!quiz.state.poll) { if (!quiz.help('audience')) return; audio.cue('help'); save(); renderGame(); }
  showAudience();
});
$('switch').addEventListener('click', () => {
  if (busy || !quiz.active || quiz.state.helps.switch) return;
  openModal({kicker: 'UN’ALTRA POSSIBILITÀ', title: 'Cambiamo domanda?', body: [paragraph('Pescheremo una domanda diversa dello stesso livello. Lo switch si può usare una sola volta.'), paragraph('Eventuali 50:50 e pubblico già utilizzati restano consumati e non si trasferiscono alla nuova domanda.')],
    actions: [{label: 'Tengo questa'}, {label: 'Usa lo switch ⇄', primary: true, run: () => {
      if (!quiz.help('switch')) return;
      audio.cue('switch'); save(); renderGame(); $('question').focus({preventScroll: true});
      $('game-status').textContent = 'Switch utilizzato. Nuova domanda, stesso livello.';
    }}]});
});
$('walk').addEventListener('click', () => {
  if (busy || !quiz.active) return;
  openModal({kicker: 'ANCHE FERMARSI È UNA SCELTA', title: `Porti a casa ${money(quiz.state.earned)}?`, body: [paragraph('Ritirandoti, conservi il montepremi conquistato e concludi questa partita.')],
    actions: [{label: 'Continuo a giocare'}, {label: 'Mi ritiro', primary: true, run: () => { quiz.walk(); save(); showResult(); }}]});
});
function showResult() {
  const s = quiz.state, q = quiz.question;
  showScreen('result');
  const won = s.outcome === 'win', walked = s.outcome === 'walk';
  $('result-symbol').textContent = won ? '♛' : walked ? '◇' : '✦';
  $('result-kicker').textContent = won ? '15 SU 15 · MISSIONE COMPIUTA' : walked ? 'PARTITA CONCLUSA · RITIRO' : `PARTITA CONCLUSA · DOMANDA ${s.level}`;
  $('result-title').textContent = won ? 'Ingegnere da un milione.' : walked ? 'Un progetto ben riuscito.' : 'Ogni errore insegna qualcosa.';
  $('result-description').textContent = won ? 'Hai raggiunto la cima. Logica, sangue freddo e un bel po’ di ingegno.' : walked ? 'Hai scelto il momento di fermarti. La prossima scalata ti aspetta.' : 'La scalata si ferma qui, ma la curiosità va avanti.';
  $('result-prize').textContent = money(s.earned);
  const detail = $('result-detail'); detail.replaceChildren();
  if (!walked) {
    detail.append(paragraph(q.text), paragraph(`Risposta corretta: ${q.answers[q.correct]}`, true), paragraph(q.explanation));
    if (!won) detail.append(paragraph(`La tua risposta: ${q.answers[s.order[s.selected]]}. Risposte corrette: ${s.level - 1} su 15.`));
  } else detail.append(paragraph(`Hai risposto correttamente a ${s.level - 1} domande su 15. Il tuo montepremi finale è ${money(s.earned)}.`));
  $('again').focus({preventScroll: true});
  if (won) celebrate();
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 65; i++) {
    const piece = document.createElement('i'); piece.className = 'confetti'; piece.setAttribute('aria-hidden', 'true');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = ['#ecc781', '#beacfa', '#7ce6ba'][i % 3];
    piece.style.animationDelay = `${Math.random()}s`;
    document.body.append(piece); setTimeout(() => piece.remove(), 4200);
  }
}
document.addEventListener('keydown', event => {
  if (screen !== 'game' || busy || $('modal').open || !quiz?.active || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  const key = event.key.toLowerCase();
  const index = 'abcd'.includes(key) && key.length === 1 ? 'abcd'.indexOf(key) : '1234'.includes(key) && key.length === 1 ? Number(key) - 1 : -1;
  if (index !== -1) { event.preventDefault(); select(index); }
  if (event.key === 'Enter' && (document.activeElement?.classList.contains('answer') || document.activeElement === $('question') || document.activeElement === document.body)) {
    event.preventDefault(); confirm();
  }
});
async function init() {
  try {
    const [response] = await Promise.all([fetch('./questions.json'), audio.loadConfig()]);
    if (!response.ok) throw new Error('Pool di domande non raggiungibile.');
    const bank = await response.json(); quiz = new Quiz(bank);
    updatePoolCount();
    $('start').disabled = false; $('start').textContent = 'Entra in gioco ↗';
    $('load-status').textContent = 'Nessun cronometro. Solo tu, la domanda e il tuo intuito.';
    const saved = storage.get(SAVE_KEY);
    if (saved && quiz.restore(saved)) {
      if (quiz.state.phase !== 'finished') {
        $('resume').hidden = false;
        $('resume').textContent = `Riprendi · domanda ${quiz.state.level} ↗`;
      } else {
        showResult();
      }
    } else if (saved) {
      storage.remove(SAVE_KEY);
      $('load-status').textContent = 'La partita precedente non è compatibile con questo pool. Inizia una nuova scalata.';
    }
  } catch (error) {
    $('load-status').textContent = `${error.message} Avvia il gioco con “python cvem.py” e ricarica la pagina.`;
    $('start').textContent = 'Riprova'; $('start').disabled = false;
    $('start').removeEventListener('click', requestStart);
    $('start').addEventListener('click', () => location.reload(), {once: true});
  }
}
init();
