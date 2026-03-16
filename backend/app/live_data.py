import math
from datetime import datetime, timezone

from app.binance_stream import BinanceMarketStream


MAX_TRADES = 5000
MAX_KLINES = 500
MAX_ORDERBOOK_LEVELS = 50

_STREAM = BinanceMarketStream(
    max_trades=MAX_TRADES,
    max_klines=MAX_KLINES,
    max_orderbook_levels=MAX_ORDERBOOK_LEVELS,
)


def _sample_stdev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


async def start_live_streams():
    _STREAM.start()


async def stop_live_streams():
    _STREAM.stop()


def get_live_trades(limit: int):
    return _STREAM.get_trades(limit)


def get_live_klines(limit: int):
    return _STREAM.get_klines(limit)


def get_live_orderbook_levels(max_levels: int):
    return _STREAM.get_orderbook(max_levels)


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
