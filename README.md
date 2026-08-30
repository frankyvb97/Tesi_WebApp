# WebApp di Inferenza DINOv3

Questa cartella contiene l'interfaccia grafica (WebApp) sviluppata per interagire con i modelli addestrati nel progetto di Tesi. L'applicativo è progettato con un'architettura **Full-Stack** che separa nettamente la logica di backend da un'interfaccia utente moderna (Glassmorphism e Dark Mode).

## 🚀 Architettura
- **Backend (Flask)**: `app.py` si occupa di creare un server locale. Legge le impostazioni dal file `config/config.json` (autogenerato al primo avvio) e carica i modelli in modalità **Ensemble**. L'API `POST /predict` riceve le immagini, le trasforma in tensori e restituisce le predizioni medie basate su tutti i fold caricati in memoria.
- **Frontend (HTML/CSS/JS)**: I file in `templates/` e `static/` costruiscono l'interfaccia visiva. È stata implementata una logica JavaScript che permette di:
  - Effettuare l'*upload* o il *Drag & Drop* di una singola foto.
  - Caricare **in blocco un'intera cartella locale**; il frontend prenderà tutte le immagini contenute e le manderà in parallelo al server Flask.
  - Costruire dinamicamente una galleria di risultati ("cards") contenenti anteprima dell'immagine, classe predetta e una barra cromatica della confidenza.

## ⚙️ Configurazione e Avvio

Per avviare la WebApp è sufficiente fare doppio clic sul file `Start_WebApp.vbs`. 
La sequenza di avvio è **completamente automatizzata**:
1. Esegue il file `setup/setup_env.py` (usando l'installazione globale di Python) che si occupa di generare il file di configurazione locale e di sincronizzare la cartella `dataset_test`, clonando unicamente le immagini che il modello non ha mai visto durante l'addestramento.
2. Legge il percorso dell'ambiente virtuale (`VENV_DIR`) dal file di configurazione e lo attiva in automatico.
3. Lancia il server Flask (`app.py`), che rileva tutti i pesi `fold_*` presenti, instanzia l'Ensemble e prepara l'interfaccia.

### Il file `config/config.json`
L'intero applicativo è modulare e **strutturalmente indipendente** dalle altre cartelle. Al primissimo avvio, se inesistente, verrà generato un file `config/config.json` con la seguente struttura:
```json
{
    "MODEL_ID": "facebook/dinov3-convnext-tiny-pretrain-lvd1689m",
    "MODELS_DIR": "../Progetto_Tesi/dino_kvasir_model",
    "VENV_DIR": "../Progetto_Tesi/venv_tesi",
    "DATASET_SPLIT_PATH": "../Progetto_Tesi/config/dataset_split.json",
    "DATASET_DIR": "../Datasets/kvasir-dataset-v2"
}
```
I parametri configurabili sono:
- **`MODEL_ID`**: L'architettura base scaricata da HuggingFace, necessaria per istanziare i pesi.
- **`MODELS_DIR`**: La cartella dove sono stati salvati i vari *Fold* addestrati. La WebApp cercherà al suo interno tutte le cartelle che iniziano con `fold_`.
- **`VENV_DIR`**: Il percorso dell'ambiente virtuale Python con le dipendenze installate (letto ed eseguito dal `.bat`).
- **`DATASET_SPLIT_PATH`**: Il percorso in cui è salvato il file JSON contenente lo split del dataset (generato durante il training).
- **`DATASET_DIR`**: La directory radice contenente le immagini del dataset. Il setup estrapola da `DATASET_SPLIT_PATH` *solo* i nomi delle classi e delle immagini, e usa `DATASET_DIR` per ricostruirne il percorso assoluto in maniera pulita, clonandole per i tuoi test manuali.

> [!TIP]
> Modificando questi parametri, è possibile isolare la WebApp, il Dataset e il Progetto di Addestramento su **dischi rigidi e locazioni differenti** senza rompere alcun collegamento!

## 🛠️ Changelog (Diario delle Modifiche)

Di seguito verranno annotate progressivamente tutte le implementazioni apportate su richiesta dell'utente all'interno della WebApp:

1. **Creazione Iniziale della WebApp**:
   - Strutturata la cartella per il pattern MVC di Flask (`app.py`, `templates/`, `static/`).
   - Implementato backend per il caricamento dinamico del modello *DINOv3-ConvNeXt* addestrato e l'estrazione sicura del tensore delle probabilità (Softmax).
   - Costruito frontend con animazioni CSS, layout a griglia responsivo e logica JS per processare sia file singoli che directory intere, bypassando i limiti di sicurezza nativi dei browser.

2. **Isolamento dell'Applicativo**:
   - Su richiesta, l'intera directory `WebApp` è stata spostata *fuori* dalla cartella di addestramento (`Progetto_Tesi`), per posizionarla pulita e indipendente nella root della Tesi. Il file `app.py` è stato rifattorizzato per risalire l'albero delle directory e importare in modo dinamico i pesi e i config dalla directory gemella.

3. **Tema Chiaro e Scuro Adattivo (con Slider)**:
   - Implementato uno Slider animato personalizzato per il cambio di tema.
   - All'interno dello Slider, l'icona si anima e cambia in base alla modalità selezionata (Luna in Dark Mode, Sole in Light Mode).
   - L'applicazione calcola automaticamente il tema di default del sistema operativo / browser (`prefers-color-scheme`).
   - Le preferenze vengono salvate e lette dinamicamente tramite JavaScript (`localStorage`), modificando le variabili architetturali di CSS.

4. **Script di Avvio Automatico (`start_webapp.bat`)**:
   - Creato un comodo script eseguibile per Windows (.bat) progettato per azzerare le problematiche di riconfigurazione dopo i riavvii del PC.
   - Lo script attiva automaticamente l'ambiente virtuale (`venv_tesi`) localizzato nella cartella del progetto di addestramento.
   - Apre in automatico il browser predefinito all'indirizzo locale (`http://127.0.0.1:5000`) e fa partire contestualmente il server Flask, senza dover digitare comandi manuali nel terminale.

5. **Sincronizzazione Automatica Dataset di Test (`dataset_test`)**:
   - È stata aggiunta una funzione intelligente all'avvio del server (`app.py`) che verifica l'esistenza e la validità della cartella `dataset_test`.
   - Il server legge il file `dataset_split.json` generato durante l'addestramento e **copia automaticamente in locale** esclusivamente le immagini che il modello non ha mai visto (il Test Set), mantenendo intatta la struttura delle classi.
   - In caso di cambio dataset nel file di configurazione, la funzione svuota la vecchia cartella e ricrea quella nuova. Questo garantisce all'utente di avere sempre sottomano (nella WebApp) le immagini corrette per testare e validare l'inferenza.

6. **Configurazione Modulare e Modelli Ensemble**:
   - Aggiunta la generazione automatica di un file `config/config.json` locale per la WebApp.
   - Sostituito il caricamento hardcoded del "Fold 1" con un caricamento **Ensemble** dinamico. L'applicativo cerca in automatico tutte le cartelle `fold_*` presenti nella directory specificata, le istanzia e produce predizioni basate sulla media probabilistica di tutti i modelli.
   - Rimosso qualsiasi puntamento relativo vincolante verso la cartella `Progetto_Tesi`. Ora tutti i percorsi (modelli, venv, split e dataset originale) sono parametri dichiarati nel JSON locale, permettendo all'utente di dislocare Dataset e WebApp su memorie di archiviazione differenti.
