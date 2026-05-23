from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    GOOGLE_CLIENT_ID: str

    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    # 逗号分隔的 admin 邮箱列表；登录时按此列表同步用户 role
    ADMIN_EMAILS: str = ""
    # 接收平台费份额的账号邮箱，必须在 ADMIN_EMAILS 内
    PLATFORM_TREASURY_EMAIL: str | None = None
    # Fernet master key（用 `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` 生成）
    BITFINEX_KEY_ENCRYPTION_KEY: str

    # Bitfinex API base（测试时可指到 mock server）
    BITFINEX_API_BASE: str = "https://api.bitfinex.com"

    # 实例角色：`api`（默认，不启 scheduler）或 `scheduler`（同时启 API + scheduler）
    INSTANCE_ROLE: str = "scheduler"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]


settings = Settings()
