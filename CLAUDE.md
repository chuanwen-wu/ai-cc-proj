# ai-cc-proj

Web3 理财产品。前端 Next.js，后端 FastAPI，PostgreSQL，Docker Compose 编排。

## 技术栈

- **Frontend**：Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + NextAuth.js v5
- **Backend**：FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic + PostgreSQL 16
- **Auth**：Google OAuth（NextAuth 前端登录 → 后端验证 Google ID Token → 后端签发 JWT）
- **包管理**：后端 `uv`，前端 `pnpm`
- **格式化/Lint**：后端 `ruff`，前端 `prettier` + `eslint`
- **部署**：Docker Compose，镜像推 GHCR，GitHub Actions SSH 部署

## 目录约定

```
frontend/
  app/              # Next.js 页面（App Router）
  components/       # 可复用 UI 组件
  components/ui/    # shadcn/ui 组件（复制源码进来，可改）
  lib/              # 工具函数、API 客户端
  auth.ts           # NextAuth 配置
backend/
  app/
    api/            # FastAPI 路由（按业务模块分文件）
    core/           # config, security 等基础设施
    models/         # SQLAlchemy ORM 模型
    schemas/        # Pydantic 请求/响应模型
    db/             # 数据库 session、base
    main.py         # FastAPI app 入口
  alembic/          # 数据库迁移脚本
  tests/            # pytest 测试
docker/             # nginx 等容器配置
docs/prototypes/    # PM 用 claude.ai Artifact 生成的原型截图存这里
```

## 开发约定

- **API 路径**：所有后端 API 走 `/api/v1/...` 前缀
- **认证**：受保护接口用 `Depends(get_current_user)`，未登录返回 401
- **数据库变更**：必须用 Alembic 迁移，禁止手动改表
  - 生成迁移：`docker compose exec backend alembic revision --autogenerate -m "描述"`
  - 应用迁移：`docker compose exec backend alembic upgrade head`
- **前端 API 调用**：统一走 `frontend/lib/api.ts`，自动带 JWT
- **类型同步**：后端改 Pydantic schema 后，跑 `pnpm gen:types` 重新生成前端类型（待配置）

## 常用命令

```bash
# 启动开发环境
docker compose up -d

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 重启某个服务
docker compose restart backend

# 进容器
docker compose exec backend bash
docker compose exec frontend sh

# 后端测试
docker compose exec backend pytest

# 后端类型/lint
docker compose exec backend ruff check .
docker compose exec backend ruff format .

# 前端测试 / 类型检查
docker compose exec frontend pnpm test
docker compose exec frontend pnpm typecheck

# 数据库迁移
docker compose exec backend alembic upgrade head
```

## 提交前必跑

- 后端：`ruff check . && pytest`
- 前端：`pnpm typecheck && pnpm lint`

## Web3 相关（未来扩展）

钱包认证、链上交互等还未引入。当接入时使用：
- `wagmi` + `viem`（前端钱包连接、合约调用）
- `web3.py` 或直接 RPC（后端链上读取）
- 钱包认证走 SIWE（Sign-In With Ethereum）流程，复用现有 JWT 体系
