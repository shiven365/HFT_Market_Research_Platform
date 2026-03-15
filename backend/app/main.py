import csv
import math
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ai_prediction import (
    get_latest_prediction,
    start_ai_prediction_engine,
    stop_ai_prediction_engine,
)
from app.live_data import (
    get_live_klines,
    get_live_orderbook_snapshot,
    get_live_summary,
    get_live_trades,
    start_live_streams,
    stop_live_streams,
)


def parse_allowed_origins():
    origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    for part in raw.split(","):
        origin = part.strip().rstrip("/")
        if origin:
            origins.add(origin)
    return sorted(origins)


ALLOWED_ORIGINS = parse_allowed_origins()
ALLOWED_ORIGIN_REGEX = os.getenv(
    "CORS_ALLOWED_ORIGIN_REGEX",
    r"(^https?://(localhost|127\.0\.0\.1)(:\d+)?$)|(^https://([a-zA-Z0-9-]+\.)?vercel\.app$)",
)


app = FastAPI(title="QuantEdge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERVAL_TO_MINUTES = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
}

SNAPSHOT_MODES = {"volume", "trade_count"}
SIMULATION_STRATEGIES = {"momentum", "mean_reversion", "volume_spike"}


class SimulateRequest(BaseModel):
    strategy: Literal["momentum", "mean_reversion", "volume_spike"] = "momentum"
    threshold: float = Field(default=0.20, gt=0.0, le=10.0)
    fee_bps: float = Field(default=4.0, ge=0.0, le=100.0)
    slippage_bps: float = Field(default=2.0, ge=0.0, le=100.0)
    holding_minutes: int = Field(default=15, ge=1, le=240)
    lookback: int = Field(default=20, ge=2, le=240)
    start: Optional[str] = None
    end: Optional[str] = None


def parse_timestamp(value: Optional[str]) -> Optional[int]:
    if value is None or value == "":
        return None

    if value.isdigit():
        return int(value)

    normalized = value.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def sample_stdev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def read_klines(path: Path):
    rows = []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                {
                    "open_time": int(row["open_time"]),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                }
            )
    return rows


def read_trades(path: Path):
    rows = []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                {
                    "trade_id": int(row["trade_id"]),
                    "price": float(row["price"]),
                    "qty": float(row["qty"]),
                    "quote_qty": float(row["quote_qty"]),
                    "time": int(row["time"]),
                    "is_buyer_maker": row["is_buyer_maker"].strip().lower() == "true",
                }
            )
    return rows


def filter_klines(rows, start_ms: Optional[int], end_ms: Optional[int]):
    out = rows
    if start_ms is not None:
        out = [r for r in out if r["open_time"] >= start_ms]
    if end_ms is not None:
        out = [r for r in out if r["open_time"] <= end_ms]
    return out


def filter_trades(rows, start_ms: Optional[int], end_ms: Optional[int]):
    out = rows
    if start_ms is not None:
        out = [r for r in out if r["time"] >= start_ms]
    if end_ms is not None:
        out = [r for r in out if r["time"] <= end_ms]
    return out


def aggregate_klines(rows, interval: str):
    step_minutes = INTERVAL_TO_MINUTES[interval]
    if step_minutes == 1:
        return rows

    bucket_ms = step_minutes * 60 * 1000
    merged = []
    current = None
    current_bucket = None

    for row in rows:
        bucket = row["open_time"] // bucket_ms
        if current is None or bucket != current_bucket:
            if current is not None:
                merged.append(current)
            current_bucket = bucket
            current = {
                "open_time": bucket * bucket_ms,
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
            }
        else:
            current["high"] = max(current["high"], row["high"])
            current["low"] = min(current["low"], row["low"])
            current["close"] = row["close"]
            current["volume"] += row["volume"]

    if current is not None:
        merged.append(current)

    return merged


