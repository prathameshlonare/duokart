from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return 'DuoKart is live!'

@app.route('/health')
def health():
    return 'OK', 200