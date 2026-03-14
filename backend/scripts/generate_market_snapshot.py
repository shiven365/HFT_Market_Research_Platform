import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path


def pct_change(new_value: float, old_value: float) -> float:
    if old_value == 0:
        return 0.0
    return ((new_value - old_value) / old_value) * 100.0


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
                    "time": int(row["time"]),
                    "quote_qty": float(row["quote_qty"]),
                    "is_buyer_maker": row["is_buyer_maker"].strip().lower() == "true",
                }
            )
    return rows


def stdev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def build_chart_candles(klines, limit=140):
    selected = klines[-limit:] if len(klines) > limit else klines
    return [
        {
            "time": k["open_time"],
            "open": k["open"],
            "high": k["high"],
            "low": k["low"],
            "close": k["close"],
            "volume": k["volume"],
        }
        for k in selected
    ]


def main():
    repo_root = Path(__file__).resolve().parents[2]
    klines_path = repo_root / "backend" / "Datasets" / "BTCUSDT-1m-2024-01.csv"
    trades_path = repo_root / "backend" / "Datasets" / "BTCUSDT-trades-2024-01-sample-100k.csv"
    output_path = repo_root / "frontend" / "public" / "market-snapshot.json"

    klines = read_klines(klines_path)
    trades = read_trades(trades_path)

    if len(klines) < 2:
        raise RuntimeError("Not enough klines to compute snapshot")

    latest = klines[-1]
    close_prices = [k["close"] for k in klines]

    one_min_change = pct_change(close_prices[-1], close_prices[-2])
    fifteen_min_change = pct_change(close_prices[-1], close_prices[-16]) if len(close_prices) > 15 else 0.0
    one_hour_change = pct_change(close_prices[-1], close_prices[-61]) if len(close_prices) > 60 else 0.0
    day_change = pct_change(close_prices[-1], close_prices[-1441]) if len(close_prices) > 1440 else 0.0

    window_24h = klines[-1440:] if len(klines) >= 1440 else klines
    high_24h = max(k["high"] for k in window_24h)
    low_24h = min(k["low"] for k in window_24h)
    volume_24h = sum(k["volume"] for k in window_24h)

    recent_returns = []
    recent_closes = close_prices[-121:] if len(close_prices) >= 121 else close_prices
    for i in range(1, len(recent_closes)):
        prev_close = recent_closes[i - 1]
        curr_close = recent_closes[i]
        if prev_close != 0:
            recent_returns.append((curr_close - prev_close) / prev_close)
    volatility_1h_pct = stdev(recent_returns) * 100.0

    total_quote = sum(t["quote_qty"] for t in trades)
    buy_quote = sum(t["quote_qty"] for t in trades if not t["is_buyer_maker"])
    sell_quote = total_quote - buy_quote
    buy_pressure_pct = (buy_quote / total_quote) * 100.0 if total_quote else 0.0
    sell_pressure_pct = (sell_quote / total_quote) * 100.0 if total_quote else 0.0

    spread_proxy = latest["high"] - latest["low"]
    avg_trade_quote = (total_quote / len(trades)) if trades else 0.0
    largest_trade_quote = max((t["quote_qty"] for t in trades), default=0.0)

    minute_buckets = {t["time"] // 60000 for t in trades}
    trades_per_min = (len(trades) / len(minute_buckets)) if minute_buckets else 0.0

    snapshot = {
        "symbol": "BTCUSDT",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "ticker": [
            {
                "label": "Last Price",
                "value": latest["close"],
                "changePct": one_hour_change,
                "changeLabel": "1H",
            },
            {
                "label": "24H Change",
                "value": day_change,
                "changePct": day_change,
                "changeLabel": "24H",
                "isPercentValue": True,
            },
            {
                "label": "24H Volume",
                "value": volume_24h,
                "changePct": one_min_change,
                "changeLabel": "1M",
            },
            {
                "label": "Trades / Minute",
                "value": trades_per_min,
                "changePct": fifteen_min_change,
                "changeLabel": "15M",
            },
        ],
        "board": {
            "high24": high_24h,
            "low24": low_24h,
            "volume24": volume_24h,
            "lastPrice": latest["close"],
        },
        "flow": [
            {"side": "Buy Pressure", "value": buy_pressure_pct, "tone": "positive", "isPercent": True},
            {"side": "Sell Pressure", "value": sell_pressure_pct, "tone": "negative", "isPercent": True},
            {"side": "Spread Proxy", "value": spread_proxy, "tone": "neutral", "isCurrency": True},
            {"side": "1H Volatility", "value": volatility_1h_pct, "tone": "neutral", "isPercent": True},
        ],
        "signals": [
            {"name": "1M Return", "value": one_min_change, "isPercent": True},
            {"name": "15M Return", "value": fifteen_min_change, "isPercent": True},
            {"name": "Average Trade Size", "value": avg_trade_quote, "isCurrency": True},
            {"name": "Largest Trade", "value": largest_trade_quote, "isCurrency": True},
        ],
        "chart": {
            "interval": "1m",
            "candles": build_chart_candles(klines),
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"Wrote snapshot: {output_path}")


if __name__ == "__main__":
    main()