def compute_summary(klines, trades):
    if not klines:
        return {
            "total_trades": len(trades),
            "average_trade_size": 0.0,
            "return_pct": 0.0,
            "volatility_pct": 0.0,
        }

    closes = [k["close"] for k in klines]
    first_close = closes[0]
    last_close = closes[-1]
    return_pct = ((last_close - first_close) / first_close * 100.0) if first_close else 0.0

    returns = []
    for i in range(1, len(closes)):
        prev = closes[i - 1]
        curr = closes[i]
        if prev:
            returns.append((curr - prev) / prev)
    volatility_pct = sample_stdev(returns) * 100.0

    avg_trade_size = (sum(t["qty"] for t in trades) / len(trades)) if trades else 0.0

    return {
        "total_trades": len(trades),
        "average_trade_size": avg_trade_size,
        "return_pct": return_pct,
        "volatility_pct": volatility_pct,
    }


def compute_returns_series(klines):
    returns = []
    for i in range(1, len(klines)):
        prev_close = klines[i - 1]["close"]
        curr_close = klines[i]["close"]
        if not prev_close:
            continue
        returns.append(
            {
                "time": klines[i]["open_time"],
                "return_pct": ((curr_close - prev_close) / prev_close) * 100.0,
            }
        )
    return returns


def compute_rolling_volatility(returns_series, window: int):
    if len(returns_series) < window:
        return []

    output = []
    for i in range(window - 1, len(returns_series)):
        window_values = [r["return_pct"] / 100.0 for r in returns_series[i - window + 1 : i + 1]]
        output.append(
            {
                "time": returns_series[i]["time"],
                "volatility_pct": sample_stdev(window_values) * 100.0,
            }
        )
    return output


def build_histogram(
    values,
    bins_count: int,
    lower_q: Optional[float] = None,
    upper_q: Optional[float] = None,
    log_scale: bool = False,
):
    if not values:
        return []

    prepared = [float(v) for v in values]
    if log_scale:
        prepared = [math.log10(v) for v in prepared if v > 0]

    if not prepared:
        return []

    if lower_q is not None or upper_q is not None:
        sorted_values = sorted(prepared)
        lo = quantile(sorted_values, lower_q) if lower_q is not None else sorted_values[0]
        hi = quantile(sorted_values, upper_q) if upper_q is not None else sorted_values[-1]
        if lo > hi:
            lo, hi = hi, lo
        prepared = [min(max(v, lo), hi) for v in prepared]

    min_value = min(prepared)
    max_value = max(prepared)

    if min_value == max_value:
        only_value = (10 ** min_value) if log_scale else min_value
        return [
            {
                "bin_start": only_value,
                "bin_end": only_value,
                "mid": only_value,
                "count": len(prepared),
            }
        ]

    width = (max_value - min_value) / bins_count
    bins = [
        {
            "bin_start": min_value + (i * width),
            "bin_end": min_value + ((i + 1) * width),
            "mid": min_value + ((i + 0.5) * width),
            "count": 0,
        }
        for i in range(bins_count)
    ]

    for value in prepared:
        idx = int((value - min_value) / width)
        idx = min(max(idx, 0), bins_count - 1)
        bins[idx]["count"] += 1

    if log_scale:
        for b in bins:
            b["bin_start"] = 10 ** b["bin_start"]
            b["bin_end"] = 10 ** b["bin_end"]
            b["mid"] = 10 ** b["mid"]

    return bins


def quantile(sorted_values, q: float):
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = (len(sorted_values) - 1) * q
    lower = math.floor(pos)
    upper = math.ceil(pos)
    if lower == upper:
        return sorted_values[lower]
    weight = pos - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def buyer_seller_stats(trades):
    total = len(trades)
    seller_initiated = sum(1 for t in trades if t["is_buyer_maker"])
    buyer_initiated = total - seller_initiated
    return {
        "buyer_initiated": buyer_initiated,
        "seller_initiated": seller_initiated,
        "buyer_pct": (buyer_initiated / total * 100.0) if total else 0.0,
        "seller_pct": (seller_initiated / total * 100.0) if total else 0.0,
    }


