import os
import json
import torch
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

CONFIG_PATH = os.path.join(BASE_DIR, "config", "config.json")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)

MODEL_ID = config["MODEL_ID"]
OUTPUT_DIR = config["OUTPUT_DIR"]
FOLD_1_DIR = os.path.normpath(os.path.join(BASE_DIR, OUTPUT_DIR, "fold_1", "best_model"))

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

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Loading Model from {FOLD_1_DIR} on {device}...")

model = None
processor = None
try:
    processor = AutoImageProcessor.from_pretrained(FOLD_1_DIR)
    model = DINOv3ForImageClassification(MODEL_ID, len(CLASS_NAMES), id2label, label2id)
    
    # Hugging Face Trainer salva il modello come pytorch_model.bin
    state_dict = torch.load(os.path.join(FOLD_1_DIR, "pytorch_model.bin"), map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    print("Model loaded successfully!")
    
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
    if not model or not processor:
        return jsonify({"error": "Il modello non è caricato."}), 500
        
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
                outputs = model(pixel_values=pixel_values)
                logits = outputs.logits
                probs = torch.nn.functional.softmax(logits, dim=1)
                
                confidence, predicted_class_idx = torch.max(probs, dim=1)
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

if __name__ == "__main__":
    # Esegui dalla cartella Progetto_Tesi o WebApp
    app.run(debug=True, host="0.0.0.0", port=5000)
