import os
import sys
import json
import re
import shutil
import secrets
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
COMPOSE_FILE = ROOT_DIR / "docker-compose-ssy.yml"
EXTRA_COMPOSE_FILE = ROOT_DIR / "docker-compose.extra.yml"
ENV_FILE = ROOT_DIR / ".env"

def fail(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def info(msg: str) -> None:
    print(f"[INFO]  {msg}")


def load_env_file(env_path: Path) -> None:
    """将 .env 文件中的变量加载到 os.environ（已设置的变量不会被覆盖）。"""
    if not env_path.is_file():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            # 去除首尾引号（单引号或双引号）
            val = val.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = val


def require_cmd(cmd: str) -> None:
    if shutil.which(cmd) is None:
        fail(f"缺少依赖命令：{cmd}")


def is_truthy(val: str) -> bool:
    return str(val).lower() in ("1", "true", "yes", "on")


def has_control_chars(val: str) -> bool:
    return any(c in val for c in ("\n", "\r", "\t"))


def validate_path(label: str, val: str) -> None:
    if not val:
        fail(f"{label} 不能为空。")
    if has_control_chars(val):
        fail(f"{label} 包含不支持的控制字符。")
    if re.search(r"\s", val):
        fail(f"{label} 不能包含空格。")


def validate_named_volume(val: str) -> None:
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9_.\-]*$", val):
        fail("OPENCLAW_HOME_VOLUME 必须匹配 [A-Za-z0-9][A-Za-z0-9_.-]*。")


def validate_mount_spec(mount: str) -> None:
    if has_control_chars(mount):
        fail("挂载条目不能包含控制字符。")
    if not re.match(r"^[^ \t,:]+:[^ \t,:]+(:[^ \t,:]+)?$", mount):
        fail(f"无效的挂载格式 '{mount}'。期望 source:target[:options]，且不含空格。")


def run_compose(compose_args: list, *cmd_args, capture: bool = False, check: bool = True):
    cmd = ["docker", "compose"] + compose_args + list(cmd_args)
    if capture:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if check and result.returncode != 0:
            fail(f"命令失败：{' '.join(cmd)}\n{result.stderr.strip()}")
        return result
    result = subprocess.run(cmd)
    if check and result.returncode != 0:
        sys.exit(result.returncode)
    return result

load_env_file(ENV_FILE)

IMAGE_NAME = os.environ.get("OPENCLAW_IMAGE", "openclaw:latest")
EXTRA_MOUNTS = os.environ.get("OPENCLAW_EXTRA_MOUNTS", "")
HOME_VOLUME_NAME = os.environ.get("OPENCLAW_HOME_VOLUME", "")
RAW_SANDBOX = os.environ.get("OPENCLAW_SANDBOX", "")
DOCKER_SOCKET_PATH = os.environ.get("OPENCLAW_DOCKER_SOCKET", "")

require_cmd("docker")
if subprocess.run(["docker", "compose", "version"], capture_output=True).returncode != 0:
    fail("Docker Compose 不可用（请确认版本：docker compose version）")

# 解析 Docker socket 路径
if not DOCKER_SOCKET_PATH:
    docker_host = os.environ.get("DOCKER_HOST", "")
    DOCKER_SOCKET_PATH = docker_host.removeprefix("unix://") if docker_host.startswith("unix://") else "/var/run/docker.sock"

SANDBOX_ENABLED = "1" if is_truthy(RAW_SANDBOX) else ""

OPENCLAW_CONFIG_DIR = os.environ.get("OPENCLAW_CONFIG_DIR", str(Path.home() / ".openclaw"))
OPENCLAW_WORKSPACE_DIR = os.environ.get("OPENCLAW_WORKSPACE_DIR", str(Path.home() / ".openclaw" / "workspace"))

validate_path("OPENCLAW_CONFIG_DIR", OPENCLAW_CONFIG_DIR)
validate_path("OPENCLAW_WORKSPACE_DIR", OPENCLAW_WORKSPACE_DIR)

if HOME_VOLUME_NAME:
    if "/" in HOME_VOLUME_NAME:
        validate_path("OPENCLAW_HOME_VOLUME", HOME_VOLUME_NAME)
    else:
        validate_named_volume(HOME_VOLUME_NAME)

if has_control_chars(EXTRA_MOUNTS):
    fail("OPENCLAW_EXTRA_MOUNTS 不能包含控制字符。")

