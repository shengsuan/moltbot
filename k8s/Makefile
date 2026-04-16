.PHONY: help build deploy undeploy restart logs status cli config clean update-secrets update-image

# 默认配置
NAMESPACE := openclaw
IMAGE_NAME := openclaw:latest
REGISTRY ?=
BUILD_ARGS ?=

# 从 .env 文件加载环境变量（如果存在）
ifneq (,$(wildcard .env))
    include .env
    export
endif

# 如果设置了 REGISTRY，则使用完整镜像路径
ifdef REGISTRY
    FULL_IMAGE := $(REGISTRY)/$(IMAGE_NAME)
else
    FULL_IMAGE := $(IMAGE_NAME)
endif

help: ## 显示帮助信息
	@echo "OpenClaw Kubernetes 部署管理"
	@echo ""
	@echo "使用方法: make [target]"
	@echo ""
	@echo "可用目标:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

build: ## 构建 Docker 镜像
	@echo "==> 构建镜像: $(FULL_IMAGE)"
	@if [ -n "$(REGISTRY)" ]; then \
		echo "注意: 将推送到镜像仓库 $(REGISTRY)"; \
	fi
	docker build \
		$(if $(OPENCLAW_DOCKER_APT_PACKAGES),--build-arg OPENCLAW_DOCKER_APT_PACKAGES="$(OPENCLAW_DOCKER_APT_PACKAGES)",) \
		$(if $(OPENCLAW_EXTENSIONS),--build-arg OPENCLAW_EXTENSIONS="$(OPENCLAW_EXTENSIONS)",) \
		$(if $(OPENCLAW_INSTALL_DOCKER_CLI),--build-arg OPENCLAW_INSTALL_DOCKER_CLI="$(OPENCLAW_INSTALL_DOCKER_CLI)",) \
		$(if $(OPENCLAW_INSTALL_BROWSER),--build-arg OPENCLAW_INSTALL_BROWSER="$(OPENCLAW_INSTALL_BROWSER)",) \
		$(BUILD_ARGS) \
		-t $(FULL_IMAGE) \
		-f Dockerfile \
		..
	@if [ -n "$(REGISTRY)" ]; then \
		echo "==> 推送镜像到仓库"; \
		docker push $(FULL_IMAGE); \
	fi

init-secrets: ## 初始化并创建 Secret (从 .env 文件)
	@echo "==> 初始化 Secrets"
	@if [ ! -f .env ]; then \
		echo "错误: .env 文件不存在"; \
		exit 1; \
	fi
	@# 生成 gateway token 如果未设置
	@if [ -z "$$OPENCLAW_GATEWAY_TOKEN" ]; then \
		echo "生成新的 OPENCLAW_GATEWAY_TOKEN..."; \
		export OPENCLAW_GATEWAY_TOKEN=$$(openssl rand -hex 32); \
		echo "OPENCLAW_GATEWAY_TOKEN=$$OPENCLAW_GATEWAY_TOKEN" >> .env; \
	fi
	@# 创建或更新 Secret
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create secret generic openclaw-secrets -n $(NAMESPACE) \
		--from-literal=OPENCLAW_GATEWAY_TOKEN="$${OPENCLAW_GATEWAY_TOKEN:-}" \
		--from-literal=CLAUDE_AI_SESSION_KEY="$${CLAUDE_AI_SESSION_KEY:-}" \
		--from-literal=SHENGSUANYUN_API_KEY="$${SHENGSUANYUN_API_KEY:-}" \
		--from-literal=CLAUDE_WEB_SESSION_KEY="$${CLAUDE_WEB_SESSION_KEY:-}" \
		--from-literal=CLAUDE_WEB_COOKIE="$${CLAUDE_WEB_COOKIE:-}" \
		--from-literal=SSH_ROOT_PASSWORD="$${SSH_ROOT_PASSWORD:-}" \
		--from-literal=SSH_AUTHORIZED_KEYS="$${SSH_AUTHORIZED_KEYS:-}" \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "==> Secrets 已更新"

