"""Resume asset storage boundary."""

import os
from pathlib import Path
from uuid import uuid4


class LocalResumeAssetStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()

    def save(self, data: bytes, suffix: str) -> str:
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        storage_key = f"{uuid4().hex}{suffix}"
        destination = self.root / storage_key
        with destination.open("xb") as asset_file:
            asset_file.write(data)
        os.chmod(destination, 0o600)
        return storage_key

    def delete(self, storage_key: str) -> None:
        if Path(storage_key).name != storage_key:
            raise ValueError("Invalid storage key")
        path = self.root / storage_key
        try:
            path.unlink()
        except FileNotFoundError:
            pass
