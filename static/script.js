document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const fileUpload = document.getElementById("file-upload");
    const folderUpload = document.getElementById("folder-upload");
    const resultsSection = document.getElementById("results-section");
    const resultsGrid = document.getElementById("results-grid");
    const clearBtn = document.getElementById("clear-btn");
    const loadingSpinner = document.getElementById("loading-spinner");

    // Drag & Drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // Button uploads
    fileUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    folderUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    clearBtn.addEventListener('click', () => {
        resultsGrid.innerHTML = '';
        resultsSection.classList.add('hidden');
    });

    function handleFiles(files) {
        // Filter only images
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            alert("Per favore, carica solo file di immagini valide.");
            return;
        }

        uploadFiles(imageFiles);
    }

    async function uploadFiles(files) {
        resultsSection.classList.remove('hidden');
        loadingSpinner.classList.remove('hidden');
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('images', file);
        });

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                renderResults(data.results, files);
            } else {
                alert("Errore dal server: " + (data.error || "Sconosciuto"));
            }
        } catch (error) {
            console.error("Fetch error:", error);
            alert("Errore di rete durante la predizione.");
        } finally {
            loadingSpinner.classList.add('hidden');
            // reset file inputs
            fileUpload.value = "";
            folderUpload.value = "";
        }
    }

    function renderResults(results, originalFiles) {
        results.forEach(res => {
            if(res.error) {
                console.error(`Errore su ${res.filename}: ${res.error}`);
                return;
            }

            // Find the original file to create an object URL for preview
            const file = originalFiles.find(f => f.name === res.filename || f.webkitRelativePath.endsWith(res.filename));
            let imgUrl = "";
            if(file) {
                imgUrl = URL.createObjectURL(file);
            }

            const card = document.createElement('div');
            card.className = 'result-card';
            
            // Colore confidenza
            let colorVar = "var(--primary-color)";
            if(res.confidence > 90) colorVar = "var(--success-text)";
            else if(res.confidence < 50) colorVar = "var(--warning-text)";

            card.innerHTML = `
                <img src="${imgUrl}" alt="${res.filename}" class="result-img" />
                <div class="result-info">
                    <div class="result-name" title="${res.filename}">${res.filename}</div>
                    <div class="result-class" style="color: ${colorVar}">${res.predicted_class}</div>
                    <div class="result-conf">
                        <div class="conf-bar-bg">
                            <div class="conf-bar" style="width: ${res.confidence}%; background: ${colorVar}"></div>
                        </div>
                        <span>${res.confidence}%</span>
                    </div>
                </div>
            `;
            resultsGrid.prepend(card);
        });
    }
});