if SANDBOX_ENABLED:
    validate_path("OPENCLAW_DOCKER_SOCKET", DOCKER_SOCKET_PATH)

# ──────────────────────────────────────────────────────────────
# 创建目录结构
# ──────────────────────────────────────────────────────────────

paths_to_create = [
    OPENCLAW_CONFIG_DIR,
    OPENCLAW_WORKSPACE_DIR,
    os.path.join(OPENCLAW_CONFIG_DIR, "identity"),
    os.path.join(OPENCLAW_CONFIG_DIR, "agents", "main", "agent"),
    os.path.join(OPENCLAW_CONFIG_DIR, "agents", "main", "sessions"),
]
for p in paths_to_create:
    Path(p).mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────
# 更新环境变量
# ──────────────────────────────────────────────────────────────

os.environ.update({
    "OPENCLAW_CONFIG_DIR": OPENCLAW_CONFIG_DIR,
    "OPENCLAW_WORKSPACE_DIR": OPENCLAW_WORKSPACE_DIR,
    "OPENCLAW_SANDBOX": SANDBOX_ENABLED,
    "OPENCLAW_DOCKER_SOCKET": DOCKER_SOCKET_PATH,
})

DOCKER_GID = ""
if SANDBOX_ENABLED and os.path.exists(DOCKER_SOCKET_PATH):
    try:
        DOCKER_GID = str(os.stat(DOCKER_SOCKET_PATH).st_gid)
    except OSError:
        pass
os.environ["DOCKER_GID"] = DOCKER_GID

# ──────────────────────────────────────────────────────────────
# Gateway Token 处理
# ──────────────────────────────────────────────────────────────

def get_config_token() -> str | None:
    cfg_path = Path(OPENCLAW_CONFIG_DIR) / "openclaw.json"
    if not cfg_path.is_file():
        return None
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        token = cfg.get("gateway", {}).get("auth", {}).get("token")
        return token.strip() if isinstance(token, str) and token.strip() else None
    except Exception:
        return None


def get_env_file_token() -> str | None:
    if not ENV_FILE.is_file():
        return None
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("OPENCLAW_GATEWAY_TOKEN="):
                val = line.strip().split("=", 1)[1].strip("'\"")
                return val if val else None
    return None


OPENCLAW_GATEWAY_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
if not OPENCLAW_GATEWAY_TOKEN:
    if token := get_config_token():
        OPENCLAW_GATEWAY_TOKEN = token
        info(f"复用 {OPENCLAW_CONFIG_DIR}/openclaw.json 中的 gateway token")
    elif token := get_env_file_token():
        OPENCLAW_GATEWAY_TOKEN = token
        info(f"复用 {ENV_FILE} 中的 gateway token")
    else:
        OPENCLAW_GATEWAY_TOKEN = secrets.token_hex(32)
        info("已生成新的 gateway token")

os.environ["OPENCLAW_GATEWAY_TOKEN"] = OPENCLAW_GATEWAY_TOKEN

# ──────────────────────────────────────────────────────────────
# 动态 Compose 文件生成
# ──────────────────────────────────────────────────────────────

