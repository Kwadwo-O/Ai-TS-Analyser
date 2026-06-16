from flask import Flask, render_template, redirect, url_for, request, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User
from backend import backend_generate, backend_send, verify_openrouter

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'  # redirect here if not logged in

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Routes ---

@app.route('/')
@login_required
def home():
    return render_template('home.html', name=current_user.username)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        existing = User.query.filter_by(username=username).first()
        if existing:
            flash('Username already taken.')
            return redirect(url_for('register'))
        hashed_pw = generate_password_hash(password)
        new_user = User(username=username, password=hashed_pw, api="")
        db.session.add(new_user)
        db.session.commit()
        flash('Account created! Please log in.')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('home'))
        flash('Invalid username or password.')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/play')
@login_required
def play():
    return render_template('Play.html')


@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    # Force query the exact user model row instance using the current user ID
    db_user = User.query.get(current_user.id)

    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'clear':
            db_user.api_key = None
            db.session.commit()
            flash('API key removed from your account.')
            return redirect(url_for('dashboard'))

        elif action == 'save':
            # Safely fetch parameter strings directly from the raw form dictionary dictionary
            api_key = request.form.get('api_key', '').strip()

            # 1. Structural Validation Check
            if not api_key.startswith("sk-or-v1-"):
                flash("Invalid format! Key must start with 'sk-or-v1-'")
                return redirect(url_for('dashboard'))

            # 2. Live API Validation Check
            try:
                if verify_openrouter(api_key):
                    db_user.api_key = api_key  # Modify row data directly
                    db.session.add(db_user)  # Re-verify tracking attachment
                    db.session.commit()  # Force hardware write block execution
                    flash('API key verified and updated successfully.')
                else:
                    flash('Verification failed! The API key is invalid or rejected.')
            except Exception as e:
                db.session.rollback()
                flash(f'Connection error during verification: {str(e)}')

        return redirect(url_for('dashboard'))

    # GET request processing block
    is_valid = False
    if db_user and db_user.api_key:
        try:
            is_valid = verify_openrouter(db_user.api_key)
        except Exception:
            is_valid = False

    return render_template('dashboard.html', api_key=db_user.api_key, is_valid=is_valid)

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)