def build_snapshot_frames(trades, frame_minutes: int, price_bucket: float):
    frame_ms = frame_minutes * 60 * 1000
    grouped = {}

    for trade in trades:
        frame_key = trade["time"] // frame_ms
        frame_data = grouped.setdefault(frame_key, {})

        price_bucket_value = round(math.floor(trade["price"] / price_bucket) * price_bucket, 2)
        bucket_data = frame_data.setdefault(
            price_bucket_value,
            {
                "price_bucket": price_bucket_value,
                "volume": 0.0,
                "trade_count": 0,
            },
        )

        bucket_data["volume"] += trade["qty"]
        bucket_data["trade_count"] += 1

    frames = []
    for idx, frame_key in enumerate(sorted(grouped.keys())):
        bins = sorted(grouped[frame_key].values(), key=lambda x: x["price_bucket"])
        frames.append(
            {
                "index": idx,
                "timestamp": frame_key * frame_ms,
                "bins": bins,
            }
        )

    return frames


def frame_label_from_ms(ts: int):
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def strategy_direction(strategy: str, klines, i: int, threshold_pct: float, lookback: int):
    threshold = threshold_pct / 100.0

    prev_close = klines[i - 1]["close"]
    curr_close = klines[i]["close"]
    one_bar_return = ((curr_close - prev_close) / prev_close) if prev_close else 0.0

    if strategy == "momentum":
        if one_bar_return >= threshold:
            return 1
        if one_bar_return <= -threshold:
            return -1
        return 0

    if strategy == "mean_reversion":
        if one_bar_return >= threshold:
            return -1
        if one_bar_return <= -threshold:
            return 1
        return 0

    if strategy == "volume_spike":
        start_idx = max(0, i - lookback)
        avg_volume = sum(k["volume"] for k in klines[start_idx:i]) / max(1, i - start_idx)
        is_spike = klines[i]["volume"] >= avg_volume * (1 + threshold)
        if not is_spike:
            return 0

        candle_open = klines[i]["open"]
        candle_return = ((klines[i]["close"] - candle_open) / candle_open) if candle_open else 0.0
        if candle_return > 0:
            return 1
        if candle_return < 0:
            return -1
        return 0

    return 0


def compute_max_drawdown(equity_points):
    if not equity_points:
        return 0.0

    peak = equity_points[0]["equity"]
    max_dd = 0.0
    for point in equity_points:
        eq = point["equity"]
        peak = max(peak, eq)
        if peak > 0:
            dd = (peak - eq) / peak
            max_dd = max(max_dd, dd)
    return max_dd


def run_backtest(klines, request: SimulateRequest):
    fee_rate = request.fee_bps / 10000.0
    slippage_rate = request.slippage_bps / 10000.0
    hold_bars = request.holding_minutes
    notional_usd = 1000.0

    equity = 1.0
    equity_curve = [{"time": klines[0]["open_time"], "equity": equity}]
    trade_returns = []
    trade_log = []
    trade_id_seq = 1

    i = max(1, request.lookback)
    while i < len(klines) - hold_bars - 1:
        direction = strategy_direction(request.strategy, klines, i, request.threshold, request.lookback)
        if direction == 0:
            i += 1
            continue

        entry_idx = i + 1
        exit_idx = min(entry_idx + hold_bars, len(klines) - 1)
        entry_bar = klines[entry_idx]
        exit_bar = klines[exit_idx]

        if direction > 0:
            side = "LONG"
            entry_price = entry_bar["open"] * (1 + slippage_rate)
            exit_price = exit_bar["open"] * (1 - slippage_rate)
            gross_return = (exit_price - entry_price) / entry_price if entry_price else 0.0
        else:
            side = "SHORT"
            entry_price = entry_bar["open"] * (1 - slippage_rate)
            exit_price = exit_bar["open"] * (1 + slippage_rate)
            gross_return = (entry_price - exit_price) / entry_price if entry_price else 0.0

        net_return = gross_return - 2 * fee_rate
        trade_returns.append(net_return)

        equity *= max(0.0001, 1 + net_return)
        equity_curve.append({"time": exit_bar["open_time"], "equity": equity})

        trade_log.append(
            {
                "trade_id": trade_id_seq,
                "entry_time": entry_bar["open_time"],
                "exit_time": exit_bar["open_time"],
                "side": side,
                "entry_price": entry_price,
                "exit_price": exit_price,
                "gross_return_pct": gross_return * 100.0,
                "net_return_pct": net_return * 100.0,
                "pnl_usd": net_return * notional_usd,
                "holding_bars": exit_idx - entry_idx,
            }
        )
        trade_id_seq += 1

        i = exit_idx

    trade_count = len(trade_returns)
    wins = sum(1 for r in trade_returns if r > 0)
    avg_trade = (sum(trade_returns) / trade_count) if trade_count else 0.0
    ret_std = sample_stdev(trade_returns)
    sharpe_like = (avg_trade / ret_std * math.sqrt(trade_count)) if ret_std > 0 else 0.0

    return {
        "metrics": {
            "total_trades": trade_count,
            "win_rate_pct": (wins / trade_count * 100.0) if trade_count else 0.0,
            "total_return_pct": (equity - 1.0) * 100.0,
            "avg_trade_return_pct": avg_trade * 100.0,
            "max_drawdown_pct": compute_max_drawdown(equity_curve) * 100.0,
            "sharpe_like": sharpe_like,
        },
        "equity_curve": equity_curve,
        "trade_log": trade_log,
    }


