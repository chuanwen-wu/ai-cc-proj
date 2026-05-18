# ai-cc-proj

Web3 理财产品。

## 技术栈

- Frontend: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI + PostgreSQL
- Auth: Google OAuth via NextAuth.js
- Deploy: Docker Compose

## 快速开始

```bash
# 1. 复制环境变量
cp .env.example .env
# 编辑 .env 填入 Google OAuth client id/secret 等

# 2. 启动所有服务
docker compose up -d

# 3. 跑数据库迁移
docker compose exec backend alembic upgrade head

# 4. 访问
# 前端：http://localhost:3000
# 后端 API 文档：http://localhost:8000/docs
```

## 获取 Google OAuth 凭据

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → APIs & Services → Credentials → Create OAuth Client ID
3. Application type 选 Web application
4. Authorized redirect URIs 加上 `http://localhost:3000/api/auth/callback/google`
5. 复制 Client ID 和 Client Secret 到 `.env`

## 开发流程

详见 [CLAUDE.md](./CLAUDE.md)

## 协作流程

- **PM 提需求**：用 GitHub Issue 模板（功能需求 / Bug 上报）
- **PM 出原型**：用 [v0.dev](https://v0.dev) 生成 UI，截图贴到 Issue
- **工程师开发**：拉分支 → Claude Code 开发 → PR → 合并
- **部署**：合并到 `main` 自动构建镜像 + SSH 部署到生产服务器
test
