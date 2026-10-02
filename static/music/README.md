# Tracce audio locali

Metti in questa cartella i file audio che vuoi usare e che sei autorizzato a utilizzare. Le registrazioni del programma non sono incluse.

Configura i percorsi in `static/audio-config.json`, per esempio:

```json
{
  "music": "music/sottofondo.mp3",
  "effects": {
    "select": "music/selezione.wav",
    "help": null,
    "switch": null,
    "suspense": "music/attesa.mp3",
    "correct": "music/corretta.mp3",
    "wrong": "music/errata.mp3",
    "win": "music/vittoria.mp3"
  }
}
```

I nomi sono esempi: i file vanno aggiunti da te. Usa percorsi relativi al file di configurazione, serviti dallo stesso server locale. MP3 e WAV sono scelte comuni; la decodifica dipende dal browser. Ricarica la pagina dopo le modifiche.

- `music` viene riprodotta in loop; scegli un brano o un montaggio adatto.
- Gli effetti vengono riprodotti una volta quando si verifica l’evento corrispondente.
- La suspense del gioco dura circa 1,7 secondi: usa un effetto di durata compatibile per evitare sovrapposizioni con il verdetto.
- `null`, file assenti o formati non decodificabili attivano il suono sintetizzato corrispondente. Gli errori di caricamento compaiono nella console del browser.
- Il pulsante Audio e la sospensione a scheda nascosta controllano sia le tracce locali sia la sintesi.
- I file vengono decodificati in memoria: preferisci loop brevi a registrazioni molto lunghe.

Per le musiche originali del programma servono i file e diritti adatti all’uso previsto; la disponibilità di una registrazione online non implica il permesso di incorporarla o ridistribuirla.
