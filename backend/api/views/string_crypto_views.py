import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA512
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

ALGO_PBKDF2_SHA512_AES256 = "PBKDF2_HMAC_SHA512_AES_256"
MODE_ENCRYPT = "encrypt"
MODE_DECRYPT = "decrypt"
PREFIX = "PYENCv1:"
SALT_LENGTH = 16
NONCE_LENGTH = 12
KEY_LENGTH = 32
ITERATIONS = 210_000


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


@api_view(["POST"])
@permission_classes([AllowAny])
def string_crypto_view(request):
    _enforce_csrf(request)
    payload = request.data if isinstance(request.data, dict) else {}

    mode = (payload.get("mode") or "").strip().lower()
    algorithm = (payload.get("algorithm") or "").strip().upper()
    text = payload.get("text") or ""
    secret_key = payload.get("secretKey") or ""

    if mode not in (MODE_ENCRYPT, MODE_DECRYPT):
        return Response(
            {"error": "Invalid mode. Use 'encrypt' or 'decrypt'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if algorithm != ALGO_PBKDF2_SHA512_AES256:
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

