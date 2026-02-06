def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": "{\"ok\": true, \"message\": \"hello world test from torensa lambda\"}"
    }
