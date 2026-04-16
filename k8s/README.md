# OpenClaw Kubernetes 部署

这个目录包含将 OpenClaw 部署到 Kubernetes 集群的模板和脚本。

## 目录结构

```
k8s/
├── Makefile                  # 部署管理 Makefile
├── deployment.yaml           # 主部署配置 (Namespace, Deployment, Service, PVC)
├── cli-pod.yaml              # CLI Pod 配置
├── .env                      # 环境变量配置文件
├── Dockerfile                # Docker 镜像构建文件
├── docker-compose-ssy.yml    # Docker Compose 配置 (参考)
└── docker-setup.py           # Docker 安装脚本 (参考)
```

## 快速开始

### 1. 准备环境

确保你有以下工具:
- `kubectl` 配置好并连接到你的 Kubernetes 集群
- `docker` (用于构建镜像)
- `make` (可选，用于简化命令)

### 2. 配置环境变量

编辑 `.env` 文件，设置必要的配置:

```bash
# Gateway 配置
OPENCLAW_GATEWAY_TOKEN=<自动生成或手动设置>
OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace

# API Keys (可选)
SHENGSUANYUN_API_KEY=your_api_key_here
CLAUDE_AI_SESSION_KEY=
CLAUDE_WEB_SESSION_KEY=
CLAUDE_WEB_COOKIE=

# 镜像配置
OPENCLAW_IMAGE=openclaw:2026.4.14
REGISTRY=  # 如果要推送到镜像仓库，填写仓库地址

# 其他配置
OPENCLAW_TIMEZONE=Asia/Shanghai
SSH_ROOT_PASSWORD=your_password
```

### 3. 构建镜像

```bash
# 使用 Makefile
make build

# 或者直接使用 Docker
docker build -t openclaw:latest -f Dockerfile ..
```

### 4. 部署到 Kubernetes

```bash
# 一键部署 (会自动初始化 Secrets 并部署)
make deploy

# 或者分步执行
make init-secrets  # 初始化 Secrets
kubectl apply -f deployment.yaml
```

### 5. 验证部署

```bash
# 查看状态
make status

# 查看日志
make logs
```

## Makefile 命令

### 基础操作

```bash
make help           # 显示所有可用命令
make build          # 构建 Docker 镜像
make deploy         # 部署到 Kubernetes
make undeploy       # 删除部署 (保留数据)
make clean          # 完全清理 (包括数据)
make restart        # 重启 Gateway
```

### 日志和状态

```bash
make logs           # 实时查看 Gateway 日志
make logs-tail      # 查看最近的日志
make status         # 查看部署状态
make events         # 查看命名空间事件
make describe-gateway  # 查看 Gateway Pod 详情
```

### CLI 操作

```bash
make cli            # 启动交互式 CLI Pod
make cli-run CMD="openclaw config get"  # 运行指定命令
make config CMD="get gateway.mode"      # 运行配置命令
make shell          # 在 Gateway Pod 中打开 shell
```

### Secret 管理

```bash
make init-secrets   # 从 .env 初始化 Secrets
make update-secrets # 更新 Secrets
```

### 高级操作

```bash
make port-forward   # 端口转发到本地
make backup-config  # 备份配置到本地
make restore-config # 从本地恢复配置
make update-image   # 更新镜像并重新部署
make debug          # 显示调试信息
```

## 配置说明

### Namespace
默认使用 `openclaw` 命名空间。所有资源都部署在这个命名空间中。

### ConfigMap
`openclaw-config` ConfigMap 包含非敏感配置:
- 时区 (TZ)
- 环境变量 (HOME, TERM)
- Gateway 绑定模式
- 浏览器设置

### Secret
`openclaw-secrets` Secret 包含敏感信息:
- Gateway Token (自动生成或从 .env 读取)
- API Keys
- SSH 凭证

### PersistentVolumeClaim
- `openclaw-config-pvc`: 存储配置文件 (10Gi)
- `openclaw-workspace-pvc`: 存储工作空间 (50Gi)

**注意**: 根据你的集群配置，可能需要在 `deployment.yaml` 中设置 `storageClassName`。

### Service
`openclaw-gateway-service` 暴露以下端口:
- `30789`: Gateway (HTTP API)
- `30790`: Bridge (WebSocket)
- `30722`: SSH

类型为 `NodePort`，可以根据需求改为 `LoadBalancer` 或 `ClusterIP`。

## 使用示例

### 1. 查看配置

```bash
# 启动 CLI Pod
make cli

# 在 Pod 中运行
node dist/index.js config get
```

### 2. 更新 API Key

```bash
# 编辑 .env 文件
vim .env

# 更新 Secret
make update-secrets

# 重启 Gateway
make restart
```

### 3. 端口转发到本地

```bash
# 启动端口转发
make port-forward

# 在另一个终端访问
curl http://localhost:18789/healthz
```

### 4. 备份和恢复

```bash
# 备份当前配置
make backup-config

# 恢复配置 (会重启 Gateway)
make restore-config
```

## Docker Compose 迁移

如果你之前使用 `docker-compose-ssy.yml` 和 `docker-setup.py`，主要变化:

1. **卷挂载**: Docker 卷 → PersistentVolumeClaim
2. **环境变量**: `.env` + compose → ConfigMap + Secret
3. **网络**: Docker 网络 → Kubernetes Service
4. **管理**: `docker compose` 命令 → `make` / `kubectl` 命令

## 故障排查

### Pod 无法启动

```bash
# 查看 Pod 事件
make describe-gateway

# 查看日志
make logs-tail
```

### PVC 无法绑定

检查你的集群是否有可用的 StorageClass:

```bash
kubectl get storageclass
```

在 `deployment.yaml` 中指定 `storageClassName`。

### Secret 未设置

```bash
# 查看当前 Secret
kubectl get secret openclaw-secrets -n openclaw -o yaml

# 重新初始化
make init-secrets
```

### 无法访问 Gateway

```bash
# 检查 Service
kubectl get svc -n openclaw

# 查看端口转发
make port-forward

# 在本地测试
curl http://localhost:18789/healthz
```

## 生产环境建议

1. **使用镜像仓库**: 将镜像推送到私有仓库，而不是在每个节点构建
   ```bash
   export REGISTRY=your-registry.com/openclaw
   make build  # 会自动推送
   ```

2. **配置资源限制**: 在 `deployment.yaml` 中调整 `resources` 配置

3. **使用 Ingress**: 替代 NodePort，使用 Ingress 控制器暴露服务

4. **启用 TLS**: 为 Gateway 和 Bridge 配置 TLS 证书

5. **配置备份策略**: 定期备份 PVC 数据

6. **监控和日志**: 集成 Prometheus + Grafana 进行监控

## 参考

- [OpenClaw 文档](../docs/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [Docker 构建文档](https://docs.docker.com/engine/reference/builder/)
