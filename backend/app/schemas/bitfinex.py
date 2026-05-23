from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BitfinexAccountCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    api_key: str = Field(min_length=10, max_length=200)
    api_secret: str = Field(min_length=10, max_length=200)


class BitfinexAccountUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    active: bool | None = None


class BitfinexAccountOut(BaseModel):
    """对外返回不含 key/secret 明文，仅展示后 4 位掩码。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    api_key_masked: str
    active: bool
    created_at: datetime
    updated_at: datetime
