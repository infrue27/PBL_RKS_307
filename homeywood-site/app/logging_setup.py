import logging
import os
from logging.handlers import RotatingFileHandler


def setup_file_logging(app):
    logger = app.logger
    if any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
        return
    log_dir = os.path.join(app.root_path, "logs")
    try:
        os.makedirs(log_dir, exist_ok=True)
        handler = RotatingFileHandler(
            os.path.join(log_dir, "app.log"),
            maxBytes=1_000_000, backupCount=3, encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Logging ke file dinonaktifkan: %s", exc)
        return
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s [%(module)s:%(lineno)d] %(message)s"
    ))
    handler.setLevel(logging.INFO)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.info("Aplikasi Homey Wood dijalankan")
