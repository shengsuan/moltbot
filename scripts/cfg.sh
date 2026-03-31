#!/bin/bash
set -e

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

node dist/index.js config set auth.profiles '{"shengsuanyun:default":{"provider":"shengsuanyun","mode":"api_key"}}'
# node dist/index.js onboard --non-interactive --accept-risk --auth-choice shengsuanyun-api-key --shengsuanyun-api-key "${SHENGSUANYUN_API_KEY}"
# node dist/index.js config set agents '{"defaults": {"model": {"primary": "shengsuanyun/anthropic/claude-haiku-4.5"},"workspace": "/home/node/.openclaw/workspace","compaction": {"mode": "safeguard"}}}'
node dist/index.js config set auth.cooldowns.failureWindowHours 0.03
node dist/index.js config set gateway.auth.token "${OPENCLAW_GATEWAY_TOKEN}"
node dist/index.js config set gateway.controlUi.dangerouslyDisableDeviceAuth true
node dist/index.js config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
node dist/index.js config set browser.enabled true
node dist/index.js config set browser.evaluateEnabled true
node dist/index.js config set browser.headless true
node dist/index.js config set browser.noSandbox true
node dist/index.js config set browser.attachOnly true
node dist/index.js config set browser.cdpUrl 'ws://${OPENCLAW_BROWSER_CDP_HOST:-localhost}:${OPENCLAW_BROWSER_CDP_PORT:-9222}'
node dist/index.js config set tools.sessions.visibility 'all'
node dist/index.js config set tools.profile 'full'
node dist/index.js config set tools.exec.security 'full'
node dist/index.js config set tools.elevated.enabled true
node dist/index.js config set tools.elevated.allowFrom.webchat '["*"]'
node dist/index.js config set tools.elevated.allowFrom.direct '["*"]'
# node dist/index.js config set tools.alsoAllow '["wecom_mcp","qqbot_channel_api","qqbot_remind","openai_gpt_image_1_5","bytedance_doubao_seedream_5_0_lite","ali_qwen_image_plus","google_gemini_3_1_flash_image_preview","ali_z_image_turbo","ali_wan2_6_i2v","bytedance_doubao_seedream_4_0","openai_sora2","google_gemini_3_pro_image_preview","google_veo3_1_fast_preview","google_veo3_1_preview","bytedance_doubao_seedream_4_5","black_forest_labs_flux_1_1_pro_ultra","openai_gpt_image_1","google_veo3","bytedance_jimeng_i2v_first_v30","bytedance_doubao_seedance_1_0_lite_t2v","ali_wan2_2_animate_mix","ali_wan2_2_t2v_plus","ali_wan2_2_i2v_plus","kling_kling_v2_5_turbo","ali_wan2_5_i2i_preview","bytedance_doubao_seedance_1_0_lite_i2v","ali_wan2_5_t2v_preview","ali_wan2_2_i2v_flash","black_forest_labs_flux_kontext_pro","openai_sora","kling_kling_v2_1","kling_kling_v2_1_master","ali_wan2_5_t2i_preview","ali_wan2_5_i2v_preview","vidu_vidu2_0","black_forest_labs_flux_kontext_dev","black_forest_labs_flux_kontext_max","google_gemini_2_5_flash_image","ali_wan2_2_s2v","ali_wan2_2_kf2v_flash","ali_wan2_2_animate_move","ali_wan_2_2_t2v_fast_lora","ali_wan_2_2_i2v_fast_lora","black_forest_labs_flux_1_1_pro_ultra_finetuned","bytedance_jimeng_v40","black_forest_labs_flux_1_1_pro","black_forest_labs_flux_kontext_dev_lora","black_forest_labs_flux_dev_lora","ali_wan_2_2_t2i_lora","bytedance_jimeng_i2i_v30","bytedance_jimeng_i2v_first_v30_1080","bytedance_jimeng_t2i_v30","bytedance_jimeng_t2i_v31","openai_gpt_image_1_mini","bytedance_doubao_seedream_3_0_t2i","bytedance_doubao_seededit_3_0_i2i","vidu_viduq3_pro","ali_qwen_image_edit_plus","bytedance_jimeng_i2v_first_tail_v30","minimax_s2v_01","minimax_i2v_01_live","kling_kling_v2","bytedance_jimeng_i2v_recamera_v30","minimax_i2v_01_director","bytedance_jimeng_t2v_v30_1080p","bytedance_doubao_seedance_1_0_pro","google_gemini_2_5_flash_image_preview","minimax_t2v_01_director","kling_lipsync","bytedance_jimeng_t2v_v30","bytedance_jimeng_ti2v_v30_pro","kling_kling_v1_6","vidu_vidu1_5","vidu_viduq2_turbo","vidu_viduq1","vidu_viduq1_image","runway_eleven_text_to_sound_v2","runway_eleven_multilingual_v2","bytedance_image_enhance","bytedance_image_upscale","runway_gen4_turbo","runway_gen3a_turbo","openai_whisper","ali_paraformer_v2","runway_gen4_aleph","tencent_hunyuan_3d_pro","tencent_hunyuan_3d_uv","bytedance_doubao_seed3d","tencent_hunyuan_3d_reduce_face","tencent_hunyuan_3d_part","tencent_hunyuan_3d_rapid","tencent_hunyuan_3d_texture"]'
node dist/index.js config set tools.alsoAllow '["wecom_mcp","qqbot_channel_api","qqbot_remind"]'
node dist/index.js config set plugins.allow '["shengsuanyun","wecom-openclaw-plugin","openclaw-weixin","openclaw-qqbot"]'
node dist/index.js config set plugins.entries.shengsuanyun.enabled true
node dist/index.js config set plugins.entries.wecom-openclaw-plugin.enabled true
node dist/index.js config set plugins.entries.openclaw-weixin.enabled true
node dist/index.js config set plugins.entries.openclaw-qqbot.enabled true
node dist/index.js config set channels '{"openclaw-weixin": {"accounts": {}},"qqbot": {"enabled": true,"allowFrom": ["*"],"appId": "1903681724","clientSecret": "oZ8TbXFk15vXv51i"}}'
# node dist/index.js config set channels '{"openclaw-weixin": {"accounts": {}},"wecom": {"enabled": true,"botId": "aib-jqQBaC681e9nmdAXNEWPVf0uqAq8zWL","secret": "Un9xdaeNFq5AgNJcTprq3s3ILw6vESGf8iVmRC4Yvnk"},"qqbot": {"enabled": true,"allowFrom": ["*"],"appId": "1903681724","clientSecret": "oZ8TbXFk15vXv51i"}}'
# node dist/index.js channels add --channel qqbot --token "1903681724:oZ8TbXFk15vXv51i"
# node dist/index.js channels login --channel openclaw-weixin
node dist/index.js config set bindings '[{"agentId": "main","match": {"channel": "wecom","accountId": "default"}}]'
node dist/index.js config set agents.defaults.model '{"primary": "shengsuanyun/anthropic/claude-haiku-4.5"}'
node dist/index.js config set agents.defaults.models '{"shengsuanyun/anthropic/claude-sonnet-4.5": {},"shengsuanyun/anthropic/claude-haiku-4.5:thinking": {},"shengsuanyun/anthropic/claude-opus-4.5": {},"shengsuanyun/anthropic/claude-opus-4.6": {},"shengsuanyun/anthropic/claude-sonnet-4": {},"shengsuanyun/anthropic/claude-sonnet-4.5:thinking": {},"shengsuanyun/anthropic/claude-sonnet-4:thinking": {},"shengsuanyun/google/gemini-2.5-flash": {},"shengsuanyun/google/gemini-2.5-pro": {},"shengsuanyun/google/gemini-3-flash": {},"shengsuanyun/google/gemini-3-pro-preview": {},"shengsuanyun/google/gemini-3.1-flash-image-preview": {},"shengsuanyun/google/gemini-3.1-flash-lite-preview": {},"shengsuanyun/google/gemini-3.1-pro-preview": {},"shengsuanyun/openai/gpt-4.1-nano": {},"shengsuanyun/openai/gpt-5": {},"shengsuanyun/openai/gpt-5-nano": {},"shengsuanyun/openai/gpt-5.1": {},"shengsuanyun/x-ai/grok-4-fast": {}}'

# Keep the container running by waiting for the gateway process
wait $GATEWAY_PID
