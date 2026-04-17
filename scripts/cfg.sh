#!/bin/bash
# OpenClaw 网关容器入口配置脚本
set -euo pipefail

INITIALIZED_FLAG="${OPENCLAW_HOME:-/home/node}/.openclaw/.initialized"
RESTART_COUNT=0
if [ -f "$INITIALIZED_FLAG" ]; then
    RESTART_COUNT=$(cat "$INITIALIZED_FLAG")
    echo "[INFO] 检测到标记文件。当前已重启次数: $RESTART_COUNT"
    NEW_COUNT=$((RESTART_COUNT + 1))
    echo "$NEW_COUNT" > "$INITIALIZED_FLAG"
    exit 0
fi

CFG_DIR="${OPENCLAW_HOME:-/home/node}/.openclaw"
mkdir -p "${CFG_DIR}/extensions"

TEMPLATE_FILE="/app/cfg.templates.json"
if [ -f "${TEMPLATE_FILE}" ]; then
    if [ ! -f "${CFG_DIR}/openclaw.json" ]; then
        envsubst < "${TEMPLATE_FILE}" > "${CFG_DIR}/openclaw.json"
        echo "[INFO] 配置文件已初始化：${CFG_DIR}/openclaw.json"
    else
        echo "[INFO] 配置文件已存在，跳过生成步骤以防止覆盖运行中状态"
    fi
fi

if [ "$(id -u)" = "0" ] && { [ -n "${SSH_ROOT_PASSWORD:-}" ] || [ -n "${SSH_AUTHORIZED_KEYS:-}" ]; }; then
    echo "[INFO] 配置 SSH 服务..."
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        ssh-keygen -A || echo "[WARN] 生成 SSH host key 失败"
    fi

    if [ -n "${SSH_ROOT_PASSWORD:-}" ]; then
        echo "root:${SSH_ROOT_PASSWORD}" | chpasswd 2>/dev/null \
            || echo "[WARN] 设置 root 密码失败，将仅使用密钥认证"
    fi

    if [ -n "${SSH_AUTHORIZED_KEYS:-}" ]; then
        mkdir -p /root/.ssh
        printf '%s\n' "${SSH_AUTHORIZED_KEYS}" > /root/.ssh/authorized_keys
        chmod 700 /root/.ssh
        chmod 600 /root/.ssh/authorized_keys
        echo "[INFO] SSH 公钥认证已配置"
    fi

    /usr/sbin/sshd \
        -p 22 \
        -o "PermitRootLogin=yes" \
        -o "UsePAM=no" \
        -o "PasswordAuthentication=$([ -n "${SSH_ROOT_PASSWORD:-}" ] && echo yes || echo no)" \
        -o "PubkeyAuthentication=$([ -n "${SSH_AUTHORIZED_KEYS:-}" ] && echo yes || echo no)" \
        && echo "[INFO] SSH 服务已启动（端口 22）" \
        || echo "[WARN] SSH 服务启动失败"
fi

if [ -d "/app/plugins" ]; then
    shopt -s nullglob
    tarballs=(/app/plugins/*.tar.gz)
    shopt -u nullglob
    if [ "${#tarballs[@]}" -gt 0 ]; then
        echo "[INFO] 正在解压插件至 ${CFG_DIR}/extensions/ ..."
        for tarball in "${tarballs[@]}"; do
            echo "  → $(basename "${tarball}")"
            if tar -xzf "${tarball}" -C "${CFG_DIR}/extensions/" 2>&1; then
                echo "    ✓ 解压成功"
            else
                echo "    ✗ 解压失败：${tarball}" >&2
            fi
        done
        echo "[INFO] 已安装插件："
        ls -la "${CFG_DIR}/extensions/" 2>/dev/null || echo "  （无插件）"
    fi
fi

chown -R node:node "${OPENCLAW_HOME:-/home/node}"
echo "[INFO] 启动 OpenClaw Gateway..."
runuser -u node -- node dist/index.js gateway \
    --allow-unconfigured \
    --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
    --port 18789 &
GATEWAY_PID=$!

MAX_WAIT=60
COUNTER=0
echo "[INFO] 等待网关健康检查..."
until curl -sf http://127.0.0.1:18789/healthz > /dev/null 2>&1; do
    if [ "${COUNTER}" -ge "${MAX_WAIT}" ]; then
        echo "[ERROR] 网关在 ${MAX_WAIT}s 内未就绪，退出。" >&2
        kill "${GATEWAY_PID}" 2>/dev/null || true
        exit 1
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done
echo "[INFO] 网关已就绪（${COUNTER}s）"
runuser -u node -- node dist/index.js onboard \
    --non-interactive \
    --accept-risk \
    --auth-choice shengsuanyun-api-key \
    --shengsuanyun-api-key "${SHENGSUANYUN_API_KEY}"

echo 0 > "$INITIALIZED_FLAG"
echo "[INFO] 初始化完成，已创建标记文件。"
wait "${GATEWAY_PID}"