def get_data_paths():
    repo_root = Path(__file__).resolve().parents[2]
    return (
        repo_root / "backend" / "Datasets" / "BTCUSDT-1m-2024-01.csv",
        repo_root / "backend" / "Datasets" / "BTCUSDT-trades-2024-01-sample-100k.csv",
    )


KLINES = []
TRADES = []
SNAPSHOT_CACHE = {}
BACKTEST_RESULTS = {}


@app.on_event("startup")
def startup_event():
    global KLINES, TRADES, SNAPSHOT_CACHE, BACKTEST_RESULTS
    klines_path, trades_path = get_data_paths()

    if not klines_path.exists() or not trades_path.exists():
        raise RuntimeError("Dataset files not found in backend/Datasets")

    KLINES = read_klines(klines_path)
    TRADES = read_trades(trades_path)
    SNAPSHOT_CACHE = {}
    BACKTEST_RESULTS = {}


@app.on_event("startup")
async def startup_live_event():
    await start_live_streams()
    klines_path, _ = get_data_paths()
    await start_ai_prediction_engine(klines_path)


@app.on_event("shutdown")
async def shutdown_live_event():
    await stop_ai_prediction_engine()
    await stop_live_streams()


@app.get("/")
def root():
    return {"status": "ok", "message": "Trading Platform API running"}


@app.get("/meta")
def meta():
    if not KLINES or not TRADES:
        raise HTTPException(status_code=500, detail="Data not loaded")

    return {
        "symbol": "BTCUSDT",
        "klines_start": KLINES[0]["open_time"],
        "klines_end": KLINES[-1]["open_time"],
        "trades_start": TRADES[0]["time"],
        "trades_end": TRADES[-1]["time"],
    }


@app.get("/live/trades")
def get_live_trades_endpoint(limit: int = Query(default=200, ge=20, le=1000)):
    data = get_live_trades(limit)
    return {
        "symbol": "BTCUSDT",
        "count": len(data),
        "data": data,
    }


@app.get("/live/klines")
def get_live_klines_endpoint(
    interval: str = Query(default="1m"),
    limit: int = Query(default=240, ge=20, le=500),
):
    if interval not in INTERVAL_TO_MINUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported interval: {interval}")

    raw = get_live_klines(500)
    if not raw:
        raise HTTPException(status_code=503, detail="Live kline stream warming up. Please retry in a moment.")

    merged = aggregate_klines(raw, interval)
    sliced = merged[-limit:]

    return {
        "symbol": "BTCUSDT",
        "interval": interval,
        "count": len(sliced),
        "data": sliced,
    }


