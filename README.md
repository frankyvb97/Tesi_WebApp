# EndoscopicApp - WebApp di Inferenza DINOv3 Ensemble

Questa directory contiene la WebApp completa (**EndoscopicApp**) sviluppata per l'interazione clinica e dimostrativa con i modelli Vision Transformer DINOv3 (ConvNeXt-Tiny) addestrati sul dataset **Kvasir-v2**.

L'applicazione adotta un'architettura **Full-Stack** moderna e reattiva con design system ispirato ad Antigravity (Dark/Light mode, accenti arancioni, glassmorphism e micro-animazioni).

---

## 🏛️ Architettura dell'Applicazione

### 1. Backend (`app.py` - Flask & PyTorch / DirectML)
- **Caricamento Ensemble 5-Fold**: Rileva dinamicamente tutte le directory `fold_*` presenti nella cartella dei modelli, istanzia i modelli su dispositivo accelerato (`torch-directml` su GPU AMD o CUDA/CPU) ed esegue l'inferenza calcolando la **media probabilistica (Softmax)** dei 5 fold.
- **Endpoint `/predict`**: Riceve una o più immagini (file singoli o intere cartelle inviate dal client), normalizza i pixel tramite l'Image Processor di Hugging Face e restituisce per ciascun file la classe predetta e la percentuale di confidenza.
- **Endpoint `/demo`**: Preleva automaticamente immagini campione dal set di test (`dataset_test/kvasir-dataset-v2`), le codifica in base64 e ne esegue l'inferenza immediata per finalità dimostrative.

### 2. Frontend (`templates/index.html`, `static/style.css`, `static/script.js`)
- **Cronologia Sessioni (Stile Gemini)**: Barra laterale collassabile con gestione dello stato persistente su **IndexedDB** (`Dinov3TesiDB`). Ogni sessione memorizza titolo, timestamp, miniature base64 delle immagini caricate e relativi risultati di classificazione.
- **Salvataggio Automatico / Manuale**: Interruttore dedicato nella barra superiore con tooltip esplicativo (`?`). Se attivo, salva automaticamente ogni analisi nella cronologia; se disattivato, permette il salvataggio manuale tramite il pulsante "Salva Sessione".
- **Caricamento Flessibile (File & Cartelle)**: Supporta il drag & drop di immagini singole JPG/PNG o la selezione in blocco di un'intera cartella endoscopica.
- **Visualizzazione Risultati**: Griglia di card interattive con anteprima dell'immagine, nome file, patologia/reperto diagnosticato e barra cromatica della confidenza (verde per confidenza elevata $\ge 90\%$, arancione standard, giallo per confidenze inferiori al $50\%$).
- **Esportazione Referti**:
  - **Esporta HTML**: Genera un file HTML autonomo (*stand-alone*) con stili incorporati e immagini convertite in base64, apribile su qualsiasi dispositivo senza dipendenze esterne.
  - **Stampa / PDF**: Formattazione ottimizzata per la stampa cartacea o salvataggio PDF tramite regole CSS `@media print`.
- **Tema Chiaro / Scuro**: Switch animato sincronizzato con `localStorage` e preferenze di sistema del browser.

---

## ⚙️ Configurazione e Avvio

Per avviare la WebApp è sufficiente fare doppio clic sul file `Start_WebApp.vbs` nella root del progetto oppure eseguire `setup/start_webapp.bat`.

### Sequenza di Avvio Automatizzata
1. Esegue `setup/setup_env.py` per sincronizzare in locale la cartella `dataset_test` clonando esclusivamente le immagini del Test Set (non viste in fase di training).
2. Attiva l'ambiente virtuale dedicato (`venv_tesi`).
3. Avvia il server Flask in background ed esegue un polling HTTP su `http://127.0.0.1:5000` per verificare che i modelli siano interamente caricati nella VRAM della GPU prima di aprire il browser predefinito.

### File di Configurazione (`config/config.json`)
```json
{
    "MODEL_ID": "facebook/dinov3-convnext-tiny-pretrain-lvd1689m",
    "MODELS_DIR": "../Progetto_Tesi/dino_kvasir_model",
    "VENV_DIR": "../Progetto_Tesi/venv_tesi",
    "DATASET_SPLIT_PATH": "../Progetto_Tesi/config/dataset_split.json",
    "DATASET_DIR": "../Datasets/kvasir-dataset-v2"
}
```
*Tutti i percorsi sono configurabili, permettendo di dislocare Dataset, Pesi dei Modelli e WebApp su supporti di memoria o dischi differenti.*

---

## 📋 Changelog delle Implementazioni

1. **Creazione Base WebApp**:
   - Struttura MVC con Flask, caricamento DINOv3 ConvNeXt e classificazione multiclasse.
   - Upload file singoli e intere cartelle tramite input HTML5.

2. **Isolamento dell'Applicativo**:
   - WebApp completamente scorporata e indipendente dalla cartella di addestramento `Progetto_Tesi`.

3. **Tema Dark & Light Adattivo**:
   - Palette scura professionale in stile Antigravity (graphite/slate con accenti arancioni `#f97316`).
   - Slider di commutazione tema con memorizzazione in `localStorage`.

4. **Avvio Robusto con Polling HTTP**:
   - Gestione del tempo di caricamento dei 5 fold su GPU DirectML (~10-15s) tramite script PowerShell con verifica dello stato HTTP 200 prima del lancio del browser.

5. **Cronologia Sessioni Persistente (IndexedDB)**:
   - Sidebar in stile Google Gemini con salvataggio locale illimitato di sessioni, miniature e metadati.
   - Funzionalità di creazione nuova sessione, ridenominazione ed eliminazione rapida.
   - Pulsante toggle unificato per espansione/riduzione della sidebar.

6. **Opzione Salvataggio Automatico**:
   - Toggle switch in navbar per scegliere tra autosalvataggio immediato o archiviazione manuale.
   - Tooltip interattivo esplicativo con icona `?`.

7. **Modalità Demo (Test Dataset)**:
   - Pulsante dedicato nella sidebar per l'esecuzione automatica di inferenza su un batch bilanciato di campioni estratti da `dataset_test`.

8. **Esportazione Multi-Formato**:
   - Generazione report HTML stand-alone e layout per esportazione PDF/Stampa.
