import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load environment variables for local development
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- CLOUDINARY CONFIGURATION ---
cloudinary.config(secure=True)

# --- DATABASE CONNECTION ---
def get_db_connection():
    # Uses the DATABASE_URL environment variable provided by your cloud host
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    return conn

# --- DATABASE INITIALIZATION ---
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS Books (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL,
            coverImage TEXT NOT NULL,
            status TEXT DEFAULT 'available'
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS Users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS Borrow_History (
            id SERIAL PRIMARY KEY,
            book_title TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

try:
    init_db()
except Exception as e:
    print("Database init skipped or failed (normal if DB not set up yet):", e)

# --- BOOK ROUTES ---
@app.route('/api/books', methods=['GET', 'POST'])
def handle_books():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'GET':
        cur.execute('SELECT * FROM Books')
        books = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(books)
    
    if request.method == 'POST':
        title = request.form.get('title')
        author = request.form.get('author')
        isbn = request.form.get('isbn')
        category = request.form.get('category')
        status = 'available'
        image_file = request.files.get('coverImage')
        
        if not image_file or image_file.filename == '':
            return jsonify({"error": "No image selected!"}), 400

        try:
            upload_result = cloudinary.uploader.upload(image_file)
            cloud_image_url = upload_result.get('secure_url')

            cur.execute(
                'INSERT INTO Books (title, author, isbn, category, coverImage, status) VALUES (%s, %s, %s, %s, %s, %s)',
                (title, author, isbn, category, cloud_image_url, status)
            )
            conn.commit()
            return jsonify({"message": "Book added successfully!"}), 201
            
        except psycopg2.IntegrityError:
            conn.rollback()
            return jsonify({"error": "A book with this ISBN already exists!"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cur.close()
            conn.close()

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM Books WHERE id = %s', (book_id,))
        conn.commit()
        return jsonify({"message": "Book deleted successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- AUTHENTICATION ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    conn = get_db_connection()
    cur = conn.cursor()
    hashed_password = generate_password_hash(data['password'])
    
    try:
        cur.execute(
            'INSERT INTO Users (name, email, password, role) VALUES (%s, %s, %s, %s)',
            (data['name'], data['email'], hashed_password, data['role'])
        )
        conn.commit()
        return jsonify({"message": f"{data['role'].capitalize()} account created successfully!"}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"error": "An account with this email already exists."}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        'SELECT * FROM Users WHERE email = %s AND role = %s', 
        (data['email'], data['role'])
    )
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and check_password_hash(user['password'], data['password']):
        user_data = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
        return jsonify({"message": "Login successful", "user": user_data}), 200
    else:
        return jsonify({"error": "Invalid credentials or incorrect account type."}), 401

# --- BORROW/RETURN & HISTORY ROUTES ---
@app.route('/api/books/<int:book_id>/action', methods=['PUT'])
def book_action(book_id):
    data = request.get_json()
    new_status = data['status']
    user_name = data['user_name']
    book_title = data['book_title']
    action_type = "Borrowed" if new_status == 'checked-out' else "Returned"

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('UPDATE Books SET status = %s WHERE id = %s', (new_status, book_id))
        cur.execute(
            'INSERT INTO Borrow_History (book_title, user_name, action) VALUES (%s, %s, %s)',
            (book_title, user_name, action_type)
        )
        conn.commit()
        return jsonify({"message": "Database updated successfully!"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/history', methods=['GET'])
def get_history():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM Borrow_History ORDER BY action_date DESC')
    history = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(history)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)