@app.get("/live/orderbook")
def get_live_orderbook_endpoint(
    price_bucket: float = Query(default=5.0, gt=0.0, le=500.0),
    max_levels: int = Query(default=50, ge=10, le=50),
):
    snapshot = get_live_orderbook_snapshot(price_bucket, max_levels)
    if snapshot["updated_at"] is None:
        raise HTTPException(status_code=503, detail="Live order book stream warming up. Please retry shortly.")
    return snapshot


@app.get("/live/summary")
def get_live_summary_endpoint():
    summary = get_live_summary()
    if summary["latest_price"] is None:
        raise HTTPException(status_code=503, detail="Live market stream warming up. Please retry in a moment.")
    return summary


@app.get("/prediction")
def get_prediction_endpoint():
    return get_latest_prediction()


@app.get("/summary")
def get_summary(start: Optional[str] = Query(default=None), end: Optional[str] = Query(default=None)):
    start_ms = parse_timestamp(start)
    end_ms = parse_timestamp(end)

    filtered_klines = filter_klines(KLINES, start_ms, end_ms)
    filtered_trades = filter_trades(TRADES, start_ms, end_ms)
    summary = compute_summary(filtered_klines, filtered_trades)

    return {
        "symbol": "BTCUSDT",
        "window": {
            "start": start_ms if start_ms is not None else (filtered_klines[0]["open_time"] if filtered_klines else None),
            "end": end_ms if end_ms is not None else (filtered_klines[-1]["open_time"] if filtered_klines else None),
        },
        **summary,
    }


@app.get("/klines")
def get_klines(
    start: Optional[str] = Query(default=None),
    end: Optional[str] = Query(default=None),
    interval: str = Query(default="1m"),
    limit: int = Query(default=600, ge=50, le=3000),
):
    if interval not in INTERVAL_TO_MINUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported interval: {interval}")

    start_ms = parse_timestamp(start)
    end_ms = parse_timestamp(end)

    filtered = filter_klines(KLINES, start_ms, end_ms)
    merged = aggregate_klines(filtered, interval)
    sliced = merged[-limit:]

    return {
        "symbol": "BTCUSDT",
        "interval": interval,
        "count": len(sliced),
        "data": sliced,
    }


@app.get("/trades/sample")
def get_trades_sample(
    start: Optional[str] = Query(default=None),
    end: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=20, le=1000),
):
    start_ms = parse_timestamp(start)
    end_ms = parse_timestamp(end)

    filtered = filter_trades(TRADES, start_ms, end_ms)
    sampled = filtered[-limit:]
    sampled.reverse()

    return {
        "symbol": "BTCUSDT",
        "count": len(sampled),
        "data": sampled,
    }


@app.get("/snapshot")
def get_snapshot(
    frame_index: int = Query(default=-1, ge=-1),
    mode: str = Query(default="volume"),
    frame_minutes: int = Query(default=1, ge=1, le=60),
    price_bucket: float = Query(default=5.0, gt=0.0, le=500.0),
    max_levels: int = Query(default=40, ge=10, le=200),
):
    if mode not in SNAPSHOT_MODES:
        raise HTTPException(status_code=400, detail="mode must be one of: volume, trade_count")

    cache_key = (frame_minutes, round(price_bucket, 6))
    frames = SNAPSHOT_CACHE.get(cache_key)

    if frames is None:
        frames = build_snapshot_frames(TRADES, frame_minutes, price_bucket)
        SNAPSHOT_CACHE[cache_key] = frames

    if not frames:
        raise HTTPException(status_code=404, detail="No snapshot frames available")

    resolved_index = len(frames) - 1 if frame_index == -1 else frame_index
    if resolved_index < 0 or resolved_index >= len(frames):
        raise HTTPException(status_code=400, detail="frame_index out of range")

    selected_frame = frames[resolved_index]
    ranked = sorted(selected_frame["bins"], key=lambda b: b[mode], reverse=True)[:max_levels]
    bins = sorted(ranked, key=lambda b: b["price_bucket"])

    max_activity = max((b[mode] for b in bins), default=0.0)
    enriched = []
    for b in bins:
        activity = float(b[mode])
        enriched.append(
            {
                "price_bucket": b["price_bucket"],
                "volume": b["volume"],
                "trade_count": b["trade_count"],
                "activity": activity,
                "intensity": (activity / max_activity) if max_activity else 0.0,
            }
        )

    frames_meta = [
        {
            "index": f["index"],
            "timestamp": f["timestamp"],
            "label": frame_label_from_ms(f["timestamp"]),
        }
        for f in frames
    ]

    return {
        "symbol": "BTCUSDT",
        "mode": mode,
        "frameIndex": resolved_index,
        "totalFrames": len(frames),
        "frame": frames_meta[resolved_index],
        "frames": frames_meta,
        "frameMinutes": frame_minutes,
        "priceBucketSize": price_bucket,
        "maxLevels": max_levels,
        "maxActivity": max_activity,
        "bins": enriched,
    }


