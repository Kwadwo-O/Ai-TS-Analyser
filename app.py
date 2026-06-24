import re
import traceback
import requests
import os
from sqlalchemy import func, create_engine
from flask import Flask, flash, jsonify, redirect, render_template, request, url_for
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash
from backend import backend_generate, backend_send, verify_openrouter, change_model
from models import db, User, TypingResult
from flask import jsonify, request
import difflib
# Automatically detect and load key-value configurations from the local .env file
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# --- Safe Environment Key Fallbacks & Configurations ---
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'default-dev-safe-fallback-key')

# 1. Fetch your target cloud Neon URI from environment variables or hardcoded string
neon_cloud_uri = os.environ.get(
    'SQLALCHEMY_DATABASE_URI',
    "postgresql://neondb_owner:npg_Z3rleqh6iGSY@ep-cool-cell-abkr7bne-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

# 2. Network Shield: Test connection. If port 5432 is blocked by the college, fall back to offline SQLite.
try:
    print("Checking availability of Neon cloud database cluster...")
    # Attempt a quick network test hook with a 3-second limit
    test_engine = create_engine(neon_cloud_uri, connect_args={"connect_timeout": 3})
    with test_engine.connect() as conn:
        pass

    app.config['SQLALCHEMY_DATABASE_URI'] = neon_cloud_uri
    print("🚀 NETWORKING SUCCESS: Connected to Neon cloud database cluster!")

except Exception as network_error:
    print("\n" + "=" * 70)
    print("⚠️ NETWORK FIREWALL BLOCK DETECTED")
    print("College network is restricting out-bound Port 5432.")
    print("Switching app profile cleanly to an offline local database engine...")
    print("=" * 70 + "\n")

    # Creates an isolated 'local_development.db' file right inside your project directory
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///local_development.db"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# This will now successfully boot up without throwing any OperationalError!
db.init_app(app)

# 🔥 GLOBAL SERVER SETUP SCHEMA MIGRATION: Ensures columns widen instantly on startup 🔥
with app.app_context():
    db.create_all()
    # Only run the Postgres ALTER syntax if we are actually connected to Neon cloud
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith("postgresql"):
        try:
            from sqlalchemy import text

            db.session.execute(text("ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(500);"))
            db.session.execute(text("ALTER TABLE users ALTER COLUMN api_key TYPE VARCHAR(500);"))
            db.session.commit()
            print("🚀 DATABASE SUCCESS: Columns successfully upgraded to VARCHAR(500) on Neon!")
        except Exception as e:
            db.session.rollback()
            print(f"⚠️ Neon column adjustment notice (Safe if already modified): {e}")
    else:
        print("📁 LOCAL STORAGE ACTIVE: SQLite initialized successfully.")

# ... The rest of your routes and login_manager logic remains exactly the same ...

login_manager = LoginManager(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# --- Routes ---

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    try:
        TypingResult.query.filter_by(user_id=current_user.id).delete()
        db.session.delete(current_user)
        db.session.commit()
        logout_user()
        flash('Your account has been deleted successfully.')
        return redirect(url_for('home'))
    except Exception as e:
        db.session.rollback()
        flash(f'Error processing account termination: {str(e)}')
    return redirect(url_for('dashboard'))


@app.route('/')
@login_required
def home():
    return render_template('home.html', name=current_user.username)


@app.route('/play')
@login_required
def play():
    return render_template('play.html')


@app.route('/api/generate', methods=['GET'])
@login_required
def generate_passage():
    user_api_key = current_user.api_key
    difficulty = request.args.get('difficulty', 'easy')
    mode = request.args.get('mode', 'text')
    selected_language = request.args.get('language', 'python')
    print(f"API request received for difficulty: {difficulty}, mode: {mode}, language: {selected_language}")
    try:
        sentence = backend_generate(user_api_key, difficulty, mode, selected_language)
        return jsonify({"sentence": sentence})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/submit', methods=['POST'])
@login_required
def submit_passage():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    orig = data.get('original_sentence', '')
    user_str = data.get('user_sentence', '')
    time_str = data.get('time', '0s')
    speed = data.get('typing_speed', '0 WPM')

    try:
        analysis_result = backend_send(orig, user_str, time_str, speed)
        if not analysis_result or not isinstance(analysis_result, dict):
            norm_str = str(analysis_result)
            rating_m = re.search(r"Rating:\s*([^\n,]+)", norm_str, re.I)
            score_m = re.search(r"Score:\s*([^\n,]+)", norm_str, re.I)
            acc_m = re.search(r"Accuracy:\s*([^\n,]+)", norm_str, re.I)

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

        new_result = TypingResult(
            user_id=current_user.id,
            speed_wpm=wpm_value,
            accuracy=acc_string,
            score=str(analysis_result.get("score", "100/100")),
            tier_status=str(analysis_result.get("user_rating", "Pro"))
        )
        db.session.add(new_result)
        db.session.commit()

        return jsonify(analysis_result)
    except Exception as e:
        db.session.rollback()
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    current_tab = request.args.get('tab', 'profile')

    if current_tab == 'admin':
        password_attempt = request.form.get('admin_password') or request.args.get('admin_password')
        if password_attempt != "Admin112233":
            flash("Security error: Access Denied. Administrative credentials incorrect.")
            return redirect(url_for('dashboard', tab='profile'))

    if request.method == 'POST':
        action = request.form.get('action')
        target_tab = request.args.get('tab', 'profile')

        if action == 'delete_account':
            return redirect(url_for('delete_account'), code=307)

        elif action == 'clear':
            current_user.api_key = None
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
                    current_user.api_key = api_key
                    db.session.commit()
                    flash('API key verified and updated successfully.')
                else:
                    flash('Verification failed! The API key is invalid.')
            except Exception as e:
                flash(f'Connection error during verification: {str(e)}')

        elif action == 'update_ai_model':
            selected_model = request.form.get('ai_model_selection', '').strip()
            if selected_model:
                try:
                    change_model(selected_model)
                    flash(f"AI Engine structural context reassigned to: {selected_model}")
                except Exception as e:
                    flash(f"Internal assignment error matching backend modules: {str(e)}")
            return redirect(url_for('dashboard', tab=target_tab))

        elif action == 'admin_create_user':
            new_username = request.form.get('username', '').strip()
            new_password = request.form.get('password', '')
            new_api_key = request.form.get('api_key', '').strip() or None

            if not new_username or not new_password:
                flash('All input fields are required.')
            elif len(new_username) < 3:
                flash('Your username must be at least 3 characters long.')
            elif not re.match(r'^\w+$', new_username):
                flash('Usernames can only contain alphanumeric characters.')
            elif len(new_password) < 8:
                flash('Password must be at least 8 characters long.')
            elif not any(char.isdigit() for char in new_password) or not any(char.isalpha() for char in new_password):
                flash('Password must include a mixture of letters and digits.')
            elif User.query.filter_by(username=new_username).first():
                flash('Operation error: A user with that identifier already exists.')
            else:
                try:
                    hashed_pw = generate_password_hash(new_password)
                    admin_created_user = User(username=new_username, password=hashed_pw, api_key=new_api_key)
                    db.session.add(admin_created_user)
                    db.session.commit()
                    flash(f'Account node profile "{new_username}" successfully appended.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Database node instantiation failure: {str(e)}')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_modify_user':
            target_id = request.form.get('user_id')
            target_user = User.query.get(int(target_id))
            if target_user:
                mod_username = request.form.get('username', '').strip()
                mod_password = request.form.get('password', '')
                mod_api_key = request.form.get('api_key', '').strip()

                if mod_username:
                    if len(mod_username) < 3 or not re.match(r'^\w+$', mod_username):
                        flash('Update error: Invalid username format criteria.')
                        return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))
                    target_user.username = mod_username

                if mod_password:
                    if len(mod_password) < 8 or not any(c.isdigit() for c in mod_password) or not any(
                            c.isalpha() for c in mod_password):
                        flash('Update failed: Password criteria mismatch.')
                        return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))
                    target_user.password = generate_password_hash(mod_password)

                if mod_api_key == "__REMOVE__":
                    target_user.api_key = None
                elif mod_api_key:
                    target_user.api_key = mod_api_key

                try:
                    db.session.commit()
                    flash(f'Database parameters updated for profile target Node #{target_id}.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Mutation error: {str(e)}')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_delete_user':
            target_id = request.form.get('user_id')
            if int(target_id) == current_user.id:
                flash('Security Violation: The active operator instance session cannot be deleted.')
            else:
                try:
                    target_user = User.query.get(int(target_id))
                    if target_user:
                        TypingResult.query.filter_by(user_id=target_user.id).delete()
                        db.session.delete(target_user)
                        db.session.commit()
                        flash(f'Account sequence mapping #{target_id} severed successfully.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Error processing account drop: {str(e)}')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_wipe_all_except_self':
            confirm_phrase = request.form.get('verification_text', '').strip()
            if confirm_phrase == 'OVERRIDE SYSTEM DELETE ALL':
                try:
                    other_users = User.query.filter(User.id != current_user.id).all()
                    count = 0
                    for u in other_users:
                        TypingResult.query.filter_by(user_id=u.id).delete()
                        db.session.delete(u)
                        count += 1
                    db.session.commit()
                    flash(f'Global wipe executed. Dropped {count} alternate accounts.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Critical processing error: {str(e)}')
            else:
                flash('Verification failed! Sequence aborted.')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        return redirect(url_for('dashboard', tab=target_tab))

    is_valid = False
    if current_user.api_key:
        try:
            is_valid = verify_openrouter(current_user.api_key)
        except Exception:
            is_valid = False

    user_history = TypingResult.query.filter_by(user_id=current_user.id).order_by(TypingResult.id.desc()).all()

    total_tests = len(user_history)
    avg_wpm = 0
    highest_wpm = 0

    if total_tests > 0:
        speeds = [run.speed_wpm for run in user_history]
        avg_wpm = round(sum(speeds) / total_tests)
        highest_wpm = max(speeds)

    all_users = []
    total_metrics_logged = TypingResult.query.count()
    if current_tab == 'admin':
        all_users = User.query.all()

    free_models_list = []
    paid_models_list = []
    active_current_model = ""

    try:
        from backend import MODEL
        active_current_model = MODEL
    except Exception:
        pass

    try:
        or_api_res = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
        if or_api_res.status_code == 200:
            raw_payload = or_api_res.json().get('data', [])
            for node in raw_payload:
                m_id = node.get('id', '')
                if "vision" in m_id or "embedding" in m_id or "moderation" in m_id:
                    continue

                m_name = node.get('name', m_id)
                pricing = node.get('pricing', {})
                try:
                    is_free = float(pricing.get('prompt', 0)) == 0.0 and float(pricing.get('completion', 0)) == 0.0
                except Exception:
                    is_free = False

                model_package = {"id": m_id, "name": m_name}
                if is_free:
                    free_models_list.append(model_package)
                else:
                    paid_models_list.append(model_package)

            free_models_list.sort(key=lambda x: x['name'])
            paid_models_list.sort(key=lambda x: x['name'])
    except Exception as e:
        print(f"Network log notice: Dynamic model discovery resolution exception: {str(e)}")

    if not free_models_list and not paid_models_list:
        free_models_list = [
            {"id": "google/gemma-2-9b-it:free", "name": "Google: Gemma 2 9B (Free)"},
            {"id": "meta-llama/llama-3-8b-instruct:free", "name": "Meta: Llama 3 8B Instruct (Free)"}
        ]
        paid_models_list = [
            {"id": "openai/gpt-4o-mini", "name": "OpenAI: GPT-4o Mini"}
        ]

    return render_template(
        'dashboard.html',
        api_key=current_user.api_key,
        is_valid=is_valid,
        current_tab=current_tab,
        user=current_user,
        history=user_history,
        total_tests=total_tests,
        avg_wpm=avg_wpm,
        highest_wpm=highest_wpm,
        all_users=all_users,
        total_metrics_logged=total_metrics_logged,
        free_models=free_models_list,
        paid_models=paid_models_list,
        current_model=active_current_model
    )


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        target_user = User.query.filter_by(username=username).first()
        if target_user and check_password_hash(target_user.password, password):
            login_user(target_user)
            flash('Logged in successfully.')
            return redirect(url_for('home'))
        flash('Invalid username or password.')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('All input fields are required to establish an account profile.')
            return render_template('register.html')
        if len(username) < 3:
            flash('Your username must be at least 3 characters long.')
            return render_template('register.html')
        if not re.match(r'^\w+$', username):
            flash('Usernames can only contain alphanumeric characters.')
            return render_template('register.html')
        if len(password) < 8:
            flash('Password must be at least 8 characters long.')
            return render_template('register.html')
        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            flash('Password must include a mixture of both letters and numeric digits.')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Username already exists.')
            return render_template('register.html')

        try:
            hashed_password = generate_password_hash(password)
            new_user = User(username=username, password=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user)
            flash('Registration successful!')
            return redirect(url_for('home'))
        except Exception as e:
            db.session.rollback()
            flash(f"Remote registration sequence error: {str(e)}")

    return render_template('register.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.')
    return redirect(url_for('login'))


