export const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
export const SAFETY_LEVELS = [5, 10, 15];
export const LETTERS = ['A', 'B', 'C', 'D'];
export const SUBJECTS = ['Data Engineering', 'Software Engineering', 'Functional Programming', 'Distributed Systems',
  'Akka/Pekko, Kafka', 'Databases', 'DevOps', 'System Design', 'Soft Skills'];
export const money = amount => '€ ' + amount.toLocaleString('it-IT');
export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function validateBank(bank) {
  if (!Array.isArray(bank)) throw new Error('Il pool di domande non è valido.');
  const ids = new Set();
  for (const q of bank) {
    if (!q || typeof q.id !== 'string' || ids.has(q.id) || !Number.isInteger(q.level) || q.level < 1 || q.level > 15 ||
      typeof q.text !== 'string' || !q.text.trim() || !SUBJECTS.includes(q.subject) || typeof q.explanation !== 'string' ||
      !Array.isArray(q.answers) || q.answers.length !== 4 || q.answers.some(a => typeof a !== 'string' || !a.trim()) ||
      new Set(q.answers).size !== 4 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
      throw new Error('Una domanda del pool è incompleta o non valida.');
    }
    ids.add(q.id);
  }
  for (let level = 1; level <= 15; level++) {
    if (bank.filter(q => q.level === level).length < 2) {
      throw new Error(`Servono almeno due domande al livello ${level} per lo switch.`);
    }
  }
  return bank;
}
export class Quiz {
  constructor(bank, random = Math.random) {
    this.bank = validateBank(bank);
    this.random = random;
    this.state = null;
  }
  start() {
    this.state = {version: 2, level: 1, earned: 0, guaranteed: 0, used: [], helps: {fifty: false, audience: false, switch: false},
      phase: 'question', questionId: null, order: [], eliminated: [], poll: null, selected: null, outcome: null};
    this.draw();
    return this.state;
  }
  draw() {
    const s = this.state;
    const candidates = this.bank.filter(q => q.level === s.level && !s.used.includes(q.id));
    if (!candidates.length) throw new Error('Nessuna domanda disponibile per questo livello.');
    const q = candidates[Math.floor(this.random() * candidates.length)];
    s.questionId = q.id;
    s.used.push(q.id);
    s.order = shuffled([0, 1, 2, 3], this.random);
    s.eliminated = [];
    s.poll = null;
    s.selected = null;
    s.phase = 'question';
  }
  get question() { return this.bank.find(q => q.id === this.state?.questionId); }
  get correctIndex() { return this.state.order.indexOf(this.question.correct); }
  get active() { return this.state?.phase === 'question'; }
  select(index) {
    if (!this.active || !Number.isInteger(index) || index < 0 || index > 3 || this.state.eliminated.includes(index)) return false;
    this.state.selected = index;
    return true;
  }
  answer() {
    if (!this.active || this.state.selected === null) return null;
    const s = this.state;
    const correct = s.selected === this.correctIndex;
    if (correct) {
      s.earned = PRIZES[s.level - 1];
      if (SAFETY_LEVELS.includes(s.level)) s.guaranteed = s.earned;
      s.phase = s.level === 15 ? 'finished' : 'correct';
      if (s.level === 15) s.outcome = 'win';
    } else {
      s.earned = s.guaranteed;
      s.phase = 'finished';
      s.outcome = 'wrong';
    }
    return correct;
  }
  next() {
    if (this.state?.phase !== 'correct') return false;
    this.state.level++;
    this.draw();
    return true;
  }
  help(kind) {
    if (!this.active || !Object.hasOwn(this.state.helps, kind) || this.state.helps[kind]) return false;
    const s = this.state;
    s.helps[kind] = true;
    if (kind === 'switch') this.draw();
    if (kind === 'fifty') {
      s.eliminated = shuffled([0, 1, 2, 3].filter(i => i !== this.correctIndex), this.random).slice(0, 2);
      if (s.eliminated.includes(s.selected)) s.selected = null;
      // I voti già espressi dal pubblico restano gli stessi; non vengono rigenerati.
    }
    if (kind === 'audience') {
      const available = [0, 1, 2, 3].filter(i => !s.eliminated.includes(i));
      // La sicurezza del pubblico diminuisce con la difficoltà; talvolta preferisce una risposta errata.
      const accuracy = 0.94 - (s.level - 1) * 0.027;
      const wrong = available.filter(i => i !== this.correctIndex);
      const favorite = this.random() < accuracy ? this.correctIndex : wrong[Math.floor(this.random() * wrong.length)];
      const weights = [0, 0, 0, 0];
      available.forEach(i => { weights[i] = i === favorite ? 40 + this.random() * 36 : 5 + this.random() * 20; });
      const total = weights.reduce((a, b) => a + b, 0);
      const raw = weights.map(v => v / total * 100);
      s.poll = raw.map(Math.floor);
      const remainder = 100 - s.poll.reduce((a, b) => a + b, 0);
      const ranked = available.slice().sort((a, b) => (raw[b] - s.poll[b]) - (raw[a] - s.poll[a]));
      for (let i = 0; i < remainder; i++) s.poll[ranked[i]]++;
    }
    return true;
  }
  walk() {
    if (!this.active) return false;
    this.state.phase = 'finished';
    this.state.outcome = 'walk';
    return true;
  }
  snapshot() { return JSON.stringify(this.state); }
  restore(json) {
    try {
      const s = JSON.parse(json);
      const q = this.bank.find(q => q.id === s?.questionId);
      if (!s || s.version !== 2 || !q || s.level !== q.level || !['question', 'correct', 'finished'].includes(s.phase) ||
        !Array.isArray(s.order) || s.order.length !== 4 || [...s.order].sort().join(',') !== '0,1,2,3' ||
        !Array.isArray(s.used) || !s.used.includes(q.id) || s.used.some(id => !this.bank.some(q => q.id === id)) ||
        !s.helps || ['fifty', 'audience', 'switch'].some(k => typeof s.helps[k] !== 'boolean') ||
        !Array.isArray(s.eliminated) || ![0, 2].includes(s.eliminated.length) || new Set(s.eliminated).size !== s.eliminated.length ||
        s.eliminated.some(i => !Number.isInteger(i) || i < 0 || i > 3 || s.order[i] === q.correct) ||
        (s.eliminated.length && !s.helps.fifty) ||
        (s.selected !== null && (!Number.isInteger(s.selected) || s.selected < 0 || s.selected > 3 || s.eliminated.includes(s.selected))) ||
        (s.poll !== null && (!s.helps.audience || !Array.isArray(s.poll) || s.poll.length !== 4 || s.poll.some(p => !Number.isInteger(p) || p < 0 || p > 100) || s.poll.reduce((a,b) => a+b, 0) !== 100))) return false;
      const completed = s.phase === 'correct' || (s.phase === 'finished' && s.outcome === 'win') ? s.level : s.level - 1;
      const guaranteeLevel = SAFETY_LEVELS.filter(level => level <= completed).at(-1);
      const expectedGuarantee = guaranteeLevel ? PRIZES[guaranteeLevel - 1] : 0;
      const expectedEarned = s.outcome === 'wrong' ? expectedGuarantee : (PRIZES[completed - 1] || 0);
      if (s.guaranteed !== expectedGuarantee || s.earned !== expectedEarned ||
        (s.phase === 'correct' && (s.level === 15 || s.selected !== s.order.indexOf(q.correct))) ||
        (s.phase === 'finished' && !['win', 'wrong', 'walk'].includes(s.outcome)) ||
        (s.phase !== 'finished' && s.outcome !== null) ||
        (s.outcome === 'win' && (s.level !== 15 || s.selected !== s.order.indexOf(q.correct))) ||
        (s.outcome === 'wrong' && (s.selected === null || s.selected === s.order.indexOf(q.correct)))) return false;
      delete s.includeFunctional; // Compatibilità con le partite precedenti: ora il pool è sempre completo.
      this.state = s;
      return true;
    } catch { return false; }
  }
}