@app.get("/features")
def get_features(
    start: Optional[str] = Query(default=None),
    end: Optional[str] = Query(default=None),
    volatility_window: int = Query(default=30, ge=5, le=240),
    histogram_bins: int = Query(default=24, ge=8, le=80),
):
    start_ms = parse_timestamp(start)
    end_ms = parse_timestamp(end)

    filtered_klines = filter_klines(KLINES, start_ms, end_ms)
    filtered_trades = filter_trades(TRADES, start_ms, end_ms)

    returns_series = compute_returns_series(filtered_klines)
    volatility_series = compute_rolling_volatility(returns_series, volatility_window)

    trade_sizes = [t["qty"] for t in filtered_trades]
    return_values = [r["return_pct"] for r in returns_series]

    return {
        "symbol": "BTCUSDT",
        "window": {
            "start": filtered_klines[0]["open_time"] if filtered_klines else None,
            "end": filtered_klines[-1]["open_time"] if filtered_klines else None,
            "candles": len(filtered_klines),
            "trades": len(filtered_trades),
        },
        "volatility_window": volatility_window,
        "volatility_series": volatility_series,
        "returns": returns_series,
        "trade_size_histogram": build_histogram(
            trade_sizes,
            histogram_bins,
            upper_q=0.995,
            log_scale=True,
        ),
        "return_distribution": build_histogram(
            return_values,
            histogram_bins,
            lower_q=0.01,
            upper_q=0.99,
        ),
        "buyer_seller_ratio": buyer_seller_stats(filtered_trades),
    }


