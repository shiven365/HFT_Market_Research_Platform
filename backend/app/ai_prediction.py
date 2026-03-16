import asyncio
import logging
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Optional
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

from app.live_data import get_live_klines


logger = logging.getLogger("ai_prediction")

FEATURE_COLUMNS = [
    "return_1m",
    "return_5m",
    "momentum",
    "rolling_volatility",
    "volume_change",
]

MAX_CANDLES = 500
MIN_CANDLES_FOR_FEATURES = 20
PREDICTION_INTERVAL_SECONDS = 10

LIVE_CANDLES = deque(maxlen=MAX_CANDLES)
LATEST_PREDICTION = {
    "status": "initializing",
    "signal": "NEUTRAL",
    "prob_up": 0.5,
    "prob_down": 0.5,
    "confidence": 0.5,
    "confidence_level": "Low",
    "model_accuracy": None,
    "updated_at": None,
    "buffer_size": 0,
    "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
}

MODEL: Optional[RandomForestClassifier] = None
MODEL_ACCURACY: Optional[float] = None
MODEL_TRAINED_AT: Optional[str] = None
TRAINING_DATASET_PATH: Optional[Path] = None
LAST_TRAIN_ERROR: Optional[str] = None
LAST_TRAIN_ATTEMPT_TS: float = 0.0
TRAIN_RETRY_SECONDS = 60

_started = False
_task: Optional[asyncio.Task] = None
_lock = Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_candle(raw):
    return {
        "open_time": int(raw["open_time"]),
        "open": float(raw.get("open", 0.0)),
        "high": float(raw.get("high", 0.0)),
        "low": float(raw.get("low", 0.0)),
        "close": float(raw.get("close", 0.0)),
        "volume": float(raw.get("volume", 0.0)),
    }


def _build_feature_frame(df: pd.DataFrame, include_target: bool) -> pd.DataFrame:
    frame = df.sort_values("open_time").copy()

    frame["return_1m"] = frame["close"].pct_change(1)
    frame["return_5m"] = frame["close"].pct_change(5)
    frame["momentum"] = frame["close"] - frame["close"].shift(3)
    frame["rolling_volatility"] = frame["return_1m"].rolling(10).std()
    frame["volume_change"] = frame["volume"] / frame["volume"].rolling(10).mean()

    if include_target:
        frame["target"] = (frame["close"].shift(-1) > frame["close"]).astype(int)

    return frame


def _probability_for_class(model: RandomForestClassifier, vector: np.ndarray, class_value: int) -> float:
    probs = model.predict_proba(vector)[0]
    classes = list(model.classes_)
    if class_value in classes:
        return float(probs[classes.index(class_value)])
    return 0.0


def _set_latest(payload):
    with _lock:
        global LATEST_PREDICTION
        LATEST_PREDICTION = payload


def _train_model(dataset_path: Path):
    required_cols = ["open_time", "close", "volume"]
    df = pd.read_csv(dataset_path)

    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise RuntimeError(f"Missing required columns for training: {', '.join(missing)}")

    training_df = _build_feature_frame(df[required_cols], include_target=True)
    training_df = training_df.dropna(subset=FEATURE_COLUMNS + ["target"])

    if len(training_df) < 50:
        raise RuntimeError("Not enough rows to train AI prediction model")

    x = training_df[FEATURE_COLUMNS].astype(float)
    y = training_df["target"].astype(int)

    split_idx = int(len(training_df) * 0.8)
    split_idx = max(1, min(split_idx, len(training_df) - 1))

    x_train, x_test = x.iloc[:split_idx], x.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=1,
    )
    model.fit(x_train, y_train)

    if len(y_test) > 0:
        y_pred = model.predict(x_test)
        accuracy = float(accuracy_score(y_test, y_pred))
    else:
        y_pred_train = model.predict(x_train)
        accuracy = float(accuracy_score(y_train, y_pred_train))

    with _lock:
        global MODEL, MODEL_ACCURACY, MODEL_TRAINED_AT, LAST_TRAIN_ERROR
        MODEL = model
        MODEL_ACCURACY = accuracy
        MODEL_TRAINED_AT = _utc_now_iso()
        LAST_TRAIN_ERROR = None


def _attempt_train_model(dataset_path: Path):
    global LAST_TRAIN_ATTEMPT_TS
    LAST_TRAIN_ATTEMPT_TS = time.time()

    try:
        _train_model(Path(dataset_path))
        logger.info("AI prediction model trained successfully")
        return True
    except Exception as exc:  # noqa: BLE001
        with _lock:
            global LAST_TRAIN_ERROR
            LAST_TRAIN_ERROR = str(exc)
        logger.warning("AI prediction model training failed: %s", exc)
        return False



