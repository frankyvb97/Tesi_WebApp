import os
import json
import torch
import shutil
import webbrowser
import base64
import io
from threading import Timer
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from PIL import Image
from torchvision import transforms
from transformers import AutoImageProcessor, AutoModel
from transformers.modeling_outputs import SequenceClassifierOutput
from safetensors.torch import load_file

# Resolve project root dir
APP_DIR = os.path.dirname(os.path.abspath(__file__))
TESI_DIR = os.path.dirname(APP_DIR)
BASE_DIR = os.path.join(TESI_DIR, "Progetto_Tesi")

# Local Config
WEBAPP_CONFIG_DIR = os.path.join(APP_DIR, "config")
WEBAPP_CONFIG_PATH = os.path.join(WEBAPP_CONFIG_DIR, "config.json")



with open(WEBAPP_CONFIG_PATH, "r", encoding="utf-8") as f:
    webapp_config = json.load(f)

MODELS_DIR = webapp_config.get("MODELS_DIR", "../Progetto_Tesi/dino_kvasir_model")
MODELS_DIR_ABS = os.path.normpath(os.path.join(APP_DIR, MODELS_DIR))

MODEL_ID = webapp_config.get("MODEL_ID", "facebook/dinov3-convnext-tiny-pretrain-lvd1689m")

from setup import setup_env
setup_env.setup_all()

CLASS_NAMES = [
    'dyed-lifted-polyps', 'dyed-resection-margins', 'esophagitis', 
    'normal-cecum', 'normal-pylorus', 'normal-z-line', 'polyps', 'ulcerative-colitis'
]
id2label = {i: name for i, name in enumerate(CLASS_NAMES)}
label2id = {name: i for i, name in enumerate(CLASS_NAMES)}

class DINOv3ForImageClassification(torch.nn.Module):
    def __init__(self, model_id, num_labels, id2label, label2id):
        super().__init__()
        self.num_labels = num_labels
        self.id2label = id2label
        self.label2id = label2id
        self.backbone = AutoModel.from_pretrained(model_id, trust_remote_code=True)
        hidden_size = self.backbone.config.hidden_sizes[-1]
        self.classifier = torch.nn.Linear(hidden_size, num_labels)
        
    def forward(self, pixel_values, labels=None, **kwargs):
        outputs = self.backbone(pixel_values=pixel_values, **kwargs)
        pooled_output = outputs.pooler_output
        logits = self.classifier(pooled_output)
        return SequenceClassifierOutput(logits=logits)

app = Flask(__name__)
CORS(app)

def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    try:
        import torch_directml
        if torch_directml.is_available():
            return torch_directml.device()
    except ImportError:
        pass
    return torch.device("cpu")

device = get_device()
print(f"Inizializzazione Ensemble su {device}...")