@app.get("/insights")
def get_insights(start: Optional[str] = Query(default=None), end: Optional[str] = Query(default=None)):
    start_ms = parse_timestamp(start)
    end_ms = parse_timestamp(end)

    filtered_klines = filter_klines(KLINES, start_ms, end_ms)
    filtered_trades = filter_trades(TRADES, start_ms, end_ms)

    returns_series = compute_returns_series(filtered_klines)
    volatility_series = compute_rolling_volatility(returns_series, 30)
    buyer_seller = buyer_seller_stats(filtered_trades)

    trade_sizes = sorted(t["qty"] for t in filtered_trades)
    return_values = [r["return_pct"] for r in returns_series]
    average_trade_size = (sum(trade_sizes) / len(trade_sizes)) if trade_sizes else 0.0

    avg_volatility = (
        sum(v["volatility_pct"] for v in volatility_series) / len(volatility_series)
        if volatility_series
        else 0.0
    )
    max_volatility = max((v["volatility_pct"] for v in volatility_series), default=0.0)
    avg_return = (sum(return_values) / len(return_values)) if return_values else 0.0
    positive_return_share = (
        sum(1 for r in return_values if r > 0) / len(return_values) * 100.0 if return_values else 0.0
    )

    small_trade_cutoff = 0.01
    small_trade_share = (
        sum(1 for t in filtered_trades if t["qty"] <= small_trade_cutoff) / len(filtered_trades) * 100.0
        if filtered_trades
        else 0.0
    )
    top_decile_threshold = quantile(trade_sizes, 0.90)
    total_trade_volume = sum(trade_sizes)
    top_decile_volume_share = (
        sum(v for v in trade_sizes if v >= top_decile_threshold) / total_trade_volume * 100.0
        if total_trade_volume > 0
        else 0.0
    )

    dominant_side = "Buyer-initiated" if buyer_seller["buyer_initiated"] >= buyer_seller["seller_initiated"] else "Seller-initiated"

    observations = [
        (
            f"About {small_trade_share:.1f}% of trades are small (<= {small_trade_cutoff:.3f} BTC), "
            f"while the largest decile contributes {top_decile_volume_share:.1f}% of traded quantity."
        ),
        (
            "Rolling volatility averages "
            f"{avg_volatility:.3f}% and peaks near {max_volatility:.3f}%, "
            "suggesting periodic bursts of market activity."
        ),
        (
            f"{dominant_side} flow slightly dominates this window "
            f"({max(buyer_seller['buyer_pct'], buyer_seller['seller_pct']):.1f}% share)."
        ),
        (
            "Return distribution stays centered near zero "
            f"(mean {avg_return:.4f}%), with positive bars in {positive_return_share:.1f}% of intervals."
        ),
    ]

    return {
        "dataset_name": "BTCUSDT",
        "time_range": {
            "start": filtered_klines[0]["open_time"] if filtered_klines else None,
            "end": filtered_klines[-1]["open_time"] if filtered_klines else None,
        },
        "total_trades_analyzed": len(filtered_trades),
        "average_trade_size": average_trade_size,
        "buyer_seller_ratio": buyer_seller,
        "statistics": {
            "average_return_pct": avg_return,
            "volatility_avg_pct": avg_volatility,
            "volatility_max_pct": max_volatility,
            "positive_return_share_pct": positive_return_share,
        },
        "observations": observations,
    }


@app.post("/simulate")
def simulate(request: SimulateRequest):
    if request.strategy not in SIMULATION_STRATEGIES:
        raise HTTPException(status_code=400, detail="Unsupported strategy")

    start_ms = parse_timestamp(request.start)
    end_ms = parse_timestamp(request.end)
    filtered_klines = filter_klines(KLINES, start_ms, end_ms)

    if len(filtered_klines) > 8000:
        raise HTTPException(
            status_code=400,
            detail="Data window too large for simulation. Reduce date range to <= 8000 candles.",
        )

    min_required = request.lookback + request.holding_minutes + 4
    if len(filtered_klines) < min_required:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough candles for simulation. Need at least {min_required}, got {len(filtered_klines)}."
            ),
        )

    result = run_backtest(filtered_klines, request)

    backtest_id = str(uuid.uuid4())
    payload = {
        "backtest_id": backtest_id,
        "symbol": "BTCUSDT",
        "strategy": request.strategy,
        "parameters": {
            "threshold": request.threshold,
            "holding_time": request.holding_minutes,
            "fee_bps": request.fee_bps,
            "slippage_bps": request.slippage_bps,
            "lookback": request.lookback,
        },
        "window": {
            "start": filtered_klines[0]["open_time"],
            "end": filtered_klines[-1]["open_time"],
            "candles": len(filtered_klines),
        },
        "assumptions": {
            "fee_bps_per_side": request.fee_bps,
            "slippage_bps_per_side": request.slippage_bps,
            "holding_minutes": request.holding_minutes,
            "threshold_pct": request.threshold,
            "lookback_bars": request.lookback,
            "model_note": "Entry/exit use next candle open with slippage and round-trip fees.",
        },
        "metrics": result["metrics"],
        "equity_curve": result["equity_curve"],
        "trades": result["trade_log"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    BACKTEST_RESULTS[backtest_id] = payload

    return {
        "backtest_id": backtest_id,
        "strategy": request.strategy,
        "metrics": result["metrics"],
    }


@app.get("/backtest/{backtest_id}")
def get_backtest(backtest_id: str):
    result = BACKTEST_RESULTS.get(backtest_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