def write_extra_compose(home_vol: str, mounts: list[str]) -> None:
    lines = ["services:", "  openclaw-gateway:", "    volumes:"]

    vol_mounts: list[str] = []
    if home_vol:
        vol_mounts = [
            f"{home_vol}:/root",
            f"{OPENCLAW_CONFIG_DIR}:/root/.openclaw",
            f"{OPENCLAW_WORKSPACE_DIR}:/root/.openclaw/workspace",
        ]
        for m in vol_mounts:
            validate_mount_spec(m)
            lines.append(f"      - {m}")

    for m in mounts:
        validate_mount_spec(m)
        lines.append(f"      - {m}")

    lines.extend(["  openclaw-cli:", "    volumes:"])
    for m in vol_mounts + mounts:
        lines.append(f"      - {m}")

    if home_vol and "/" not in home_vol:
        validate_named_volume(home_vol)
        lines.extend(["volumes:", f"  {home_vol}:"])

    with open(EXTRA_COMPOSE_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


compose_files = [COMPOSE_FILE]

if SANDBOX_ENABLED and not os.environ.get("OPENCLAW_INSTALL_DOCKER_CLI"):
    os.environ["OPENCLAW_INSTALL_DOCKER_CLI"] = "1"

valid_mounts = [m.strip() for m in EXTRA_MOUNTS.split(",") if m.strip()] if EXTRA_MOUNTS else []

if HOME_VOLUME_NAME or valid_mounts:
    write_extra_compose(HOME_VOLUME_NAME, valid_mounts)
    compose_files.append(EXTRA_COMPOSE_FILE)

compose_args: list[str] = []
for cf in compose_files:
    compose_args.extend(["-f", str(cf)])

# ──────────────────────────────────────────────────────────────
# 更新 .env 文件
# ──────────────────────────────────────────────────────────────

MANAGED_KEYS = [
    "OPENCLAW_CONFIG_DIR",
    "OPENCLAW_WORKSPACE_DIR",
    "OPENCLAW_GATEWAY_TOKEN",
    "OPENCLAW_SANDBOX",
    "OPENCLAW_DOCKER_SOCKET",
    "DOCKER_GID",
    "OPENCLAW_INSTALL_DOCKER_CLI",
]


def upsert_env(file_path: Path, keys: list[str]) -> None:
    existing_lines: list[str] = []
    seen: set[str] = set()
    if file_path.is_file():
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                key_part = line.split("=")[0].strip() if "=" in line else None
                if key_part in keys:
                    existing_lines.append(f"{key_part}={os.environ.get(key_part, '')}\n")
                    seen.add(key_part)
                else:
                    existing_lines.append(line)
    for k in keys:
        if k not in seen:
            existing_lines.append(f"{k}={os.environ.get(k, '')}\n")
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(existing_lines)


upsert_env(ENV_FILE, MANAGED_KEYS)

# ──────────────────────────────────────────────────────────────
# 构建 Docker 镜像
# ──────────────────────────────────────────────────────────────

BUILD_ARGS = [
    "OPENCLAW_DOCKER_APT_PACKAGES",
    "OPENCLAW_EXTENSIONS",
    "OPENCLAW_INSTALL_DOCKER_CLI",
    "OPENCLAW_INSTALL_BROWSER",
]

if IMAGE_NAME:
    info(f"构建 Docker 镜像：{IMAGE_NAME}")
    if is_truthy(os.environ.get("DOCKER_BUILDX_AMD64", "")):
        build_cmd = ["docker", "buildx", "build"]
        for arg in BUILD_ARGS:
            if os.environ.get(arg):
                build_cmd.extend(["--build-arg", f"{arg}={os.environ[arg]}"])
        build_cmd.extend([
            "--platform", "linux/amd64",
            "-t", "openclaw:amd64-latest",
            "-f", str(ROOT_DIR / "Dockerfile"),
            str(ROOT_DIR),
        ])
    else:
        build_cmd = ["docker", "build"]
        for arg in BUILD_ARGS:
            if os.environ.get(arg):
                build_cmd.extend(["--build-arg", f"{arg}={os.environ[arg]}"])
        build_cmd.extend(["-t", IMAGE_NAME, "-f", str(ROOT_DIR / "Dockerfile"), str(ROOT_DIR)])
    subprocess.run(build_cmd, check=True)

# ──────────────────────────────────────────────────────────────
# 启动网关
# ──────────────────────────────────────────────────────────────

info("启动网关服务")
run_compose(compose_args, "up", "-d", "openclaw-gateway")

# ──────────────────────────────────────────────────────────────
# 沙盒浏览器（可选）
# ──────────────────────────────────────────────────────────────

OPENCLAW_BROWSER_IMAGE = os.environ.get("OPENCLAW_BROWSER_IMAGE", "")
if OPENCLAW_BROWSER_IMAGE:
    subprocess.run(
        ["docker", "build", "-f", "Dockerfile.sandbox-browser", "-t", OPENCLAW_BROWSER_IMAGE, "."],
        check=True,
    )
    info("启动沙盒浏览器")
    # 注意：此处使用独立的 browser compose 文件，不重复追加 compose_args 以避免参数冲突
    browser_compose_args = compose_args + ["-f", "docker-compose-browser.yml"]
    run_compose(browser_compose_args, "up", "-d", "openclaw-browser")
    run_compose(compose_args, "run", "--rm", "openclaw-cli",
                "config", "set", "browser.attachOnly", "true", check=False)
