# Chi vuol essere ingegnere?

Quiz amatoriale in italiano con scenografia da studio televisivo, musica ed effetti locali, 15 livelli e 180 domande esclusivamente sulle macroaree tecniche richieste (comprese 30 di Functional Programming). Il montepremi è virtuale.

## Avvio

Serve **Python 3.10 o successivo** e un browser moderno (Chrome, Firefox, Edge o Safari). Nessun pacchetto da installare. Il gioco, la musica e gli effetti funzionano offline.

```sh
python cvem.py
```

Si apre il browser su `http://127.0.0.1:8000`. Lascia il terminale aperto durante il gioco; premi `Ctrl+C` per chiudere il server.

```sh
python cvem.py --port 8001       # cambia porta se quella predefinita è occupata
python cvem.py --no-browser     # avvia senza aprire il browser
```

## Macroaree e difficoltà

Il pool comprende **Data Engineering, Software Engineering, Functional Programming, Distributed Systems, Akka/Pekko e Kafka, Databases, DevOps, System Design e Soft Skills**.

Tutte le 180 domande sono sempre disponibili, senza opzioni iniziali. Anche le partite riprese usano il pool completo per le successive estrazioni.

Ogni livello contiene dodici domande, di cui due di Functional Programming. Le macroaree sono distribuite nel pool; l’estrazione casuale non garantisce che compaiano tutte in ogni partita. Le 30 domande più introduttive della versione precedente sono state sostituite con esercizi concreti: query SQL, pipeline, contratti API, attori, container e codice funzionale. I livelli iniziali propongono scenari semplici; quelli successivi introducono scenari di concorrenza, dati, affidabilità e compromessi architetturali. Le Soft Skills usano situazioni concrete di collaborazione, stima e gestione degli incidenti.

Le partite salvate che contengono domande rimosse non sono compatibili e vengono scartate con un messaggio nella schermata iniziale.

## Regole

- Quindici domande, estratte casualmente da pool di difficoltà crescente; anche le quattro risposte vengono mescolate.
- Ogni domanda ha una sola risposta corretta. Dopo la selezione premi **È la mia risposta**. Nessun limite di tempo.
- **50:50:** elimina due risposte errate.
- **Pubblico:** mostra percentuali simulate, meno affidabili ai livelli alti. Può sbagliare. Puoi rileggere il voto senza generarne uno nuovo.
- **Switch:** sostituisce la telefonata e pesca una diversa domanda della stessa difficoltà. Gli aiuti già consumati restano tali e i loro effetti non passano alla nuova domanda.
- Ogni aiuto può essere consumato una sola volta per partita.
- Le risposte corrette 5 e 10 assicurano rispettivamente **€ 1.000** e **€ 32.000**. Un errore conclude la partita e assegna l’ultimo traguardo garantito (o € 0 prima del quinto livello).
- Puoi ritirarti prima di confermare la risposta e tenere quanto guadagnato. Quindici risposte corrette valgono **€ 1.000.000**.
- La spiegazione viene mostrata dopo ogni risposta, anche in caso di errore.

La musica locale viene attivata dopo **Entra in gioco** o **Riprendi**, salvo preferenza Audio off. Il pulsante **Audio** attiva o disattiva musica ed effetti. La preferenza viene ricordata. Puoi configurare file locali o usare i suoni sintetizzati inclusi.

**Tastiera:** `A`–`D` oppure `1`–`4` selezionano la risposta; `Invio` la conferma quando il focus è sulla domanda o su una risposta. `Tab` naviga tra i comandi. Le animazioni rispettano la preferenza di sistema per il movimento ridotto.

La partita viene salvata automaticamente nel `localStorage` del browser, compresi domanda, opzioni, aiuti e verdetto. Riapri lo stesso indirizzo con lo stesso browser per riprenderla. Modalità privata, cancellazione dei dati o blocco dell’archiviazione possono impedire la persistenza. Ogni nuova partita sostituisce la precedente; il gioco è pensato per una scheda alla volta.

