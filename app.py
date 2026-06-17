import re, traceback
from flask import Flask, flash, jsonify, redirect, render_template, request, url_for
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash
from backend import backend_generate, backend_send, verify_openrouter
from models import TypingResult, db, User

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'


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
        # Clean white space from ends of fields
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        # 1. Base emptiness checks
        if not username or not password:
            flash('All input fields are required to establish an account profile.')
            return redirect(url_for('register'))

        # 2. Username structure restrictions
        if len(username) < 3:
            flash('Your username must be at least 3 characters long.')
            return redirect(url_for('register'))

        if not re.match(r'^\w+$', username):
            flash('Usernames can only contain standard alphanumeric characters and underscores.')
            return redirect(url_for('register'))

        # 3. Strength metrics evaluation for Password protection
        if len(password) < 8:
            flash('Security validation failed: Password must be at least 8 characters long.')
            return redirect(url_for('register'))

        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            flash('Security validation failed: Password must include a mixture of both letters and numeric digits.')
            return redirect(url_for('register'))

        # 4. Check database duplicates
        existing = User.query.filter_by(username=username).first()
        if existing:
            flash('Username already taken.')
            return redirect(url_for('register'))

        hashed_pw = generate_password_hash(password)
        new_user = User(username=username, password=hashed_pw, api_key=None)

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


@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    db_user = User.query.get(current_user.id)
    current_tab = request.args.get('tab', 'profile')

    if request.method == 'POST':
        action = request.form.get('action')
        target_tab = request.args.get('tab', 'profile')

        if action == 'delete_account':
            try:
                db.session.delete(db_user)
                db.session.commit()
                logout_user()
                flash('Your account has been permanently deleted.', 'success')
                return redirect(url_for('register'))
            except Exception as e:
                db.session.rollback()
                flash(f'Error processing account termination: {str(e)}', 'error')
                return redirect(url_for('dashboard', tab='settings'))

        elif action == 'clear':
            db_user.api_key = None
            db.session.commit()
            flash('API key removed from your account.')
            return redirect(url_for('dashboard', tab=target_tab))

        elif action == 'save':
            api_key = request.form.get('api_key', '').strip()

            if not api_key.startswith("sk-or-v1-"):
                flash("Invalid format! Key must start with 'sk-or-v1-'")
                return redirect(url_for('dashboard', tab=target_tab))

            try:
                if verify_openrouter(api_key):
                    db_user.api_key = api_key
                    db.session.add(db_user)
                    db.session.commit()
                    flash('API key verified and updated successfully.')
                else:
                    flash('Verification failed! The API key is invalid or rejected.')
            except Exception as e:
                db.session.rollback()
                flash(f'Connection error during verification: {str(e)}')

        return redirect(url_for('dashboard', tab=target_tab))

    is_valid = False
    if db_user and db_user.api_key:
        try:
            is_valid = verify_openrouter(db_user.api_key)
        except Exception:
            is_valid = False

    user_history = TypingResult.query.filter_by(user_id=db_user.id).order_by(TypingResult.date_recorded.desc()).all()
    total_tests = len(user_history)
    avg_wpm = 0
    highest_wpm = 0

    if total_tests > 0:
        speeds = [run.speed_wpm for run in user_history]
        avg_wpm = round(sum(speeds) / total_tests)
        highest_wpm = max(speeds)

    return render_template(
        'dashboard.html',
        api_key=db_user.api_key,
        is_valid=is_valid,
        current_tab=current_tab,
        user=db_user,
        history=user_history,
        total_tests=total_tests,
        avg_wpm=avg_wpm,
        highest_wpm=highest_wpm
    )


@app.route('/play')
@login_required
def play():
    return render_template('Play.html')


@app.route('/api/generate', methods=['GET'])
def api_generate():
    if not current_user.is_authenticated:
        return jsonify({"error": "Session expired or unauthenticated. Please log in again."}), 401

    try:
        db_user = User.query.get(current_user.id)
        if not db_user or not db_user.api_key:
            return jsonify({"error": "Missing OpenRouter API Key. Please add one in your Dashboard settings."}), 400

        difficulty = request.args.get('difficulty', 'medium')
        generated_sentence = backend_generate(db_user.api_key, difficulty)

        if not generated_sentence:
            return jsonify({"error": "The AI generation routine returned an empty challenge text string."}), 500

        return jsonify({"sentence": str(generated_sentence)})

    except Exception as e:
        print("Real Error Traceback:")
        traceback.print_exc()
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500


@app.route('/api/submit', methods=['POST'])
@login_required
def api_submit():
    data = request.get_json() or {}
    original = data.get('original_sentence', '')
    user_typed = data.get('user_sentence', '')
    time_taken = data.get('time', '')
    speed = data.get('typing_speed', '0 WPM')

    try:
        analysis_result = backend_send(
            original_sentence=original,
            user_sentence=user_typed,
            time=time_taken,
            typing_speed=speed,
            api_key=current_user.api_key
        )

        if isinstance(analysis_result, str):
            norm_str = analysis_result.replace("{", "").replace("}", "").replace("response:", "")

            rating_m = re.search(r"user\s*rating\s*:\s*([^\n,]+)", norm_str, re.I)
            score_m = re.search(r"score\s*:\s*([^\n,]+)", norm_str, re.I)
            acc_m = re.search(r"accuracy\s*:\s*([^\n,]+)", norm_str, re.I)

            analysis_result = {
                "text_analysis": "Analysis complete.",
                "user_rating": rating_m.group(1).replace("'", "").replace('"', '').strip() if rating_m else "Pro",
                "score": score_m.group(1).replace("'", "").replace('"', '').strip() if score_m else "100/100",
                "accuracy": acc_m.group(1).replace("'", "").replace('"', '').strip() if acc_m else "100%",
                "mistakes": []
            }

        raw_wpm_digits = re.sub(r"\D", "", str(speed))
        wpm_value = int(raw_wpm_digits) if raw_wpm_digits else 0

        acc_string = str(analysis_result.get("accuracy", "100%"))
        if acc_string == "100/100":
            acc_string = "100%"

        new_run_record = TypingResult(
            user_id=current_user.id,
            speed_wpm=wpm_value,
            accuracy=acc_string,
            score=str(analysis_result.get("score", "100/100")),
            tier_status=str(analysis_result.get("user_rating", "Pro"))
        )

        db.session.add(new_run_record)
        db.session.commit()

        analysis_result["accuracy"] = acc_string
        return jsonify(analysis_result)

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": f"Database recording pipeline error: {str(e)}"}), 500


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)