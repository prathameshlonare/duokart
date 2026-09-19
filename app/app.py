from flask import Flask, jsonify, request
import os
import boto3
from botocore.config import Config
import pymysql
import json
from pymysql.cursors import DictCursor

app = Flask(__name__)

DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', '3306'))
DB_USER = os.environ.get('DB_USER', 'admin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_NAME = os.environ.get('DB_NAME', 'duokart')
S3_PHOTOS_BUCKET = os.environ.get('S3_PHOTOS_BUCKET', '')
S3_BILLS_BUCKET = os.environ.get('S3_BILLS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-2')
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL', '')
DDB_ORDERS_TABLE = os.environ.get('DDB_ORDERS_TABLE', 'duokart-orders')

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=DictCursor,
        connect_timeout=5
    )

@app.route('/')
def home():
    return jsonify({"message": "DuoKart is live!"})

@app.route('/health')
def health():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "healthy", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "healthy", "database": "disconnected", "note": "app live, db not yet wired", "error": str(e)})

@app.route('/products')
def get_products():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM products")
            products = cursor.fetchall()
        conn.close()
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/uploads/url', methods=['POST'])
def get_upload_url():
    data = request.get_json(force=True, silent=True) or {}
    kind = data.get('kind')
    filename = data.get('filename')
    if kind not in ('photo', 'bill'):
        return jsonify({"error": "kind must be photo|bill"}), 400
    if not filename:
        return jsonify({"error": "filename required"}), 400
    filename = str(filename).strip().lstrip('/').split('/')[-1]
    checksum_sha256 = data.get('checksumSha256')  # optional, no Object Lock now
    if kind == 'photo':
        bucket = S3_PHOTOS_BUCKET
        key = f"photos/{filename}"
    else:
        bucket = S3_BILLS_BUCKET
        key = f"bills/{filename}"
    if not bucket:
        return jsonify({"error": "bucket not configured"}), 500
    try:
        cfg = Config(signature_version='s3v4', s3={'addressing_style': 'virtual'})
        s3 = boto3.client('s3', region_name='us-east-2', config=cfg)
        params = {'Bucket': bucket, 'Key': key}
        if kind == 'bill' and checksum_sha256:
            params['ChecksumSHA256'] = checksum_sha256
        url = s3.generate_presigned_url('put_object', Params=params, ExpiresIn=900)
        return jsonify({"uploadUrl": url, "key": key, "bucket": bucket})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _aws_order():
    sqs = boto3.client('sqs', region_name='us-east-2')
    ddb = boto3.client('dynamodb', region_name='us-east-2')
    return sqs, ddb

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get('orderId')
    items = data.get('items')
    total = data.get('total')
    if not order_id or not items or total is None:
        return jsonify({"error": "INVALID", "message": "orderId/items/total required"}), 400
    try:
        calc = sum(int(i['qty']) * int(i['price']) for i in items)
    except Exception:
        return jsonify({"error": "INVALID", "message": "bad items"}), 400
    if int(total) != calc:
        return jsonify({"error": "TOTAL_MISMATCH", "message": "total != sum(qty*price)"}), 400
    if not data.get('buyerEmail') or not data.get('paymentRef'):
        return jsonify({"error": "INVALID", "message": "buyerEmail/paymentRef required"}), 400

    sqs, ddb = _aws_order()
    canon = json.dumps(data, sort_keys=True)
    existing = ddb.get_item(TableName=DDB_ORDERS_TABLE, Key={'orderId': {'S': order_id}}).get('Item')
    if existing:
        # stored canon in 'payload' attr on first write below
        if existing.get('payload', {}).get('S') == canon:
            return jsonify({"orderId": order_id, "status": "RECEIVED"}), 202
        return jsonify({"error": "CONFLICT", "message": "duplicate orderId different payload"}), 409

    sqs.send_message(QueueUrl=SQS_QUEUE_URL, MessageBody=canon)
    ddb.put_item(TableName=DDB_ORDERS_TABLE,
        Item={'orderId': {'S': order_id}, 'status': {'S': 'RECEIVED'}, 'total': {'N': str(int(total))}, 'payload': {'S': canon}})
    return jsonify({"orderId": order_id, "status": "RECEIVED"}), 202

@app.route('/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    _, ddb = _aws_order()
    item = ddb.get_item(TableName=DDB_ORDERS_TABLE, Key={'orderId': {'S': order_id}}).get('Item')
    if not item:
        return jsonify({"error": "NOT_FOUND", "message": "unknown id"}), 404
    return jsonify({
        "orderId": order_id,
        "status": item.get('status', {}).get('S', 'RECEIVED'),
        "total": int(item.get('total', {}).get('N', '0'))
    }), 200