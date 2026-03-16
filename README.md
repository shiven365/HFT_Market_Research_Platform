# QuantEdge

A laptop-friendly research platform that uses historical Binance BTCUSDT trades and 1-minute klines to explore market microstructure, run strategy simulations, and visualize insights through a React frontend and Python FastAPI backend.
## Live Demo

Demo link: https://frontend-five-ecru-90.vercel.app/
## Run Locally

### Backend

From `backend`:

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

From `frontend`:

```bash
npm install
npm run dev
```

## Deploy Backend On Render

This repository includes `render.yaml` at the repo root, so Render can auto-detect build/start settings.

1. Connect the GitHub repo in Render.
2. Create a new `Blueprint` or `Web Service` from this repository.
3. Confirm settings:
	- Root directory: `backend`
	- Build command: `pip install -r requirements.txt`
	- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
	- `CORS_ALLOWED_ORIGINS` = your Vercel frontend URL (or multiple URLs comma-separated)
	- Optional: `CORS_ALLOWED_ORIGIN_REGEX` for preview domains if needed
5. Deploy and copy the public backend URL.

## Deploy Frontend On Vercel

This repository includes `frontend/vercel.json` to support React Router rewrites.

1. Import the GitHub repo in Vercel.
2. Set project root directory to `frontend`.
3. Confirm settings:
	- Build command: `npm run build`
	- Output directory: `dist`
4. Add environment variable:
	- `VITE_API_BASE_URL` = your Render backend URL (for example: `https://quantedge-backend.onrender.com`)
5. Deploy.

## CORS Notes

- Backend CORS is environment-driven.
- Localhost origins are allowed by default.
- Production frontend origins should be set with `CORS_ALLOWED_ORIGINS` on Render.
