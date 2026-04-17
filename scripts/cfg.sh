#!/bin/bash
set -euo pipefail

CFG_DIR="${OPENCLAW_HOME:-/home/node}/.openclaw"
INITIALIZED_FLAG="${OPENCLAW_HOME:-/home/node}/.openclaw/.initialized"
RESTART_COUNT=0
GATEWAY_PID=""

start_gateway() {
    echo "[INFO] 启动 OpenClaw Gateway..."
    chown -R node:node "${OPENCLAW_HOME:-/home/node}"

    runuser -u node -- node dist/index.js gateway \
        --allow-unconfigured \
        --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
        --port 18789 &
    GATEWAY_PID=$!

    echo "[INFO] 等待网关健康检查..."
    for i in {1..60}; do
        if curl -sf http://127.0.0.1:18789/healthz >/dev/null 2>&1; then
            echo "[INFO] 网关已就绪（${i}s）"
            return 0
        fi
        sleep 1
    done

    echo "[ERROR] 网关未就绪"
    kill "${GATEWAY_PID}" 2>/dev/null || true
    exit 1
}

if [ ! -f "$INITIALIZED_FLAG" ]; then
    echo "[INFO] 首次启动，开始执行初始化配置..."
    mkdir -p "${CFG_DIR}/extensions"

    # 1. 配置文件初始化
    TEMPLATE_FILE="/app/cfg.templates.json"
    if [ -f "${TEMPLATE_FILE}" ]; then
        if [ ! -f "${CFG_DIR}/openclaw.json" ]; then
            envsubst < "${TEMPLATE_FILE}" > "${CFG_DIR}/openclaw.json"
            echo "[INFO] 配置文件已初始化：${CFG_DIR}/openclaw.json"
        else
            echo "[INFO] 配置文件已存在，跳过生成步骤以防止覆盖运行中状态"
        fi
    fi

    # 2. 配置并启动 SSH 服务 (维护网关使用)
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

    # 3. 解压插件
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

    # 3.5. 确保目录存在并修复权限（在 onboard 之前）
    mkdir -p "${CFG_DIR}/agents/main/agent"
    mkdir -p "${CFG_DIR}/agents/main/sessions"
    mkdir -p "${CFG_DIR}/identity"
    echo "[INFO] 修复文件权限..."
    chown -R node:node "${OPENCLAW_HOME:-/home/node}"

    # 4. 启动网关（后台运行，不阻塞）
    start_gateway

    # 5. 执行 onboard（现在 gateway 已经运行）
    echo "[INFO] 运行 onboard 初始化..."
    runuser -u node -- node dist/index.js onboard \
        --non-interactive \
        --accept-risk \
        --auth-choice shengsuanyun-api-key \
        --shengsuanyun-api-key "${SHENGSUANYUN_API_KEY}"

    # 6. 写入初始化标记
    echo "0" > "$INITIALIZED_FLAG"
    echo "[INFO] 初始化完成，已创建标记文件。"

else
    # 非首次启动，仅更新重启计数并启动 gateway
    RESTART_COUNT=$(cat "$INITIALIZED_FLAG")
    NEW_COUNT=$((RESTART_COUNT + 1))
    echo "$NEW_COUNT" > "$INITIALIZED_FLAG"
    echo "[INFO] 检测到标记文件，跳过初始化。当前已重启次数: $NEW_COUNT"

    start_gateway
fi

# 统一在此处等待 gateway 进程结束，保持容器运行
echo "[INFO] 网关运行中，等待进程结束..."
wait "${GATEWAY_PID}"