update-secrets: init-secrets ## 更新 Secret (从 .env 文件)

deploy: init-secrets ## 部署 OpenClaw 到 Kubernetes
	@echo "==> 部署 OpenClaw 到命名空间: $(NAMESPACE)"
	@# 更新 deployment.yaml 中的镜像名称
	@sed -i.bak "s|image: openclaw:latest|image: $(FULL_IMAGE)|g" deployment.yaml
	kubectl apply -f deployment.yaml
	@mv deployment.yaml.bak deployment.yaml 2>/dev/null || true
	@echo ""
	@echo "==> 部署完成！"
	@echo "等待 Pod 启动..."
	kubectl wait --for=condition=ready pod -l app=openclaw-gateway -n $(NAMESPACE) --timeout=120s || true
	@echo ""
	@$(MAKE) status

undeploy: ## 删除 OpenClaw 部署 (保留 PVC 和 Secret)
	@echo "==> 删除 OpenClaw 部署"
	kubectl delete deployment openclaw-gateway -n $(NAMESPACE) --ignore-not-found=true
	kubectl delete service openclaw-gateway-service -n $(NAMESPACE) --ignore-not-found=true
	kubectl delete pod openclaw-cli -n $(NAMESPACE) --ignore-not-found=true
	@echo "==> 部署已删除 (PVC 和 Secret 保留)"

clean: undeploy ## 完全清理 (包括 PVC 和 Secret)
	@echo "==> 警告: 这将删除所有数据！"
	@read -p "确认删除所有数据？[y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		kubectl delete namespace $(NAMESPACE); \
		echo "==> 命名空间 $(NAMESPACE) 已删除"; \
	else \
		echo "操作已取消"; \
	fi

restart: ## 重启 Gateway
	@echo "==> 重启 OpenClaw Gateway"
	kubectl rollout restart deployment/openclaw-gateway -n $(NAMESPACE)
	kubectl rollout status deployment/openclaw-gateway -n $(NAMESPACE)

logs: ## 查看 Gateway 日志
	@echo "==> OpenClaw Gateway 日志 (Ctrl+C 退出)"
	kubectl logs -f -l app=openclaw-gateway -n $(NAMESPACE)

logs-tail: ## 查看最近的 Gateway 日志
	kubectl logs --tail=100 -l app=openclaw-gateway -n $(NAMESPACE)

status: ## 查看部署状态
	@echo "==> OpenClaw 部署状态"
	@echo ""
	@echo "命名空间资源:"
	kubectl get all -n $(NAMESPACE)
	@echo ""
	@echo "PVC 状态:"
	kubectl get pvc -n $(NAMESPACE)
	@echo ""
	@echo "Pod 详情:"
	kubectl describe pod -l app=openclaw-gateway -n $(NAMESPACE) | grep -A 10 "^Conditions:" || true
	@echo ""
	@echo "Service 端点:"
	@kubectl get svc openclaw-gateway-service -n $(NAMESPACE) -o wide || true

cli: ## 启动交互式 CLI Pod
	@echo "==> 启动 OpenClaw CLI"
	@# 删除旧的 CLI pod（如果存在）
	@kubectl delete pod openclaw-cli -n $(NAMESPACE) --ignore-not-found=true 2>/dev/null || true
	@# 更新 cli-pod.yaml 中的镜像名称
	@sed -i.bak "s|image: openclaw:latest|image: $(FULL_IMAGE)|g" cli-pod.yaml
	kubectl apply -f cli-pod.yaml
	@mv cli-pod.yaml.bak cli-pod.yaml 2>/dev/null || true
	@echo "等待 CLI Pod 启动..."
	@kubectl wait --for=condition=ready pod/openclaw-cli -n $(NAMESPACE) --timeout=60s || true
	@echo ""
	@echo "进入 CLI Pod (输入 'exit' 退出):"
	@kubectl exec -it openclaw-cli -n $(NAMESPACE) -- bash

