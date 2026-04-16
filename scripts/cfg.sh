#!/bin/bash
set -e

if [ "$(id -u)" = "0" ]; then
    if [ -n "$SSH_ROOT_PASSWORD" ] || [ -n "$SSH_AUTHORIZED_KEYS" ]; then
        echo "Configuring SSH server..."
        # Generate SSH host keys only if they don't exist
        if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
            ssh-keygen -A || echo "Warning: Failed to generate SSH host keys"
        fi
        if [ -n "$SSH_ROOT_PASSWORD" ]; then
            echo "root:$SSH_ROOT_PASSWORD" | chpasswd 2>/dev/null || echo "Warning: Failed to set root password, using SSH keys only"
        fi
        if [ -n "$SSH_AUTHORIZED_KEYS" ]; then
            mkdir -p /root/.ssh
            echo "$SSH_AUTHORIZED_KEYS" > /root/.ssh/authorized_keys
            chmod 700 /root/.ssh
            chmod 600 /root/.ssh/authorized_keys
            echo "SSH public key authentication configured"
        fi
        # Start SSH daemon
        /usr/sbin/sshd \
        -o "PermitRootLogin=yes" \
        -o "UsePAM=no" \
        -o "PasswordAuthentication=$([ -n "$SSH_ROOT_PASSWORD" ] && echo "yes" || echo "no")" \
        -o "PubkeyAuthentication=$([ -n "$SSH_AUTHORIZED_KEYS" ] && echo "yes" || echo "no")" && echo "SSH server started on port 22" || echo "Warning: SSH server failed to start"
    fi

    # echo "Fixing permissions for /home/node/.openclaw..."
    # mkdir -p /home/node/.openclaw/extensions
    # chown -R node:node /home/node
    # chmod -R 755 /home/node/.openclaw

    # export HOME=/home/node
    # export USER=node
    # exec su -p node -c "/bin/bash $0 $@"
fi