## Usare musiche e suoni personali

Metti i file in `static/music/` e indica i percorsi in `static/audio-config.json`. Esempio minimo:

```json
{
  "music": "music/sottofondo.mp3",
  "effects": {
    "correct": "music/corretta.mp3",
    "wrong": "music/errata.mp3",
    "win": "music/vittoria.mp3"
  }
}
```

Il sottofondo va in loop. Sono disponibili anche `select`, `help`, `switch` e `suspense`. Ogni voce assente, `null` o non caricabile mantiene il corrispondente audio sintetizzato. Sono accettati file dello stesso server locale; nessun download da servizi esterni. Ricarica la pagina dopo aver cambiato i file. Istruzioni complete in [static/music/README.md](static/music/README.md).

## Personalizzare le domande

Modifica `static/questions.json`. Ogni oggetto contiene:

```json
{
  "id": "TECH-L01-extra",
  "level": 1,
  "subject": "Databases",
  "text": "Tre righe hanno valore 10, NULL e 20. Quanto restituisce COUNT(valore)?",
  "answers": ["2", "3", "1", "NULL"],
  "correct": 0,
  "explanation": "COUNT(colonna) conta solo i valori non NULL."
}
```

`correct` è l’indice della risposta corretta nell’array (da 0 a 3), **prima** del mescolamento. Gli ID devono essere unici e ogni livello da 1 a 15 deve contenere almeno due domande per consentire lo switch. Sono accettate soltanto le nove macroaree elencate, con i nomi esatti presenti nel JSON. Il pool incluso contiene dodici domande per livello; tra partite diverse le domande possono ripetersi.

## Struttura e verifiche

- `cvem.py`: server locale e avvio del browser, solo libreria standard Python.
- `static/engine.js`: regole, estrazione, aiuti e salvataggi.
- `static/app.js`: interfaccia, tastiera e flusso della partita.
- `static/audio.js`: musica ed effetti sintetizzati, caricamento delle tracce locali e fallback.
- `static/audio-config.json`: associazione tra eventi e file audio opzionali.
- `static/style.css`: scenografia responsive e accessibilità del movimento.
- `tests/`: verifiche automatiche del pool, server, motore e interfaccia.

```sh
python -m unittest discover -s tests -v
```

I test JavaScript e dell’interfaccia usano Chrome/Chromium headless, se disponibile, senza librerie aggiuntive. Vengono saltati se il browser non è installato. Il runner usa il tempo reale per verificare Web Audio. I 15 scenari browser verificano regole, aiuti, salvataggi, pool completo, layout mobile e audio locale, senza dipendere dalla rete.


## Riferimenti tecnici

Per le domande sulle garanzie delle piattaforme sono state consultate le documentazioni ufficiali:

- [Apache Kafka: design e semantiche di consegna](https://kafka.apache.org/41/design/design/).
- [Apache Pekko: affidabilità e ordine dei messaggi](https://pekko.apache.org/docs/pekko/current/general/message-delivery-reliability.html).
- [Apache Pekko Typed: pattern di interazione e timeout](https://pekko.apache.org/docs/pekko/current/typed/interaction-patterns.html).
- [Pekko Streams: mapAsync](https://pekko.apache.org/docs/pekko/current/stream/operators/Source-or-Flow/mapAsync.html).
- [Pekko Typed: supervisione](https://pekko.apache.org/docs/pekko/current/typed/fault-tolerance.html).
- [PostgreSQL: indici multicolonna](https://www.postgresql.org/docs/current/indexes-multicolumn.html).
- [Cats: Traverse](https://typelevel.org/cats/typeclasses/traverse.html).
- [PostgreSQL: isolamento delle transazioni](https://www.postgresql.org/docs/current/transaction-iso.html).
- [Kubernetes: probe di liveness, readiness e startup](https://kubernetes.io/docs/concepts/workloads/pods/probes/).

Le difficoltà sono una progressione editoriale del quiz, non una certificazione di competenza professionale.
