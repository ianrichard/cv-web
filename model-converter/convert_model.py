import os
import shutil
import requests
from ultralytics import YOLO

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'models'))
MODEL_NAMES = [
    "yolo11n",
    "yolo11s",
    "yoloe-11s-seg",
    "yoloe-11m-seg"
]
BASE_URL = "https://github.com/ultralytics/assets/releases/download/v8.3.0/"
MODEL_URLS = {name: f"{BASE_URL}{name}.pt" for name in MODEL_NAMES}

def download_model(model_name, url):
    model_path = os.path.join(MODELS_DIR, f"{model_name}.pt")
    print(f"Downloading {model_name} model from {url} ...")
    response = requests.get(url, stream=True)
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"Failed to download {model_name} model: {e}")
        print("Please check the URL or download the model manually from the official Ultralytics releases page.")
        return False
    with open(model_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"Downloaded {model_name} model to {model_path}")
    return True

def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Download models if not present
    for model_name in MODEL_NAMES:
        model_path = os.path.join(MODELS_DIR, f"{model_name}.pt")
        url = MODEL_URLS.get(model_name)
        if os.path.exists(model_path):
            print(f"Using existing {model_name} model at {model_path}")
        elif url:
            success = download_model(model_name, url)
            if not success or not os.path.exists(model_path):
                print(f"{model_name} model not available. Skipping.")
                continue
        else:
            print(f"No download URL for {model_name}. Please add it to MODEL_URLS or download manually.")
            continue

    # Clean up calibration .npy files in script dir and models dir
    for search_dir in [os.path.dirname(__file__), MODELS_DIR]:
        for fname in os.listdir(search_dir):
            if fname.startswith("calibration_image_sample_data") and fname.endswith(".npy"):
                try:
                    os.remove(os.path.join(search_dir, fname))
                    print(f"Removed leftover calibration file: {fname}")
                except Exception as e:
                    print(f"Could not remove {fname}: {e}")

    for model_name in MODEL_NAMES:
        weights_path = os.path.join(MODELS_DIR, f"{model_name}.pt")
        onnx_path = os.path.splitext(weights_path)[0] + ".onnx"
        pb_path = os.path.splitext(weights_path)[0] + ".pb"
        tfjs_dir = os.path.join(MODELS_DIR, model_name + '_web_model')
        tfjs_json = os.path.join(tfjs_dir, "model.json")
        tfjs_bin = [f for f in os.listdir(tfjs_dir)] if os.path.isdir(tfjs_dir) else []
        tfjs_bin_files = [f for f in tfjs_bin if f.endswith('.bin')]

        # Check for existence of source files
        src_files_exist = (
            os.path.exists(weights_path) and os.path.getsize(weights_path) > 0 and
            os.path.exists(onnx_path) and os.path.getsize(onnx_path) > 0 and
            os.path.exists(pb_path) and os.path.getsize(pb_path) > 0
        )
        # Check for existence of TF.js export files
        tfjs_files_exist = (
            os.path.isdir(tfjs_dir) and
            os.path.exists(tfjs_json) and
            len(tfjs_bin_files) > 0
        )

        if src_files_exist and tfjs_files_exist:
            print(f"Skipping {model_name}: .pt, .onnx, .pb, and TF.js export (model.json and .bin) already exist.")
            continue
        if not os.path.exists(weights_path) or os.path.getsize(weights_path) == 0:
            print(f"Skipping {model_name}: .pt file does not exist or is empty.")
            continue
        print(f'Exporting {weights_path}...')
        try:
            model = YOLO(weights_path)
            export_result = model.export(format="tfjs", name=model_name + '_web_model')
        except Exception as e:
            print(f"TF.js export failed for {model_name}: {e}")
            continue

        export_dir = getattr(export_result, 'save_dir', None)
        if not export_dir or not os.path.exists(export_dir):
            print(f"TF.js export directory not found for {model_name}. Conversion failed or not supported on this platform.")
            continue

        # Debug: List files in export_dir
        print(f"Contents of {export_dir}: {os.listdir(export_dir)}")

        # Additional debug: Check for model.json and .bin files
        if os.path.exists(export_dir):
            has_json = os.path.exists(os.path.join(export_dir, "model.json"))
            bin_files = [f for f in os.listdir(export_dir) if f.endswith('.bin')]
            print(f"TF.js export for {model_name}: model.json exists: {has_json}, .bin files: {bin_files}")

        if os.path.abspath(export_dir) != tfjs_dir:
            if os.path.exists(tfjs_dir):
                shutil.rmtree(tfjs_dir)
            shutil.move(export_dir, tfjs_dir)
        print(f"Exported model moved to {tfjs_dir}")

if __name__ == "__main__":
    main()