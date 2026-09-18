from flask import Flask, jsonify, request
import os
import boto3
import pymysql
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
    if kind == 'photo':
        bucket = S3_PHOTOS_BUCKET
        key = f"photos/{filename}"
    else:
        bucket = S3_BILLS_BUCKET
        key = f"bills/{filename}"
    if not bucket:
        return jsonify({"error": "bucket not configured"}), 500
    try:
        s3 = boto3.client('s3', region_name=AWS_REGION)
        url = s3.generate_presigned_url('put_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=900)
        return jsonify({"uploadUrl": url, "key": key, "bucket": bucket})
    except Exception as e:
        return jsonify({"error": str(e)}), 500