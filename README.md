# 🩺 MedZoom AI — Intelligent Telemedicine & Clinical Diagnostics Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.15%2B-orange.svg)](https://tensorflow.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-purple.svg)](https://ai.google.dev/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black.svg)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Ready-brightgreen.svg)](https://www.mongodb.com/)

**MedZoom AI** is an end-to-end telemedicine platform that bridges the gap between remote doctor-patient consultations and advanced clinical AI diagnostics. It enables secure video/audio meetings, real-time deep learning chest X-ray classification, collaborative live drawing/annotation over medical scans, automated Gemini-powered radiology summaries, and OTP-verified authentication.

---

## 🌟 Key Features

* **🎥 WebRTC Video & Audio Consultations**: Peer-to-peer, low-latency video and audio streaming with Google STUN (`stun:stun.l.google.com:19302`) for cross-NAT global connectivity.
* **🧠 Deep Learning Chest X-Ray Diagnosis**: Integrated TensorFlow/Keras CNN (`covid_multiclass_model.h5`) predicting:
  * `Normal`
  * `COVID-19`
  * `Viral Pneumonia`
  * `Lung Opacity`
* **📝 Automated AI Radiology Reports**: Powered by Google Gemini 2.5 Flash, generating concise 4–5 line clinical summaries directly from detected diagnoses.
* **✏️ Collaborative Annotation Board**: Real-time synchronized canvas over uploaded X-rays with multi-user pens, erasers, geometric shapes, and custom colors.
* **🔐 Secure Authentication with Email OTP**: User registration protected by 6-digit OTP verification delivered via Gmail SMTP, password hashing via `bcrypt`, and stateless session management with JWT.
* **🪐 Modern Space-Themed UI**: Built using React 19, Material-UI (MUI), and Framer Motion with fluid animations and responsive glassmorphism.

---

## 📁 Project Architecture

The repository is organized into three clean modules:

```text
MedZoom-AI/
├── AI_analyst/               # 🧠 Flask Deep Learning Inference Service
│   ├── app.py                # REST API serving /predict and /health
│   ├── covid_multiclass_model.h5 # Trained 4-class CNN model (78.3 MB)
│   ├── requirements.txt      # Python dependencies (TensorFlow, Flask, Pillow)
│   └── venv/                 # Python virtual environment
│
├── client/                   # 💻 React Frontend (SPA)
│   ├── src/
│   │   ├── Components/       # Home, Login, Signup, VerifyOTP, Navbars
│   │   ├── App.jsx           # Client-side routing
│   │   └── index.css         # Styling & space animations
│   ├── index.html            # Vite entry point
│   ├── vite.config.js        # Vite dev server with proxy rules
│   └── package.json          # Frontend dependencies
│
├── web_scoket/               # ⚡ Node.js Backend & Signaling Server
│   ├── server.js             # Express API, WebRTC signaling, AI proxy, Gemini report endpoint
│   ├── routes/auth.js        # Signup, send-otp, verify-otp, and login
│   ├── models/               # Mongoose schemas (User, Otp)
│   ├── public/               # Static dashboard, meeting room, Three.js & GSAP assets
│   ├── .env.example          # Environment variable template
│   ├── .env                  # Active environment variables
│   └── package.json          # Node dependencies
│
└── package.json              # Unified root orchestration runner (concurrently)
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* **Node.js**: `v18.x` or higher ([Download](https://nodejs.org/))
* **Python**: `3.10`–`3.12` ([Download](https://www.python.org/))
* **MongoDB**: Local MongoDB instance running on `localhost:27017` OR a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI.

---

### 2. Environment Configuration

Navigate to the `web_scoket/` directory and configure `.env`:

```bash
cd web_scoket
cp .env.example .env
```

Edit `web_scoket/.env`:

```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/medzoom
JWT_SECRET=super_secret_jwt_key_123

# Google Gemini API Key for automated radiology report generation
GEMINI_API_KEY=your_gemini_api_key_here

# Gmail SMTP for sending 6-digit signup OTPs (Google 16-character App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password

# AI Analyst Prediction Service URL
AI_PREDICT_TARGET=http://localhost:5001
```

> **Note on Gmail App Passwords**: Do not use your normal Gmail account password. Generate a 16-character App Password at [Google Account > Security > App Passwords](https://myaccount.google.com/apppasswords).

---

### 3. Installation

Install dependencies across all components from the root directory:

```bash
# 1. Install root orchestration dependencies
npm install

