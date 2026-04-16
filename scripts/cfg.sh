#!/bin/bash
set -e

echo "Fixing permissions for /home/node/.openclaw..."
home_dir="/home/node"
cfg_dir="$home_dir/.openclaw"
mkdir -p "$cfg_dir/extensions"
chown -R node:node "$home_dir"

if [ -f cfg.templates.json ]; then
    envsubst < cfg.templates.json > "$cfg_dir/openclaw.json"
fi

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
        /usr/sbin/sshd \
        -o "PermitRootLogin=yes" \
        -o "UsePAM=no" \
        -o "PasswordAuthentication=$([ -n "$SSH_ROOT_PASSWORD" ] && echo "yes" || echo "no")" \
        -o "PubkeyAuthentication=$([ -n "$SSH_AUTHORIZED_KEYS" ] && echo "yes" || echo "no")" && echo "SSH server started on port 22" || echo "Warning: SSH server failed to start"
    fi
fi

if [ -d "/app/plugins" ] && [ -n "$(ls -A /app/plugins/*.tar.gz 2>/dev/null)" ]; then
    echo "Extracting plugins to .openclaw/extensions/..."
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
    echo "Installed plugins:"
    ls -la "${OPENCLAW_DIR}/extensions/" 2>/dev/null || echo "  (no plugins found)"
fi

node dist/index.js gateway --allow-unconfigured --bind "${OPENCLAW_GATEWAY_BIND:-lan}" --port 18789 &
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

node dist/index.js onboard --non-interactive --accept-risk --auth-choice shengsuanyun-api-key --shengsuanyun-api-key "${SHENGSUANYUN_API_KEY}"
wait $GATEWAY_PID
