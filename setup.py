import os
import json

APP_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_CONFIG_DIR = os.path.join(APP_DIR, "config")
WEBAPP_CONFIG_PATH = os.path.join(WEBAPP_CONFIG_DIR, "config.json")

DEFAULT_WEBAPP_CONFIG = {
    "MODEL_ID": "facebook/dinov3-convnext-tiny-pretrain-lvd1689m",
    "MODELS_DIR": "../Progetto_Tesi/dino_kvasir_model",
    "VENV_DIR": "../Progetto_Tesi/venv_tesi",
    "DATASET_SPLIT_PATH": "../Progetto_Tesi/config/dataset_split.json",
    "DATASET_DIR": "../Datasets/kvasir-dataset-v2"
}

def create_config():
    os.makedirs(WEBAPP_CONFIG_DIR, exist_ok=True)
    if not os.path.exists(WEBAPP_CONFIG_PATH):
        print(f"Creazione file di configurazione in {WEBAPP_CONFIG_PATH}...")
        with open(WEBAPP_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_WEBAPP_CONFIG, f, indent=4)
import shutil

def setup_test_dataset():
    with open(WEBAPP_CONFIG_PATH, "r", encoding="utf-8") as f:
        webapp_config = json.load(f)
        
    split_path_relative = webapp_config.get("DATASET_SPLIT_PATH", "../Progetto_Tesi/config/dataset_split.json")
    split_path = os.path.normpath(os.path.join(APP_DIR, split_path_relative))
    
    if not os.path.exists(split_path):
        return
        
    with open(split_path, "r", encoding="utf-8") as f:
        split_data = json.load(f)
        
    dataset_name = split_data.get("dataset_folder", "unknown_dataset")
    test_samples = split_data.get("test", [])
    
    test_dir = os.path.join(APP_DIR, "dataset_test")
    target_dataset_dir = os.path.join(test_dir, dataset_name)
    
    os.makedirs(test_dir, exist_ok=True)
    existing_folders = [f for f in os.listdir(test_dir) if os.path.isdir(os.path.join(test_dir, f))]
    
    if len(existing_folders) == 1 and existing_folders[0] == dataset_name:
        if len(os.listdir(target_dataset_dir)) > 0:
            return  # Gia' configurato
            
    for f in existing_folders:
        shutil.rmtree(os.path.join(test_dir, f))
        
    print(f"Configurazione cartella di test ({dataset_name}). Copia di {len(test_samples)} immagini...")
    os.makedirs(target_dataset_dir, exist_ok=True)
    
    for sample in test_samples:
        original_path = sample[0]
        class_name = sample[2]
        
        dataset_dir_relative = webapp_config.get("DATASET_DIR", "../Datasets/kvasir-dataset-v2")
        dataset_dir = os.path.normpath(os.path.join(APP_DIR, dataset_dir_relative))
        
        filename = os.path.basename(original_path)
        src_path = os.path.normpath(os.path.join(dataset_dir, class_name, filename))
        
        if os.path.exists(src_path):
            filename = os.path.basename(src_path)
            class_dir = os.path.join(target_dataset_dir, class_name)
            os.makedirs(class_dir, exist_ok=True)
            
            dest_path = os.path.join(class_dir, filename)
            shutil.copy2(src_path, dest_path)
            
    print("Cartella dataset_test preparata con successo.")

def setup_all():
    create_config()
    setup_test_dataset()

if __name__ == "__main__":
    setup_all()
