#!/bin/bash
set -euo pipefail

CFG_DIR="${OPENCLAW_HOME:-/home/node}/.openclaw"
INITIALIZED_FLAG="${OPENCLAW_HOME:-/home/node}/.openclaw/.initialized"
RESTART_COUNT=0
GATEWAY_PID=""

start_gateway() {
    echo "[INFO] 启动 OpenClaw Gateway..."
    # chown -R node:node "${OPENCLAW_HOME:-/home/node}"
    # runuser -u node -- node dist/index.js gateway \
    #     --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
    #     --port 18789 &
    node dist/index.js gateway \
        --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
        --port 18789 &
    GATEWAY_PID=$!

    echo "[INFO] 等待网关健康检查..."
    for i in {1..300}; do
        if curl -sf http://127.0.0.1:18789/healthz >/dev/null 2>&1; then
            echo "[INFO] 网关已就绪（${i}s)"
            return 0
        fi
        sleep 1
    done
    echo "[ERROR] 网关未就绪"
    kill "${GATEWAY_PID}" 2>/dev/null || true
    exit 1
}

echo "[INFO] 配置 SSH 服务..."
if [ -n "$SSH_ROOT_PASSWORD" ]; then
    echo "root:${SSH_ROOT_PASSWORD}" | chpasswd
fi

/usr/sbin/sshd \
    && echo "[INFO] SSH 服务已启动（端口 22)" \
    || echo "[WARN] SSH 服务启动失败"

if [ ! -f "$INITIALIZED_FLAG" ]; then
    echo "[INFO] 首次启动，开始执行初始化配置..."
    mkdir -p "${CFG_DIR}/extensions"
    # cp /app/openclaw.json "${CFG_DIR}/openclaw.json"
    envsubst < "/app/cfg.templates.json" > "${CFG_DIR}/openclaw.json"
    mkdir -p "${CFG_DIR}/agents/main/agent"
    mkdir -p "${CFG_DIR}/agents/main/sessions"
    mkdir -p "${CFG_DIR}/identity"
    echo "[INFO] 修复文件权限..."
    # chown -R node:node "${OPENCLAW_HOME:-/home/node}"
    echo "0" > "$INITIALIZED_FLAG"
    echo "[INFO] 初始化完成，已创建标记文件。"
    # npx -y @tencent-weixin/openclaw-weixin-cli install > "${CFG_DIR}/weixin-cli-install.log" 2>&1 &
fi

RESTART_COUNT=$(cat "$INITIALIZED_FLAG" 2>/dev/null || echo "0")
NEW_COUNT=$((RESTART_COUNT + 1))
echo "$NEW_COUNT" > "$INITIALIZED_FLAG"
echo "[INFO] 启动网关（重启次数: $NEW_COUNT）"
start_gateway
echo "[INFO] 网关运行中，等待进程结束..."
wait "${GATEWAY_PID}"
