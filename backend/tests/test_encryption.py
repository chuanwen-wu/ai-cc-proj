from app.core.encryption import decrypt, encrypt


def test_encrypt_decrypt_roundtrip() -> None:
    plaintext = "bitfinex-api-secret-XYZ-123"
    cipher = encrypt(plaintext)
    assert cipher != plaintext
    assert decrypt(cipher) == plaintext


def test_encrypt_produces_different_ciphertexts() -> None:
    """Fernet 每次加密都用新 nonce，同样的明文密文不一样。"""
    a = encrypt("same-input")
    b = encrypt("same-input")
    assert a != b
    assert decrypt(a) == decrypt(b) == "same-input"