ensemble_models = []
processor = None
try:
    fold_names = [d for d in os.listdir(MODELS_DIR_ABS) if d.startswith("fold_")]
    if not fold_names:
        raise FileNotFoundError(f"Nessuna cartella fold_ trovata in {MODELS_DIR_ABS}")
        
    first_fold_dir = os.path.normpath(os.path.join(MODELS_DIR_ABS, fold_names[0], "best_model"))
    processor = AutoImageProcessor.from_pretrained(first_fold_dir)
    
    for name in fold_names:
        fold_dir = os.path.normpath(os.path.join(MODELS_DIR_ABS, name, "best_model"))
        if os.path.exists(fold_dir):
            print(f"Caricamento {name} da {fold_dir}...")
            model = DINOv3ForImageClassification(MODEL_ID, len(CLASS_NAMES), id2label, label2id)
            state_dict = torch.load(os.path.join(fold_dir, "pytorch_model.bin"), map_location=device, weights_only=False)
            model.load_state_dict(state_dict)
            model.to(device)
            model.eval()
            ensemble_models.append(model)
            
    print(f"{len(ensemble_models)} modelli Ensemble caricati con successo!")
    
    # Costruiamo il transform sfruttando i parametri estratti dal processor
    transform = transforms.Compose([
        transforms.Resize((processor.size["shortest_edge"], processor.size["shortest_edge"]) if "shortest_edge" in processor.size else (224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=processor.image_mean, std=processor.image_std),
    ])
except Exception as e:
    print(f"Error loading model: {e}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    if not ensemble_models or not processor:
        return jsonify({"error": "Il modello Ensemble non è caricato."}), 500
        
    if "images" not in request.files:
        return jsonify({"error": "Nessuna immagine ricevuta."}), 400
        
    files = request.files.getlist("images")
    results = []
    
    for file in files:
        if file.filename == '':
            continue
            
        try:
            image = Image.open(file.stream).convert("RGB")
            pixel_values = transform(image).unsqueeze(0).to(device)
            
            with torch.no_grad():
                all_probs = []
                for model_fold in ensemble_models:
                    outputs = model_fold(pixel_values=pixel_values)
                    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
                    all_probs.append(probs)
                
                # Media delle probabilità di tutti i Fold caricati nell'Ensemble
                avg_probs = torch.mean(torch.stack(all_probs), dim=0)
                
                confidence, predicted_class_idx = torch.max(avg_probs, dim=1)
                predicted_class = id2label[predicted_class_idx.item()]
                conf_val = round(confidence.item() * 100, 2)
                
            results.append({
                "filename": os.path.basename(file.filename),
                "predicted_class": predicted_class,
                "confidence": conf_val
            })
        except Exception as e:
            results.append({
                "filename": os.path.basename(file.filename),
                "error": str(e)
            })
            
    return jsonify({"results": results})

@app.route("/demo", methods=["POST", "GET"])
def run_demo():
    if not ensemble_models or not processor:
        return jsonify({"error": "Il modello Ensemble non è caricato."}), 500
        
    test_dir = os.path.join(APP_DIR, "dataset_test")
    if not os.path.exists(test_dir):
        return jsonify({"error": "Cartella dataset_test non trovata."}), 404
        
    # Seleziona fino a 2 immagini per ogni classe presente nella cartella di test
    selected_files = []
    for root, dirs, files in os.walk(test_dir):
        image_files = sorted([f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
        if image_files:
            selected_files.append(os.path.join(root, image_files[0]))
            if len(image_files) > 1 and len(selected_files) < 16:
                selected_files.append(os.path.join(root, image_files[1]))
                
    if not selected_files:
        return jsonify({"error": "Nessuna immagine trovata in dataset_test."}), 404
        
    results = []
    for filepath in selected_files:
        try:
            with open(filepath, "rb") as img_f:
                raw_bytes = img_f.read()
                
            b64_str = f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode('utf-8')}"
            image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            pixel_values = transform(image).unsqueeze(0).to(device)
            
            with torch.no_grad():
                all_probs = []
                for model_fold in ensemble_models:
                    outputs = model_fold(pixel_values=pixel_values)
                    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
                    all_probs.append(probs)
                    
                avg_probs = torch.mean(torch.stack(all_probs), dim=0)
                confidence, predicted_class_idx = torch.max(avg_probs, dim=1)
                predicted_class = id2label[predicted_class_idx.item()]
                conf_val = round(confidence.item() * 100, 2)
                
            results.append({
                "filename": os.path.basename(filepath),
                "predicted_class": predicted_class,
                "confidence": conf_val,
                "imageData": b64_str
            })
        except Exception as e:
            results.append({
                "filename": os.path.basename(filepath),
                "error": str(e)
            })
            
    return jsonify({"results": results})

if __name__ == "__main__":
    print("\n" + "="*50)
    print("  Server Web attivo su: http://127.0.0.1:5000")
    print("="*50 + "\n")
    app.run(debug=False, host="127.0.0.1", port=5000, use_reloader=False)