# 2. Install React frontend dependencies
npm --prefix client install

# 3. Install WebSocket / Backend dependencies
npm --prefix web_scoket install
```

---

### 4. Running the Platform

#### Unified Run (Recommended)
From the root directory, run:
```bash
npm start
```
This automatically:
1. Builds the React client bundle into `client/dist`.
2. Starts the **Flask AI Analyst** on `http://localhost:5001`.
3. Starts the **Node.js WebSocket Server** on `http://localhost:8000`.

Open your browser and navigate to:
```text
http://localhost:8000
```

#### Running Components Individually

* **Flask AI Analyst Server**:
  ```bash
  cd AI_analyst
  venv\Scripts\python app.py
  # Linux/macOS: ./venv/bin/python app.py
  # Runs on http://127.0.0.1:5001
  ```

* **Node.js WebSocket & API Server**:
  ```bash
  cd web_scoket
  node server.js
  # Runs on http://localhost:8000
  ```

* **Vite React Dev Server (Optional for UI development)**:
  ```bash
  npm run dev:client
  # Runs on http://localhost:5173 with auto-proxy to 8000 and 5001
  ```

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | Hashes password, generates 6-digit OTP, saves to DB, emails code | `{ name, email, password }` |
| `POST` | `/api/auth/verify-otp` | Verifies OTP code and registers the user | `{ email, otp }` |
| `POST` | `/api/auth/login` | Authenticates user credentials and returns JWT | `{ email, password }` |

### 🧠 Diagnostics & AI Services

| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/predict` | Deep Learning inference on chest X-ray | `multipart/form-data` with `image` |
| `GET` | `/health` | AI Analyst model health check | *None* |
| `POST` | `/api/generate-report` | Gemini-powered medical radiology report | `{ diagnosis: "COVID" }` |

### 🚪 Meeting Rooms (`/api`)

| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/create-room` | Creates a new meeting room with host authorization | `{ roomName, roomCode, displayName }` |
| `POST` | `/api/check-room` | Verifies room existence and passcode | `{ roomName, roomCode }` |

---

## 🌐 Connecting MongoDB Globally (MongoDB Atlas)

To deploy to production or run without local MongoDB:

1. Create a free database cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Go to **Database Access** and create a user (e.g. `medzoom-admin` with password).
3. Under **Network Access**, add IP `0.0.0.0/0` (Allow access from anywhere).
4. Go to **Clusters > Connect > Drivers (Node.js)** and copy the connection string.
5. In `web_scoket/.env`, update `MONGODB_URI`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/medzoom?retryWrites=true&w=majority
   ```
Mongoose automatically detects cloud clusters and handles SSL and auto-reconnection.

---

## 🚢 Cloud Deployment Guide

### Option A: Render / Railway (PaaS)

#### 1. Web Service (`web_scoket` + `client`)
* **Root Directory**: `.`
* **Build Command**:
  ```bash
  npm --prefix client run build && cd web_scoket && npm install
  ```
* **Start Command**:
  ```bash
  cd web_scoket && node server.js
  ```
* **Environment Variables**:
  * `PORT=8000`
  * `MONGODB_URI=mongodb+srv://...`
  * `JWT_SECRET=...`
  * `GEMINI_API_KEY=...`
  * `EMAIL_USER=...`
  * `EMAIL_PASS=...`
  * `AI_PREDICT_TARGET=https://your-ai-analyst.onrender.com`

#### 2. Python AI Service (`AI_analyst`)
* **Root Directory**: `AI_analyst`
* **Build Command**:
  ```bash
  pip install -r requirements.txt
  ```
* **Start Command**:
  ```bash
  gunicorn app:app -b 0.0.0.0:$PORT
  ```

---

## 🛠️ Technology Stack

* **Frontend**: React 19, Material-UI (MUI), Framer Motion, Three.js, GSAP, Vite
* **Signaling & Real-Time**: WebRTC, Socket.IO
* **Backend**: Node.js, Express, Mongoose, Nodemailer, Bcrypt, JsonWebToken
* **Machine Learning & AI**: Python 3, TensorFlow / Keras, NumPy, Pillow, Google Gemini API
* **Database**: MongoDB (Local / Atlas Cloud)

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.