cli-run: ## 在 CLI Pod 中运行命令 (用法: make cli-run CMD="openclaw config get")
	@if [ -z "$(CMD)" ]; then \
		echo "错误: 请指定命令"; \
		echo "用法: make cli-run CMD=\"openclaw config get\""; \
		exit 1; \
	fi
	kubectl exec openclaw-cli -n $(NAMESPACE) -- $(CMD)

config: ## 在 CLI Pod 中运行配置命令 (用法: make config CMD="get gateway.mode")
	@if [ -z "$(CMD)" ]; then \
		echo "用法: make config CMD=\"get gateway.mode\""; \
		exit 1; \
	fi
	@$(MAKE) cli-run CMD="node dist/index.js config $(CMD)"

shell: ## 在 Gateway Pod 中打开 shell
	@echo "==> 进入 Gateway Pod (输入 'exit' 退出)"
	kubectl exec -it $$(kubectl get pod -l app=openclaw-gateway -n $(NAMESPACE) -o jsonpath='{.items[0].metadata.name}') -n $(NAMESPACE) -- bash

update-image: build deploy ## 更新镜像并重新部署

describe-gateway: ## 显示 Gateway Pod 详细信息
	kubectl describe pod -l app=openclaw-gateway -n $(NAMESPACE)

events: ## 查看命名空间事件
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp'

port-forward: ## 端口转发到本地 (Gateway: 18789, Bridge: 18790, SSH: 2222)
	@echo "==> 端口转发启动 (Ctrl+C 停止)"
	@echo "Gateway: http://localhost:18789"
	@echo "Bridge:  ws://localhost:18790"
	@echo "SSH:     localhost:2222"
	kubectl port-forward -n $(NAMESPACE) svc/openclaw-gateway-service 18789:18789 18790:18790 2222:22

debug: ## 显示调试信息
	@echo "==> 调试信息"
	@echo ""
	@echo "当前配置:"
	@echo "  NAMESPACE:   $(NAMESPACE)"
	@echo "  IMAGE_NAME:  $(IMAGE_NAME)"
	@echo "  FULL_IMAGE:  $(FULL_IMAGE)"
	@echo "  REGISTRY:    $(REGISTRY)"
	@echo ""
	@echo "环境变量 (.env):"
	@if [ -f .env ]; then \
		cat .env | grep -v "^#" | grep -v "^$$"; \
	else \
		echo "  .env 文件不存在"; \
	fi
	@echo ""
	@echo "当前 Secret 内容:"
	@kubectl get secret openclaw-secrets -n $(NAMESPACE) -o json 2>/dev/null | \
		jq -r '.data | to_entries[] | "\(.key)=<已设置>"' || \
		echo "  Secret 不存在"

backup-config: ## 备份配置文件到本地
	@echo "==> 备份配置到 ./backup/"
	@mkdir -p backup
	@kubectl exec $$(kubectl get pod -l app=openclaw-gateway -n $(NAMESPACE) -o jsonpath='{.items[0].metadata.name}') -n $(NAMESPACE) -- \
		tar czf - -C /root/.openclaw . | tar xzf - -C backup/
	@echo "==> 配置已备份到 ./backup/"

restore-config: ## 从本地恢复配置 (需要先备份)
	@if [ ! -d backup ]; then \
		echo "错误: backup/ 目录不存在"; \
		exit 1; \
	fi
	@echo "==> 从 ./backup/ 恢复配置"
	@tar czf - -C backup . | kubectl exec -i $$(kubectl get pod -l app=openclaw-gateway -n $(NAMESPACE) -o jsonpath='{.items[0].metadata.name}') -n $(NAMESPACE) -- \
		tar xzf - -C /root/.openclaw
	@echo "==> 配置已恢复"
	@$(MAKE) restart

.DEFAULT_GOAL := help