def _refresh_live_buffer():
    candles = get_live_klines(MAX_CANDLES)
    if not candles:
        return

    normalized = [_normalize_candle(c) for c in candles]
    normalized.sort(key=lambda row: row["open_time"])

    with _lock:
        LIVE_CANDLES.clear()
        LIVE_CANDLES.extend(normalized[-MAX_CANDLES:])



def _confidence_level(prob_up: float, prob_down: float) -> str:
    top_prob = max(prob_up, prob_down)
    if top_prob > 0.70:
        return "High"
    if top_prob > 0.60:
        return "Medium"
    return "Low"



def _prediction_signal(prob_up: float, prob_down: float) -> str:
    diff = prob_up - prob_down
    if abs(diff) < 0.05:
        return "NEUTRAL"
    return "LONG" if diff > 0 else "SHORT"



def _predict_from_live_buffer():
    with _lock:
        model = MODEL
        model_accuracy = MODEL_ACCURACY
        candles = list(LIVE_CANDLES)
        last_train_error = LAST_TRAIN_ERROR

    if model is None:
        return {
            "status": "model_unavailable",
            "signal": "NEUTRAL",
            "prob_up": 0.5,
            "prob_down": 0.5,
            "confidence": 0.5,
            "confidence_level": "Low",
            "model_accuracy": model_accuracy,
            "updated_at": _utc_now_iso(),
            "buffer_size": len(candles),
            "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
            "error": last_train_error,
        }

    if len(candles) < MIN_CANDLES_FOR_FEATURES:
        return {
            "status": "warming_up",
            "signal": "NEUTRAL",
            "prob_up": 0.5,
            "prob_down": 0.5,
            "confidence": 0.5,
            "confidence_level": "Low",
            "model_accuracy": model_accuracy,
            "updated_at": _utc_now_iso(),
            "buffer_size": len(candles),
            "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
        }

    live_df = pd.DataFrame(candles)
    feature_df = _build_feature_frame(live_df[["open_time", "close", "volume"]], include_target=False)
    latest_features = feature_df.dropna(subset=FEATURE_COLUMNS)

    if latest_features.empty:
        return {
            "status": "warming_up",
            "signal": "NEUTRAL",
            "prob_up": 0.5,
            "prob_down": 0.5,
            "confidence": 0.5,
            "confidence_level": "Low",
            "model_accuracy": model_accuracy,
            "updated_at": _utc_now_iso(),
            "buffer_size": len(candles),
            "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
        }

    vector = latest_features.iloc[-1][FEATURE_COLUMNS].to_numpy(dtype=float).reshape(1, -1)
    prob_up = _probability_for_class(model, vector, 1)
    prob_down = _probability_for_class(model, vector, 0)

    signal = _prediction_signal(prob_up, prob_down)
    confidence = max(prob_up, prob_down)

    return {
        "status": "ready",
        "signal": signal,
        "prob_up": prob_up,
        "prob_down": prob_down,
        "confidence": confidence,
        "confidence_level": _confidence_level(prob_up, prob_down),
        "model_accuracy": model_accuracy,
        "updated_at": _utc_now_iso(),
        "model_trained_at": MODEL_TRAINED_AT,
        "buffer_size": len(candles),
        "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
    }


async def _prediction_loop():
    while True:
        try:
            if MODEL is None and TRAINING_DATASET_PATH is not None:
                elapsed = time.time() - LAST_TRAIN_ATTEMPT_TS
                if LAST_TRAIN_ATTEMPT_TS == 0.0 or elapsed >= TRAIN_RETRY_SECONDS:
                    _attempt_train_model(TRAINING_DATASET_PATH)

            _refresh_live_buffer()
            payload = _predict_from_live_buffer()
            _set_latest(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Prediction loop iteration failed: %s", exc)
        await asyncio.sleep(PREDICTION_INTERVAL_SECONDS)


async def start_ai_prediction_engine(dataset_path: Path):
    global _started, _task
    if _started:
        return

    with _lock:
        global TRAINING_DATASET_PATH
        TRAINING_DATASET_PATH = Path(dataset_path)

    if not _attempt_train_model(Path(dataset_path)):
        with _lock:
            last_error = LAST_TRAIN_ERROR
        _set_latest(
            {
                "status": "error",
                "signal": "NEUTRAL",
                "prob_up": 0.5,
                "prob_down": 0.5,
                "confidence": 0.5,
                "confidence_level": "Low",
                "model_accuracy": None,
                "updated_at": _utc_now_iso(),
                "buffer_size": 0,
                "prediction_interval_seconds": PREDICTION_INTERVAL_SECONDS,
                "error": last_error,
            }
        )

    _task = asyncio.create_task(_prediction_loop(), name="ai-prediction-loop")
    _started = True


async def stop_ai_prediction_engine():
    global _started, _task
    if not _started:
        return

    if _task is not None:
        _task.cancel()
        await asyncio.gather(_task, return_exceptions=True)

    _task = None
    _started = False


def get_latest_prediction():
    with _lock:
        return dict(LATEST_PREDICTION)