@app.route('/leaderboard')
@login_required
def leaderboard():
    try:
        # 1. Fetch the absolute highest speed achieved per distinct user account
        subquery = db.session.query(
            TypingResult.user_id,
            func.max(TypingResult.speed_wpm).label('max_wpm')
        ).group_by(TypingResult.user_id).subquery()

        # 2. Extract full run profiles matching those historical personal records
        top_results = db.session.query(
            User.username,
            TypingResult.speed_wpm,
            TypingResult.accuracy,
            TypingResult.score,
            TypingResult.tier_status
        ).join(TypingResult, User.id == TypingResult.user_id) \
         .join(subquery, (TypingResult.user_id == subquery.c.user_id) & (TypingResult.speed_wpm == subquery.c.max_wpm)) \
         .order_by(TypingResult.speed_wpm.desc()) \
         .limit(10).all()

        # Convert query rows into structured structures that Jinja template matches easily
        global_top_runs = []
        for row in top_results:
            global_top_runs.append({
                'username': row.username,
                'speed_wpm': row.speed_wpm,
                'accuracy': row.accuracy,
                'score': row.score,
                'tier_status': row.tier_status
            })

        # 3. Calculate individual milestones across metrics for the current session user
        pb_wpm = db.session.query(func.max(TypingResult.speed_wpm)).filter(TypingResult.user_id == current_user.id).scalar() or 0
        pb_acc = db.session.query(func.max(TypingResult.accuracy)).filter(TypingResult.user_id == current_user.id).scalar() or "0%"
        pb_score = db.session.query(func.max(TypingResult.score)).filter(TypingResult.user_id == current_user.id).scalar() or "0/100"

        # 4. Pull the most recent 15 attempts logged by this user for the history list
        personal_history = TypingResult.query.filter_by(user_id=current_user.id).order_by(TypingResult.id.desc()).limit(15).all()

        return render_template(
            'leaderboard.html',
            global_top=global_top_runs,
            pb_wpm=pb_wpm,
            pb_acc=pb_acc,
            pb_score=pb_score,
            history=personal_history
        )

    except Exception as e:
        print(f"❌ Leaderboard query sequence failure: {e}")
        traceback.print_exc()
        return render_template('leaderboard.html', global_top=[], pb_wpm=0, pb_acc="0%", pb_score="0/100", history=[])


