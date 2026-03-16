import json
import logging
import threading
from collections import deque
from datetime import datetime, timezone

import websocket


logger = logging.getLogger("binance_stream")


class BinanceMarketStream:
    def __init__(
        self,
        stream_url: str = "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@kline_1m/btcusdt@depth",
        max_trades: int = 5000,
        max_klines: int = 500,
        max_orderbook_levels: int = 50,
        ping_interval: int = 20,
        ping_timeout: int = 10,
        reconnect_base_seconds: float = 2.0,
        reconnect_max_seconds: float = 30.0,
    ):
        self.stream_url = stream_url
        self.max_orderbook_levels = max_orderbook_levels

        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.reconnect_base_seconds = reconnect_base_seconds
        self.reconnect_max_seconds = reconnect_max_seconds

        self.live_trades = deque(maxlen=max_trades)
        self.live_klines = deque(maxlen=max_klines)
        self.live_orderbook = {
            "event_time": None,
            "bids": [],
            "asks": [],
        }

        self._lock = threading.Lock()
        self._thread = None
        self._stop_event = threading.Event()
        self._ws_app = None
        self._retry_delay = reconnect_base_seconds

    def start(self):
        with self._lock:
            if self._thread and self._thread.is_alive():
                return

            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run_forever, name="binance-market-stream", daemon=True)
            self._thread.start()

        logger.info("event=stream_started stream=binance_combined")

    def stop(self):
        self._stop_event.set()

        ws = self._ws_app
        if ws is not None:
            try:
                ws.close()
            except Exception:  # noqa: BLE001
                pass

        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=10)

        logger.info("event=stream_stopped stream=binance_combined")

    def is_running(self) -> bool:
        thread = self._thread
        return bool(thread and thread.is_alive())

    def get_trades(self, limit: int):
        with self._lock:
            data = list(self.live_trades)[-limit:]
        data.reverse()
        return data

    def get_klines(self, limit: int):
        with self._lock:
            return list(self.live_klines)[-limit:]

    def get_orderbook(self, max_levels: int):
        with self._lock:
            return {
                "event_time": self.live_orderbook["event_time"],
                "bids": self.live_orderbook["bids"][:max_levels],
                "asks": self.live_orderbook["asks"][:max_levels],
            }

    def _run_forever(self):
        while not self._stop_event.is_set():
            self._ws_app = websocket.WebSocketApp(
                self.stream_url,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close,
            )

            try:
                self._ws_app.run_forever(
                    ping_interval=self.ping_interval,
                    ping_timeout=self.ping_timeout,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("event=run_forever_exception error=%s", exc)
            finally:
                self._ws_app = None

            if self._stop_event.is_set():
                break

            wait_seconds = self._retry_delay
            logger.warning("event=reconnecting delay_seconds=%.1f", wait_seconds)
            self._stop_event.wait(wait_seconds)
            self._retry_delay = min(wait_seconds * 2.0, self.reconnect_max_seconds)

    def _on_open(self, ws):  # noqa: ARG002
        self._retry_delay = self.reconnect_base_seconds
        logger.info("event=connected stream=binance_combined")

    def _on_error(self, ws, error):  # noqa: ARG002
        if self._stop_event.is_set():
            return
        if "NoneType' object has no attribute 'sock'" in str(error):
            return
        logger.warning("event=error stream=binance_combined error=%s", error)

    def _on_close(self, ws, status_code, message):  # noqa: ARG002
        if self._stop_event.is_set():
            logger.info("event=closed stream=binance_combined status=stopping")
            return
        logger.warning(
            "event=closed stream=binance_combined status_code=%s message=%s",
            status_code,
            message,
        )

    def _on_message(self, ws, message):  # noqa: ARG002
        try:
            payload = json.loads(message)
        except json.JSONDecodeError:
            logger.warning("event=parse_error reason=invalid_json")
            return

        stream = payload.get("stream", "")
        data = payload.get("data", payload)

        logger.debug("event=message_received stream=%s", stream or "unknown")

        try:
            if stream.endswith("@trade") or {"p", "q", "t", "T"}.issubset(data.keys()):
                self._apply_trade(data)
            elif "@kline_" in stream or "k" in data:
                self._apply_kline(data)
            elif stream.endswith("@depth") or {"b", "a"}.issubset(data.keys()):
                self._apply_orderbook(data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("event=parse_error stream=%s error=%s", stream or "unknown", exc)

    def _apply_trade(self, payload):
        price = float(payload["p"])
        qty = float(payload["q"])
        trade = {
            "trade_id": int(payload["t"]),
            "price": price,
            "qty": qty,
            "quote_qty": price * qty,
            "time": int(payload["T"]),
            "is_buyer_maker": bool(payload.get("m", False)),
        }
        with self._lock:
            self.live_trades.append(trade)

    def _apply_kline(self, payload):
        k = payload.get("k", payload)
        kline = {
            "open_time": int(k["t"]),
            "close_time": int(k["T"]),
            "open": float(k["o"]),
            "high": float(k["h"]),
            "low": float(k["l"]),
            "close": float(k["c"]),
            "volume": float(k["v"]),
            "quote_volume": float(k.get("q", 0.0)),
            "is_closed": bool(k.get("x", False)),
        }

        with self._lock:
            if self.live_klines and self.live_klines[-1]["open_time"] == kline["open_time"]:
                self.live_klines[-1] = kline
            else:
                self.live_klines.append(kline)

    def _apply_orderbook(self, payload):
        bids = self._trim_levels(payload.get("b", []), descending=True)
        asks = self._trim_levels(payload.get("a", []), descending=False)

        if not bids and not asks:
            return

        event_time = int(payload.get("E", int(datetime.now(timezone.utc).timestamp() * 1000)))

        with self._lock:
            self.live_orderbook["event_time"] = event_time
            self.live_orderbook["bids"] = bids
            self.live_orderbook["asks"] = asks

    def _trim_levels(self, levels, descending: bool):
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
        return prepared[: self.max_orderbook_levels]
