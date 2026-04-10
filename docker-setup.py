#!/usr/bin/env python3
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

def load_env_file(env_path: Path):
    if env_path.is_file():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    # 只在环境变量未设置时加载，或者强制覆盖（模拟 bash set -a / source）
                    os.environ[key.strip()] = val.strip()

load_env_file(ENV_FILE)
IMAGE_NAME = os.environ.get("OPENCLAW_IMAGE", "openclaw:latest")
EXTRA_MOUNTS = os.environ.get("OPENCLAW_EXTRA_MOUNTS", "")
HOME_VOLUME_NAME = os.environ.get("OPENCLAW_HOME_VOLUME", "")
RAW_SANDBOX_SETTING = os.environ.get("OPENCLAW_SANDBOX", "")
DOCKER_SOCKET_PATH = os.environ.get("OPENCLAW_DOCKER_SOCKET", "")

def fail(msg: str):
    print(f"错误：{msg}", file=sys.stderr)
    sys.exit(1)

def require_cmd(cmd: str):
    if shutil.which(cmd) is None:
        fail(f"缺少依赖：{cmd}")

def is_truthy_value(val: str) -> bool:
    if not val:
        return False
    return str(val).lower() in ("1", "true", "yes", "on")

def contains_disallowed_chars(val: str) -> bool:
    return any(c in val for c in ("\n", "\r", "\t"))

def validate_mount_path_value(label: str, val: str):
    if not val:
        fail(f"{label} 不能为空。")
    if contains_disallowed_chars(val):
        fail(f"{label} 包含不支持的控制字符。")
    if re.search(r"\s", val):
        fail(f"{label} 不能包含空格。")

def validate_named_volume(val: str):
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$", val):
        fail("使用命名卷时，OPENCLAW_HOME_VOLUME 必须匹配 [A-Za-z0-9][A-Za-z0-9_.-]*。")

def validate_mount_spec(mount: str):
    if contains_disallowed_chars(mount):
        fail("OPENCLAW_EXTRA_MOUNTS 条目不能包含控制字符。")
    if not re.match(r"^[^ \t,:]+:[^ \t,:]+(:[^ \t,:]+)?$", mount):
        fail(f"无效的挂载格式 '{mount}'。期望 source:target[:options] 且不含空格。")

def run_compose(compose_args: list, *cmd_args, capture=False, check=True):
    cmd = ["docker", "compose"] + compose_args + list(cmd_args)
    if capture:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if check and result.returncode != 0:
            fail(f"Command failed: {' '.join(cmd)}\n{result.stderr}")
        return result
    else:
        result = subprocess.run(cmd)
        if check and result.returncode != 0:
            sys.exit(result.returncode)
        return result

require_cmd("docker")
if subprocess.run(["docker", "compose", "version"], capture_output=True).returncode != 0:
    fail("Docker Compose 不可用（尝试：docker compose version）")

if not DOCKER_SOCKET_PATH:
    docker_host = os.environ.get("DOCKER_HOST", "")
    if docker_host.startswith("unix://"):
        DOCKER_SOCKET_PATH = docker_host[7:]
    else:
        DOCKER_SOCKET_PATH = "/var/run/docker.sock"

SANDBOX_ENABLED = "1" if is_truthy_value(RAW_SANDBOX_SETTING) else ""

OPENCLAW_CONFIG_DIR = os.environ.get("OPENCLAW_CONFIG_DIR", str(Path.home() / ".openclaw"))
OPENCLAW_WORKSPACE_DIR = os.environ.get("OPENCLAW_WORKSPACE_DIR", str(Path.home() / ".openclaw" / "workspace"))

validate_mount_path_value("OPENCLAW_CONFIG_DIR", OPENCLAW_CONFIG_DIR)
validate_mount_path_value("OPENCLAW_WORKSPACE_DIR", OPENCLAW_WORKSPACE_DIR)

if HOME_VOLUME_NAME:
    if "/" in HOME_VOLUME_NAME:
        validate_mount_path_value("OPENCLAW_HOME_VOLUME", HOME_VOLUME_NAME)
    else:
        validate_named_volume(HOME_VOLUME_NAME)

if contains_disallowed_chars(EXTRA_MOUNTS):
    fail("OPENCLAW_EXTRA_MOUNTS 不能包含控制字符。")

if SANDBOX_ENABLED:
    validate_mount_path_value("OPENCLAW_DOCKER_SOCKET", DOCKER_SOCKET_PATH)

