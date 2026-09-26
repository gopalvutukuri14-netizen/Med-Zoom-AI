import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp

# ================================
#   LOAD MODEL (NO GRADCAM)
# ================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "covid_multiclass_model.h5")
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

IMG_SIZE = (128, 128)
CLASS_NAMES = ["Normal", "COVID", "Viral Pneumonia", "Lung Opacity"]


def preprocess_image(raw_bytes):
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img) / 255.0
    arr = arr.reshape(1, IMG_SIZE[0], IMG_SIZE[1], 3)
    return arr


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "MedZoom AI Analyst",
        "model": "covid_multiclass_model.h5",
        "classes": CLASS_NAMES
    }), 200


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    raw = request.files["image"].read()

    try:
        batch = preprocess_image(raw)
        preds = model.predict(batch)[0]

        index = int(np.argmax(preds))
        label = CLASS_NAMES[index]
        confidence = float(preds[index])

        encoded = base64.b64encode(raw).decode("utf-8")

        return jsonify({
            "result": label,
            "confidence": confidence,
            "image": encoded
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"[AI Analyst] Server running on http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)

