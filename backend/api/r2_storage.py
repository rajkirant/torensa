import mimetypes
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


R2_PROVIDER = "cloudflare-r2"


def is_r2_enabled() -> bool:
    return settings.TEXT_SHARE_STORAGE_BACKEND == "r2"


def assert_r2_enabled() -> None:
    if not is_r2_enabled():
        raise ImproperlyConfigured(
            "TEXT_SHARE_STORAGE_BACKEND must be set to 'r2' to use direct uploads."
        )


@lru_cache(maxsize=1)
def get_r2_client():
    assert_r2_enabled()
    return boto3.client(
        "s3",
        region_name="auto",
        endpoint_url=settings.TEXT_SHARE_R2_ENDPOINT,
        aws_access_key_id=settings.TEXT_SHARE_R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.TEXT_SHARE_R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def create_upload_url(*, object_key: str, content_type: str, expires_in: int) -> str:
    client = get_r2_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.TEXT_SHARE_R2_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )

def create_download_url(
    *,
    object_key: str,
    filename: str,
    content_type: str,
    expires_in: int,
) -> str:
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.TEXT_SHARE_R2_BUCKET_NAME,
            "Key": object_key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
            "ResponseContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="GET",
    )


def head_object(*, object_key: str):
    client = get_r2_client()
    return client.head_object(Bucket=settings.TEXT_SHARE_R2_BUCKET_NAME, Key=object_key)


def get_object(*, object_key: str):
    client = get_r2_client()
    return client.get_object(Bucket=settings.TEXT_SHARE_R2_BUCKET_NAME, Key=object_key)


def delete_objects(object_keys: list[str]) -> None:
    if not object_keys:
        return
    client = get_r2_client()
    chunk_size = 1000
    for start in range(0, len(object_keys), chunk_size):
        batch = object_keys[start:start + chunk_size]
        client.delete_objects(
            Bucket=settings.TEXT_SHARE_R2_BUCKET_NAME,
            Delete={"Objects": [{"Key": key} for key in batch], "Quiet": True},
        )


__all__ = [
    "BotoCoreError",
    "ClientError",
    "create_download_url",
    "R2_PROVIDER",
    "create_upload_url",
    "delete_objects",
    "get_object",
    "guess_content_type",
    "head_object",
    "is_r2_enabled",
]