# 创建目录结构
paths_to_create = [
    OPENCLAW_CONFIG_DIR,
    OPENCLAW_WORKSPACE_DIR,
    os.path.join(OPENCLAW_CONFIG_DIR, "identity"),
    os.path.join(OPENCLAW_CONFIG_DIR, "agents", "main", "agent"),
    os.path.join(OPENCLAW_CONFIG_DIR, "agents", "main", "sessions")
]
for p in paths_to_create:
    Path(p).mkdir(parents=True, exist_ok=True)

# 更新环境变量
os.environ["OPENCLAW_CONFIG_DIR"] = OPENCLAW_CONFIG_DIR
os.environ["OPENCLAW_WORKSPACE_DIR"] = OPENCLAW_WORKSPACE_DIR
os.environ["OPENCLAW_SANDBOX"] = SANDBOX_ENABLED
os.environ["OPENCLAW_DOCKER_SOCKET"] = DOCKER_SOCKET_PATH

DOCKER_GID = ""
if SANDBOX_ENABLED and os.path.exists(DOCKER_SOCKET_PATH):
    try:
        DOCKER_GID = str(os.stat(DOCKER_SOCKET_PATH).st_gid)
    except Exception:
        pass
os.environ["DOCKER_GID"] = DOCKER_GID

# ==========================================
# Token 处理逻辑
# ==========================================
OPENCLAW_GATEWAY_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")

def get_config_token():
    cfg_path = Path(OPENCLAW_CONFIG_DIR) / "openclaw.json"
    if cfg_path.is_file():
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                token = cfg.get("gateway", {}).get("auth", {}).get("token")
                if isinstance(token, str) and token.strip():
                    return token.strip()
        except Exception:
            pass
    return None

def get_env_token():
    if ENV_FILE.is_file():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("OPENCLAW_GATEWAY_TOKEN="):
                    return line.strip().split("=", 1)[1]
    return None

if not OPENCLAW_GATEWAY_TOKEN:
    config_token = get_config_token()
    if config_token:
        OPENCLAW_GATEWAY_TOKEN = config_token
        print(f"Reusing gateway token from {OPENCLAW_CONFIG_DIR}/openclaw.json")
    else:
        env_token = get_env_token()
        if env_token:
            OPENCLAW_GATEWAY_TOKEN = env_token
            print(f"Reusing gateway token from {ENV_FILE}")
        else:
            OPENCLAW_GATEWAY_TOKEN = secrets.token_hex(32)

os.environ["OPENCLAW_GATEWAY_TOKEN"] = OPENCLAW_GATEWAY_TOKEN
OPENCLAW_GATEWAY_BIND = os.environ.get("OPENCLAW_GATEWAY_BIND", "lan")

# ==========================================
# 动态 Compose 文件生成
# ==========================================
compose_files = [COMPOSE_FILE]

