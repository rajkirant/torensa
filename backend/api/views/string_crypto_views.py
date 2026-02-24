import base64
import os
import unicodedata

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.hashes import SHA512
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

ALGO_PBKDF2_SHA512_AES256 = "PBKDF2_HMAC_SHA512_AES_256"
ALGO_JASYPT_PBE_HMAC_SHA512_AES256 = "JASYPT_PBEWITHHMACSHA512ANDAES_256"
MODE_ENCRYPT = "encrypt"
MODE_DECRYPT = "decrypt"
PREFIX = "PYENCv1:"
SALT_LENGTH = 16
NONCE_LENGTH = 12
KEY_LENGTH = 32
ITERATIONS = 210_000
JASYPT_SALT_LENGTH = 16
JASYPT_IV_LENGTH = 16
JASYPT_ITERATIONS = 1000
JASYPT_OUTPUT_PREFIX = "ENC("


def _enforce_csrf(request):
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied("CSRF token missing or incorrect.")


def _derive_key(secret_key: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=SHA512(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=ITERATIONS,
    )
    return kdf.derive(secret_key.encode("utf-8"))


def _encode_payload(salt: bytes, nonce: bytes, ciphertext: bytes) -> str:
    envelope = bytes([1]) + salt + nonce + ciphertext
    return PREFIX + base64.b64encode(envelope).decode("ascii")


def _decode_payload(payload: str) -> tuple[bytes, bytes, bytes]:
    token = payload.strip()
    if token.startswith(PREFIX):
        token = token[len(PREFIX) :]

    raw = base64.b64decode(token, validate=True)
    if len(raw) <= 1 + SALT_LENGTH + NONCE_LENGTH:
        raise ValueError("Ciphertext payload is too short.")

    version = raw[0]
    if version != 1:
        raise ValueError("Unsupported ciphertext version.")

    salt_start = 1
    salt_end = salt_start + SALT_LENGTH
    nonce_end = salt_end + NONCE_LENGTH
    salt = raw[salt_start:salt_end]
    nonce = raw[salt_end:nonce_end]
    ciphertext = raw[nonce_end:]
    return salt, nonce, ciphertext


def _normalize_password(secret_key: str) -> str:
    return unicodedata.normalize("NFC", secret_key)


def _strip_jasypt_wrapper(text: str) -> str:
    token = text.strip()
    if token.startswith(JASYPT_OUTPUT_PREFIX) and token.endswith(")"):
        return token[len(JASYPT_OUTPUT_PREFIX) : -1].strip()
    return token


def _derive_jasypt_key(secret_key: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=SHA512(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=JASYPT_ITERATIONS,
    )
    return kdf.derive(_normalize_password(secret_key).encode("utf-8"))


def _jasypt_encrypt(text: str, secret_key: str) -> str:
    salt = os.urandom(JASYPT_SALT_LENGTH)
    iv = os.urandom(JASYPT_IV_LENGTH)
    key = _derive_jasypt_key(secret_key, salt)
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(text.encode("utf-8")) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()
    payload = base64.b64encode(salt + iv + ciphertext).decode("ascii")
    return f"{JASYPT_OUTPUT_PREFIX}{payload})"


def _jasypt_decrypt(text: str, secret_key: str) -> str:
    token = _strip_jasypt_wrapper(text)
    raw = base64.b64decode(token, validate=True)
    if len(raw) <= JASYPT_SALT_LENGTH + JASYPT_IV_LENGTH:
        raise ValueError("Ciphertext payload is too short.")
    salt = raw[:JASYPT_SALT_LENGTH]
    iv = raw[JASYPT_SALT_LENGTH : JASYPT_SALT_LENGTH + JASYPT_IV_LENGTH]
    ciphertext = raw[JASYPT_SALT_LENGTH + JASYPT_IV_LENGTH :]
    key = _derive_jasypt_key(secret_key, salt)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
    plaintext = unpadder.update(padded) + unpadder.finalize()
    return plaintext.decode("utf-8")


@api_view(["POST"])
@permission_classes([AllowAny])
def string_crypto_view(request):
    _enforce_csrf(request)
    payload = request.data if isinstance(request.data, dict) else {}

    mode = (payload.get("mode") or "").strip().lower()
    algorithm = (
        payload.get("algorithm") or ALGO_JASYPT_PBE_HMAC_SHA512_AES256
    ).strip().upper()
    text = payload.get("text") or ""
    secret_key = payload.get("secretKey") or ""

    if mode not in (MODE_ENCRYPT, MODE_DECRYPT):
        return Response(
            {"error": "Invalid mode. Use 'encrypt' or 'decrypt'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if algorithm != ALGO_PBKDF2_SHA512_AES256:
        if algorithm != ALGO_JASYPT_PBE_HMAC_SHA512_AES256:
            return Response(
                {"error": f"Unsupported algorithm: {algorithm or 'none'}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if not isinstance(text, str) or not text.strip():
        return Response(
            {"error": "Text is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(secret_key, str) or len(secret_key) < 8:
        return Response(
            {"error": "Secret key must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if mode == MODE_ENCRYPT:
            if algorithm == ALGO_JASYPT_PBE_HMAC_SHA512_AES256:
                output = _jasypt_encrypt(text, secret_key)
                return Response(
                    {
                        "algorithm": ALGO_JASYPT_PBE_HMAC_SHA512_AES256,
                        "output": output,
                        "format": "ENC(<base64>)",
                    },
                    status=status.HTTP_200_OK,
                )
            salt = os.urandom(SALT_LENGTH)
            nonce = os.urandom(NONCE_LENGTH)
            key = _derive_key(secret_key, salt)
            cipher = AESGCM(key)
            ciphertext = cipher.encrypt(nonce, text.encode("utf-8"), None)
            output = _encode_payload(salt, nonce, ciphertext)
            return Response(
                {
                    "algorithm": ALGO_PBKDF2_SHA512_AES256,
                    "output": output,
                    "format": PREFIX + "<base64>",
                },
                status=status.HTTP_200_OK,
            )

        if algorithm == ALGO_JASYPT_PBE_HMAC_SHA512_AES256:
            plaintext = _jasypt_decrypt(text, secret_key)
            return Response(
                {
                    "algorithm": ALGO_JASYPT_PBE_HMAC_SHA512_AES256,
                    "output": plaintext,
                },
                status=status.HTTP_200_OK,
            )
        salt, nonce, ciphertext = _decode_payload(text)
        key = _derive_key(secret_key, salt)
        cipher = AESGCM(key)
        plaintext = cipher.decrypt(nonce, ciphertext, None).decode("utf-8")
        return Response(
            {
                "algorithm": ALGO_PBKDF2_SHA512_AES256,
                "output": plaintext,
            },
            status=status.HTTP_200_OK,
        )
    except Exception:
        return Response(
            {"error": "Encryption/Decryption failed. Check input and secret key."},
            status=status.HTTP_400_BAD_REQUEST,
        )

