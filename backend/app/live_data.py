import asyncio
import json
import logging
import math
from collections import deque
from datetime import datetime, timezone
from threading import Lock

import websockets


logger = logging.getLogger("live_data")

TRADE_STREAM_URL = "wss://stream.binance.com:9443/ws/btcusdt@trade"
KLINE_STREAM_URL = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"
ORDERBOOK_STREAM_URL = "wss://stream.binance.com:9443/ws/btcusdt@depth"

MAX_TRADES = 5000
MAX_KLINES = 500
MAX_ORDERBOOK_LEVELS = 50

LIVE_TRADES = deque(maxlen=MAX_TRADES)
LIVE_KLINES = deque(maxlen=MAX_KLINES)
LIVE_ORDERBOOK = {
    "event_time": None,
    "bids": [],
    "asks": [],
}

_lock = Lock()
_tasks = []
_started = False


def _sample_stdev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def _to_trade(payload):
    price = float(payload["p"])
    qty = float(payload["q"])
    return {
        "trade_id": int(payload["t"]),
        "price": price,
        "qty": qty,
        "quote_qty": price * qty,
        "time": int(payload["T"]),
        "is_buyer_maker": bool(payload["m"]),
    }


def _to_kline(payload):
    k = payload["k"]
    return {
        "open_time": int(k["t"]),
        "close_time": int(k["T"]),
        "open": float(k["o"]),
        "high": float(k["h"]),
        "low": float(k["l"]),
        "close": float(k["c"]),
        "volume": float(k["v"]),
        "quote_volume": float(k.get("q", 0.0)),
        "is_closed": bool(k["x"]),
    }


def _trim_levels(levels, descending: bool):
    prepared = []
    for row in levels:
        if len(row) < 2:
            continue
        price = float(row[0])
        qty = float(row[1])
        if qty <= 0:
            continue
        prepared.append([price, qty])

    prepared.sort(key=lambda x: x[0], reverse=descending)
    return prepared[:MAX_ORDERBOOK_LEVELS]


def _apply_trade(payload):
    if "p" not in payload or "q" not in payload:
        return
    record = _to_trade(payload)
    with _lock:
        LIVE_TRADES.append(record)


def _apply_kline(payload):
    if "k" not in payload:
        return
    record = _to_kline(payload)
    with _lock:
        if LIVE_KLINES and LIVE_KLINES[-1]["open_time"] == record["open_time"]:
            LIVE_KLINES[-1] = record
        else:
            LIVE_KLINES.append(record)


def _apply_orderbook(payload):
    bids = payload.get("b", [])
    asks = payload.get("a", [])
    event_time = int(payload.get("E", int(datetime.now(timezone.utc).timestamp() * 1000)))

    if not bids and not asks:
        return

    with _lock:
        LIVE_ORDERBOOK["event_time"] = event_time
        LIVE_ORDERBOOK["bids"] = _trim_levels(bids, descending=True)
        LIVE_ORDERBOOK["asks"] = _trim_levels(asks, descending=False)


async def _stream_loop(stream_name: str, url: str, on_message):
    backoff = 1.0
    while True:
        try:
            async with websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=20,
                open_timeout=20,
                close_timeout=5,
                max_queue=4096,
            ) as ws:
                logger.info("Connected to %s", stream_name)
                backoff = 1.0
                while True:
                    message = await ws.recv()
                    payload = json.loads(message)
                    on_message(payload)
        except asyncio.CancelledError:
            logger.info("Cancelled %s stream", stream_name)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s stream disconnected: %s", stream_name, exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.8, 30.0)


async def stream_trades():
    await _stream_loop("trades", TRADE_STREAM_URL, _apply_trade)


async def stream_klines():
    await _stream_loop("klines", KLINE_STREAM_URL, _apply_kline)


async def stream_orderbook():
    await _stream_loop("orderbook", ORDERBOOK_STREAM_URL, _apply_orderbook)


async def start_live_streams():
    global _tasks, _started
    if _started:
        return

    _started = True
    _tasks = [
        asyncio.create_task(stream_trades(), name="binance-trades"),
        asyncio.create_task(stream_klines(), name="binance-klines"),
        asyncio.create_task(stream_orderbook(), name="binance-orderbook"),
    ]


async def stop_live_streams():
    global _tasks, _started
    if not _started:
        return

    for task in _tasks:
        task.cancel()
    if _tasks:
        await asyncio.gather(*_tasks, return_exceptions=True)
    _tasks = []
    _started = False