def write_extra_compose(home_vol: str, mounts: list):
    lines = ["services:", "  openclaw-gateway:", "    volumes:"]
    
    gw_home_mount = gw_config_mount = gw_workspace_mount = ""
    if home_vol:
        gw_home_mount = f"{home_vol}:/root"
        gw_config_mount = f"{OPENCLAW_CONFIG_DIR}:/root/.openclaw"
        gw_workspace_mount = f"{OPENCLAW_WORKSPACE_DIR}:/root/.openclaw/workspace"
        for m in [gw_home_mount, gw_config_mount, gw_workspace_mount]:
            validate_mount_spec(m)
            lines.append(f"      - {m}")
    
    for m in mounts:
        validate_mount_spec(m)
        lines.append(f"      - {m}")

    lines.extend(["  openclaw-cli:", "    volumes:"])
    if home_vol:
        for m in [gw_home_mount, gw_config_mount, gw_workspace_mount]:
            lines.append(f"      - {m}")
    for m in mounts:
        lines.append(f"      - {m}")
        
    if home_vol and "/" not in home_vol:
        validate_named_volume(home_vol)
        lines.extend(["volumes:", f"  {home_vol}:"])

    with open(EXTRA_COMPOSE_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

if SANDBOX_ENABLED:
    if not os.environ.get("OPENCLAW_INSTALL_DOCKER_CLI"):
        os.environ["OPENCLAW_INSTALL_DOCKER_CLI"] = "1"

valid_mounts = [m.strip() for m in EXTRA_MOUNTS.split(",")] if EXTRA_MOUNTS else []
valid_mounts = [m for m in valid_mounts if m]

if HOME_VOLUME_NAME or valid_mounts:
    write_extra_compose(HOME_VOLUME_NAME, valid_mounts)
    compose_files.append(EXTRA_COMPOSE_FILE)

compose_args = []
for cf in compose_files:
    compose_args.extend(["-f", str(cf)])

base_compose_args = list(compose_args)
compose_hint = "docker compose " + " ".join(compose_args)

# ==========================================
# 更新环境变量文件
# ==========================================
def upsert_env(file_path: Path, keys: list):
    existing_lines = []
    seen = set()
    if file_path.is_file():
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                key_match = line.split("=")[0].strip() if "=" in line else None
                if key_match in keys:
                    existing_lines.append(f"{key_match}={os.environ.get(key_match, '')}\n")
                    seen.add(key_match)
                else:
                    existing_lines.append(line)
                    
    for k in keys:
        if k not in seen:
            existing_lines.append(f"{k}={os.environ.get(k, '')}\n")
            
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(existing_lines)

upsert_env(ENV_FILE, [
    "OPENCLAW_CONFIG_DIR",
    "OPENCLAW_WORKSPACE_DIR",
    "OPENCLAW_GATEWAY_TOKEN",
    "OPENCLAW_SANDBOX",
    "OPENCLAW_DOCKER_SOCKET",
    "DOCKER_GID",
    "OPENCLAW_INSTALL_DOCKER_CLI"
])

if IMAGE_NAME:
    print(f"==> 构建 Docker 镜像：{IMAGE_NAME}")
    #corss build support for amd64 on x86_64
    if os.environ.get("DOCKER_BUILDX_AMD64") == "1":
        build_cmd = ["docker", "buildx", "build"]
        for arg in ["OPENCLAW_DOCKER_APT_PACKAGES", "OPENCLAW_EXTENSIONS", "OPENCLAW_INSTALL_DOCKER_CLI", "OPENCLAW_INSTALL_BROWSER"]:
            if os.environ.get(arg):
                build_cmd.extend(["--build-arg", f"{arg}={os.environ[arg]}"])
        build_cmd.extend(["--platform", "linux/amd64", "-t", "openclaw:amd64-latest", "-f", str(ROOT_DIR / "Dockerfile"), str(ROOT_DIR)])
        subprocess.run(build_cmd, check=True)
    else:
        build_cmd = ["docker", "build"]
        for arg in ["OPENCLAW_DOCKER_APT_PACKAGES", "OPENCLAW_EXTENSIONS", "OPENCLAW_INSTALL_DOCKER_CLI", "OPENCLAW_INSTALL_BROWSER"]:
            if os.environ.get(arg):
                build_cmd.extend(["--build-arg", f"{arg}={os.environ[arg]}"])
        build_cmd.extend(["-t", IMAGE_NAME, "-f", str(ROOT_DIR / "Dockerfile"), str(ROOT_DIR)])
        subprocess.run(build_cmd, check=True)

# print("\n==> 修复数据目录权限")
# chown_script = (
#     "find /home/node/.openclaw -xdev -exec chown node:node {} +; "
#     "[ -d /home/node/.openclaw/workspace/.openclaw ] && chown -R node:node /home/node/.openclaw/workspace/.openclaw || true"
# )
# run_compose(compose_args, "run", "--rm", "--user", "root", "--entrypoint", "sh", "openclaw-cli", "-c", chown_script)
# run_compose(compose_args, "run", "--rm", "openclaw-cli", "onboard", "--mode", "local", "--no-install-daemon")
print("\n==> 启动网关")
run_compose(compose_args, "up", "-d", "openclaw-gateway")

# ==========================================
# 沙盒浏览器
# ==========================================
OPENCLAW_BROWSER_IMAGE = os.environ.get("OPENCLAW_BROWSER_IMAGE")
if OPENCLAW_BROWSER_IMAGE:
    build_cmd = ["docker", "build"]
    subprocess.run([*build_cmd, "-f", "Dockerfile.sandbox-browser", "-t", OPENCLAW_BROWSER_IMAGE, "."], check=True)
    print("\n==> 启动沙盒浏览器")
    run_compose(compose_args, "-f", "docker-compose-browser.yml", "up", "-d", "openclaw-browser")
    port = os.environ.get("OPENCLAW_BROWSER_CDP_PORT", "9222")
    # run_compose(compose_args, "run", "--rm", "openclaw-cli", "config", "set", "browser.cdpUrl", f"ws://192.168.97.2:{port}", check=False)
    run_compose(compose_args, "run", "--rm", "openclaw-cli", "config", "set", "browser.attachOnly", "true", check=False)
