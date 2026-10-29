"""Run any sibling service directory with an explicit Compose environment."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        raise ValueError("Expected one environment tag, e.g. --development")
    match = re.fullmatch(r"(up|down|remove)-([a-zA-Z0-9_-]+)", sys.argv[1])
    if not match or not re.fullmatch(r"--[a-zA-Z0-9_-]+", sys.argv[2]):
        raise ValueError("Invalid action, service, or environment")
    action, service = match.groups()
    environment = sys.argv[2][2:]
    directory = Path(__file__).resolve().parent / service
    env_file = directory / f".env.{environment}"
    if not env_file.is_file():
        raise ValueError(f"Missing environment file: {env_file}")
    if not (directory / "docker-compose.yml").is_file():
        raise ValueError(f"Missing docker-compose.yml: {directory}")
    command = ["docker", "compose", "--project-name", f"agents-{service}-{environment}",
               "--env-file", str(env_file), "-f", str(directory / "docker-compose.yml")]
    config = json.loads(subprocess.check_output(command + ["config", "--format", "json"], text=True))
    volume = None
    if action in ("up", "remove"):
        raw = config.get("x-volume-path")
        if raw:
            volume = Path(raw).expanduser()
            # Require a dedicated data directory; never remove a filesystem root or symlink.
            if not volume.is_absolute() or len(volume.parts) < 4 or volume.is_symlink():
                raise ValueError("VOLUME_PATH must be an absolute, dedicated data directory (at least 3 levels)")
            if volume.resolve() != volume or volume == Path.home() or volume in Path(__file__).resolve().parents:
                raise ValueError("Unsafe VOLUME_PATH")
            if volume.exists() and not volume.is_dir():
                raise ValueError(f"VOLUME_PATH is not a directory: {volume}")
        elif any(v.get("type") == "bind" for s in config["services"].values() for v in s.get("volumes", [])):
            raise ValueError("Bind mounts require x-volume-path: ${VOLUME_PATH:?VOLUME_PATH is required}")
    if action == "up":
        if volume and not volume.exists():
            volume.mkdir(parents=True)
        subprocess.run(command + ["up", "-d", "--build"], check=True)
    else:
        subprocess.run(command + ["down"], check=True)
        if action == "remove" and volume and volume.exists():
            shutil.rmtree(volume)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