def get_live_trades(limit: int):
    with _lock:
        data = list(LIVE_TRADES)[-limit:]
    data.reverse()
    return data


def get_live_klines(limit: int):
    with _lock:
        data = list(LIVE_KLINES)[-limit:]
    return data


def get_live_orderbook_levels(max_levels: int):
    with _lock:
        event_time = LIVE_ORDERBOOK["event_time"]
        bids = LIVE_ORDERBOOK["bids"][:max_levels]
        asks = LIVE_ORDERBOOK["asks"][:max_levels]
    return {
        "event_time": event_time,
        "bids": bids,
        "asks": asks,
    }


def get_live_orderbook_snapshot(price_bucket: float, max_levels: int):
    orderbook = get_live_orderbook_levels(max_levels)
    bids = orderbook["bids"]
    asks = orderbook["asks"]

    buckets = {}
    for side, levels in (("bid", bids), ("ask", asks)):
        for price, qty in levels:
            bucket_price = round(math.floor(price / price_bucket) * price_bucket, 2)
            bucket = buckets.setdefault(
                bucket_price,
                {
                    "price_bucket": bucket_price,
                    "volume": 0.0,
                    "bid_volume": 0.0,
                    "ask_volume": 0.0,
                    "trade_count": 0,
                },
            )
            bucket["volume"] += qty
            if side == "bid":
                bucket["bid_volume"] += qty
            else:
                bucket["ask_volume"] += qty

    ranked = sorted(buckets.values(), key=lambda row: row["volume"], reverse=True)[:max_levels]
    bins = sorted(ranked, key=lambda row: row["price_bucket"])

    max_activity = max((row["volume"] for row in bins), default=0.0)
    enriched = []
    for row in bins:
        enriched.append(
            {
                **row,
                "activity": row["volume"],
                "intensity": (row["volume"] / max_activity) if max_activity else 0.0,
            }
        )

    return {
        "symbol": "BTCUSDT",
        "updated_at": orderbook["event_time"],
        "priceBucketSize": price_bucket,
        "maxLevels": max_levels,
        "maxActivity": max_activity,
        "bids": bids,
        "asks": asks,
        "bins": enriched,
    }


def get_live_summary():
    trades = get_live_trades(MAX_TRADES)
    klines = get_live_klines(MAX_KLINES)

    latest_trade = trades[0] if trades else None
    latest_price = latest_trade["price"] if latest_trade else (klines[-1]["close"] if klines else None)

    if klines:
        first_close = klines[0]["open"]
        latest_close = klines[-1]["close"]
        change_pct = ((latest_close - first_close) / first_close * 100.0) if first_close else 0.0
        volume_24h = sum(k["volume"] for k in klines)
    else:
        change_pct = 0.0
        volume_24h = 0.0

    recent_returns = []
    for i in range(1, len(klines)):
        prev_close = klines[i - 1]["close"]
        curr_close = klines[i]["close"]
        if prev_close:
            recent_returns.append((curr_close - prev_close) / prev_close)
    volatility_pct = _sample_stdev(recent_returns[-60:]) * 100.0 if recent_returns else 0.0

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    one_min_ago = now_ms - 60_000
    last_minute_trades = [t for t in trades if t["time"] >= one_min_ago]
    trade_rate_per_min = float(len(last_minute_trades))

    buyer_initiated = sum(1 for t in trades if not t["is_buyer_maker"])
    seller_initiated = sum(1 for t in trades if t["is_buyer_maker"])
    total_flow = buyer_initiated + seller_initiated

    average_trade_size = (sum(t["qty"] for t in trades) / len(trades)) if trades else 0.0

    return {
        "symbol": "BTCUSDT",
        "updated_at": latest_trade["time"] if latest_trade else (klines[-1]["close_time"] if klines else None),
        "latest_price": latest_price,
        "change_24h_pct": change_pct,
        "volume_24h": volume_24h,
        "trade_rate_per_min": trade_rate_per_min,
        "volatility_pct": volatility_pct,
        "buy_pressure_pct": (buyer_initiated / total_flow * 100.0) if total_flow else 0.0,
        "sell_pressure_pct": (seller_initiated / total_flow * 100.0) if total_flow else 0.0,
        "total_trades": len(trades),
        "average_trade_size": average_trade_size,
    }