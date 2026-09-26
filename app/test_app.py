import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# Support running pytest from repository root or from within app/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
try:
    import app.app as duokart_app
except ModuleNotFoundError:
    import app as duokart_app

app = duokart_app.app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_home(client):
    res = client.get('/')
    assert res.status_code == 200
    assert res.get_json() == {"message": "DuoKart is live!"}

def test_health_db_connected(client):
    with patch.object(duokart_app, 'get_db_connection') as mock_conn:
        mock_conn.return_value = MagicMock()
        res = client.get('/health')
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

def test_health_db_disconnected(client):
    with patch.object(duokart_app, 'get_db_connection') as mock_conn:
        mock_conn.side_effect = Exception("DB connection timeout")
        res = client.get('/health')
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "healthy"
        assert data["database"] == "disconnected"

def test_create_order_missing_fields(client):
    res = client.post('/orders', json={})
    assert res.status_code == 400
    assert res.get_json()["error"] == "INVALID"

def test_create_order_bad_items(client):
    payload = {
        "orderId": "ord-001",
        "items": "not-a-list",
        "total": 100,
        "buyerEmail": "test@example.com",
        "paymentRef": "pay-123"
    }
    res = client.post('/orders', json=payload)
    assert res.status_code == 400
    assert res.get_json()["message"] == "bad items"

def test_create_order_total_mismatch(client):
    payload = {
        "orderId": "ord-001",
        "items": [{"qty": 2, "price": 50}],
        "total": 150,  # 2*50 = 100 != 150
        "buyerEmail": "test@example.com",
        "paymentRef": "pay-123"
    }
    res = client.post('/orders', json=payload)
    assert res.status_code == 400
    assert res.get_json()["error"] == "TOTAL_MISMATCH"

def test_create_order_missing_buyer_or_payment(client):
    payload = {
        "orderId": "ord-001",
        "items": [{"qty": 1, "price": 100}],
        "total": 100
    }
    res = client.post('/orders', json=payload)
    assert res.status_code == 400
    assert "buyerEmail/paymentRef required" in res.get_json()["message"]

def test_create_order_success(client):
    with patch.object(duokart_app, '_aws_order') as mock_aws:
        mock_sqs = MagicMock()
        mock_ddb = MagicMock()
        mock_ddb.get_item.return_value = {}  # No existing order
        mock_aws.return_value = (mock_sqs, mock_ddb)

        payload = {
            "orderId": "ord-001",
            "items": [{"qty": 2, "price": 50}],
            "total": 100,
            "buyerEmail": "buyer@example.com",
            "paymentRef": "pay-001"
        }
        res = client.post('/orders', json=payload)
        assert res.status_code == 202
        assert res.get_json()["status"] == "RECEIVED"
        assert mock_sqs.send_message.called
        assert mock_ddb.put_item.called

def test_upload_url_invalid_kind(client):
    res = client.post('/uploads/url', json={"kind": "invalid", "filename": "test.png"})
    assert res.status_code == 400
    assert "kind must be photo|bill" in res.get_json()["error"]

def test_upload_url_missing_filename(client):
    res = client.post('/uploads/url', json={"kind": "photo"})
    assert res.status_code == 400
    assert "filename required" in res.get_json()["error"]
