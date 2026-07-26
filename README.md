# WebApp di Inferenza DINOv3

Questa cartella contiene l'interfaccia grafica (WebApp) sviluppata per interagire con i modelli addestrati nel progetto di Tesi. L'applicativo è progettato con un'architettura **Full-Stack** che separa nettamente la logica di backend da un'interfaccia utente moderna (Glassmorphism e Dark Mode).

## 🚀 Architettura
- **Backend (Flask)**: `app.py` si occupa di creare un server locale. Legge automaticamente le configurazioni architetturali dal file `config.json` situato in `Progetto_Tesi/config` e carica i pesi del modello addestrato in memoria (attualmente il `best_model` del **Fold 1**). L'API `POST /predict` riceve le immagini, le trasforma in tensori tramite l'`AutoImageProcessor` e restituisce le predizioni (classe e % di confidenza) calcolate dal modello.
- **Frontend (HTML/CSS/JS)**: I file in `templates/` e `static/` costruiscono l'interfaccia visiva. È stata implementata una logica JavaScript che permette di:
  - Effettuare l'*upload* o il *Drag & Drop* di una singola foto.
  - Caricare **in blocco un'intera cartella locale**; il frontend prenderà tutte le immagini contenute e le manderà in parallelo al server Flask.
  - Costruire dinamicamente una galleria di risultati ("cards") contenenti anteprima dell'immagine, classe predetta e una barra cromatica della confidenza.

## 🛠️ Changelog (Diario delle Modifiche)

Di seguito verranno annotate progressivamente tutte le implementazioni apportate su richiesta dell'utente all'interno della WebApp:

1. **Creazione Iniziale della WebApp**:
   - Strutturata la cartella per il pattern MVC di Flask (`app.py`, `templates/`, `static/`).
   - Implementato backend per il caricamento dinamico del modello *DINOv3-ConvNeXt* addestrato e l'estrazione sicura del tensore delle probabilità (Softmax).
   - Costruito frontend con animazioni CSS, layout a griglia responsivo e logica JS per processare sia file singoli che directory intere, bypassando i limiti di sicurezza nativi dei browser.

2. **Isolamento dell'Applicativo**:
   - Su richiesta, l'intera directory `WebApp` è stata spostata *fuori* dalla cartella di addestramento (`Progetto_Tesi`), per posizionarla pulita e indipendente nella root della Tesi. Il file `app.py` è stato rifattorizzato per risalire l'albero delle directory e importare in modo dinamico i pesi e i config dalla directory gemella.