# Extract plugin tarballs to .openclaw/extensions/ directory before starting gateway
if [ -d "/app/plugins" ] && [ -n "$(ls -A /app/plugins/*.tar.gz 2>/dev/null)" ]; then
    echo "Extracting plugins to .openclaw/extensions/..."
    OPENCLAW_DIR="/root/.openclaw"
    mkdir -p "${OPENCLAW_DIR}/extensions"

    for tarball in /app/plugins/*.tar.gz; do
        if [ -f "$tarball" ]; then
            echo "  Extracting $(basename "$tarball")..."
            if tar -xzf "$tarball" -C "${OPENCLAW_DIR}/extensions/" 2>&1; then
                echo "    ✓ Extracted successfully"
            else
                echo "    ✗ Failed to extract $tarball" >&2
            fi
        fi
    done

    # Fix ownership to match the current user running the script
    chown -R "$(id -u):$(id -g)" "${OPENCLAW_DIR}/extensions/" 2>/dev/null || echo "Warning: Could not change ownership"
    echo "Installed plugins:"
    ls -la "${OPENCLAW_DIR}/extensions/" 2>/dev/null || echo "  (no plugins found)"
fi

GATEWAY_PID=$!
MAX_WAIT=60
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s http://127.0.0.1:18789/healthz > /dev/null 2>&1; then
        echo "Gateway is ready!"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -eq $MAX_WAIT ]; then
    exit 1
fi
wait $GATEWAY_PID

node dist/index.js config set auth.profiles '{"shengsuanyun:default":{"provider":"shengsuanyun","mode":"api_key"}}'
node dist/index.js onboard --non-interactive --accept-risk --auth-choice shengsuanyun-api-key --shengsuanyun-api-key "${SHENGSUANYUN_API_KEY}"
node dist/index.js config set auth.cooldowns.failureWindowHours 0.03
node dist/index.js config set gateway.auth.token "${OPENCLAW_GATEWAY_TOKEN}"
node dist/index.js config set gateway.controlUi.dangerouslyDisableDeviceAuth true
node dist/index.js config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
node dist/index.js config set gateway.controlUi.allowedOrigins '["http://localhost:18787","http://127.0.0.1:18788","http://100.64.0.1:18789"]'
node dist/index.js config set gateway.mode "local"
node dist/index.js config set gateway.bind ${OPENCLAW_GATEWAY_BIND:-lan}
node dist/index.js config set browser.enabled true
node dist/index.js config set browser.evaluateEnabled true
node dist/index.js config set browser.headless true
node dist/index.js config set browser.noSandbox true
node dist/index.js config set browser.attachOnly true
node dist/index.js config set browser.cdpUrl "ws://${OPENCLAW_BROWSER_CDP_HOST:-localhost}:${OPENCLAW_BROWSER_CDP_PORT:-9222}"
node dist/index.js config set tools.sessions.visibility 'all'
node dist/index.js config set tools.profile 'full'
node dist/index.js config set tools.exec.security 'full'
node dist/index.js config set tools.elevated.enabled true
node dist/index.js config set tools.elevated.allowFrom.webchat '["*"]'
node dist/index.js config set tools.elevated.allowFrom.direct '["*"]'
node dist/index.js config set tools.alsoAllow '["wecom_mcp","qqbot_channel_api","qqbot_remind"]'
node dist/index.js config set plugins.allow '["shengsuanyun","wecom-openclaw-plugin","openclaw-weixin","qqbot"]'
node dist/index.js config set plugins.entries.shengsuanyun.enabled true
node dist/index.js config set plugins.entries.wecom-openclaw-plugin.enabled true
node dist/index.js config set plugins.entries.openclaw-weixin.enabled true
node dist/index.js config set plugins.entries.qqbot.enabled true
node dist/index.js config set plugins.installs.wecom-openclaw-plugin.source "npm"
node dist/index.js config set plugins.installs.wecom-openclaw-plugin.spec "@wecom/wecom-openclaw-plugin@latest"
node dist/index.js config set plugins.installs.wecom-openclaw-plugin.installPath "/root/.openclaw/extensions/wecom-openclaw-plugin"
node dist/index.js config set plugins.installs.openclaw-weixin.source "npm"
node dist/index.js config set plugins.installs.openclaw-weixin.installPath "/root/.openclaw/extensions/openclaw-weixin"
node dist/index.js config set plugins.installs.openclaw-weixin.resolvedSpec "@tencent-weixin/openclaw-weixin@2.1.7"
node dist/index.js config set channels '{"openclaw-weixin": {"accounts": {}},"wecom": {"enabled": true,"botId": "aib-jqQBaC681e9nmdAXNEWPVf0uqAq8zWL","secret": "Un9xdaeNFq5AgNJcTprq3s3ILw6vESGf8iVmRC4Yvnk"},"qqbot": {"enabled": true,"allowFrom": ["*"],"appId": "1903681724","clientSecret": "oZ8TbXFk15vXv51i"}}'
# node dist/index.js channels add --channel qqbot --token "1903681724:oZ8TbXFk15vXv51i"
# node dist/index.js channels login --channel openclaw-weixin
# node dist/index.js config set bindings '[{"agentId": "main","match": {"channel": "wecom","accountId": "default"}}]'
node dist/index.js config set agents.defaults.model '{"primary": "shengsuanyun/anthropic/claude-haiku-4.5"}'
node dist/index.js config set agents.defaults.models '{"shengsuanyun/anthropic/claude-sonnet-4.5": {},"shengsuanyun/anthropic/claude-haiku-4.5:thinking": {},"shengsuanyun/anthropic/claude-opus-4.5": {},"shengsuanyun/anthropic/claude-opus-4.6": {},"shengsuanyun/anthropic/claude-sonnet-4": {},"shengsuanyun/anthropic/claude-sonnet-4.5:thinking": {},"shengsuanyun/anthropic/claude-sonnet-4:thinking": {},"shengsuanyun/google/gemini-2.5-flash": {},"shengsuanyun/google/gemini-2.5-pro": {},"shengsuanyun/google/gemini-3-flash": {},"shengsuanyun/google/gemini-3-pro-preview": {},"shengsuanyun/google/gemini-3.1-flash-image-preview": {},"shengsuanyun/google/gemini-3.1-flash-lite-preview": {},"shengsuanyun/google/gemini-3.1-pro-preview": {},"shengsuanyun/openai/gpt-4.1-nano": {},"shengsuanyun/openai/gpt-5": {},"shengsuanyun/openai/gpt-5-nano": {},"shengsuanyun/openai/gpt-5.1": {},"shengsuanyun/x-ai/grok-4-fast": {}}'
node dist/index.js config set agents.defaults.userTimezone "${OPENCLAW_TIMEZONE}"   
# node dist/index.js config set agents.defaults.contextTokens 348576
# Keep the container running by waiting for the gateway process
node dist/index.js gateway --allow-unconfigured --bind "${OPENCLAW_GATEWAY_BIND:-lan}" --port 18789 &