@app.route('/api/generate_memory', methods=['GET'])
@login_required
def generate_memory():
    """Return a sentence tailored for memory mode.
       Query param: difficulty (1=easy,2=medium,3=hard,4=long)
    """
    difficulty = int(request.args.get('difficulty', '1'))
    # If you modify backend.backend_generate to accept memory_mode, pass it; otherwise reuse difficulty mapping:
    user_api_key = current_user.api_key
    # If backend_generate accepts memory_mode: backend_generate(user_api_key, difficulty, memory_mode=True)
    sentence = backend_generate(user_api_key, difficulty)  # you may want to update backend_generate to return shorter sentences for memory mode
    return jsonify({"sentence": sentence})

@app.route('/api/submit_memory', methods=['POST'])
@login_required
def submit_memory():
    """
    Accepts JSON:
    { "original_sentence": "...", "recalled_sentence": "...", "time_shown": seconds, "recall_time": seconds, "difficulty": n }
    Returns JSON: { accuracy, score, mistakes: [ {position, entered, correct} ], levenshtein_ratio }
    """
    data = request.get_json() or {}
    orig = data.get('original_sentence', '').strip()
    recalled = data.get('recalled_sentence', '').strip()

    # Fallback validation
    if not orig:
        return jsonify({"error": "No original_sentence provided"}), 400

    # Character-level similarity using difflib
    seq = difflib.SequenceMatcher(a=orig, b=recalled)
    ratio = seq.ratio()  # 0..1
    accuracy_pct = round(ratio * 100, 2)

    # Word-level mistake extraction (simple positional comparison)
    orig_words = orig.split()
    rec_words = recalled.split()
    mistakes = []
    max_len = max(len(orig_words), len(rec_words))
    for i in range(max_len):
        o = orig_words[i] if i < len(orig_words) else None
        r = rec_words[i] if i < len(rec_words) else None
        if o != r:
            mistakes.append({"position": i, "entered": r, "correct": o})

    # Scoring: you can tune this formula
    # base score = accuracy_pct, penalize missing/extra words
    penalty = len(mistakes) * 1.5  # each mistake reduces score
    score = max(0, int(round(accuracy_pct - penalty)))

    return jsonify({
        "accuracy": accuracy_pct,
        "score": score,
        "mistakes": mistakes,
        "lev_ratio": ratio
    })



if __name__ == '__main__':
    app.run(debug=True)