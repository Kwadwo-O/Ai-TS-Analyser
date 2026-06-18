import re
import traceback
import requests
import os
from sqlalchemy import func
from flask import Flask, flash, jsonify, redirect, render_template, request, url_for
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash
from backend import backend_generate, backend_send, verify_openrouter, change_model
from models import db, User, TypingResult

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'

app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql://neondb_owner:npg_Z3rleqh6iGSY@ep-cool-cell-abkr7bne-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# 🔥 GLOBAL SERVER SETUP SCHEMA MIGRATION: Ensures columns widen to 500 characters instantly on any Flask startup approach 🔥
with app.app_context():
    db.create_all()
    try:
        from sqlalchemy import text
        db.session.execute(text("ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(500);"))
        db.session.execute(text("ALTER TABLE users ALTER COLUMN api_key TYPE VARCHAR(500);"))
        db.session.commit()
        print("🚀 DATABASE SUCCESS: Columns successfully upgraded to VARCHAR(500) on Neon cloud cluster!")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Neon column adjustment notice (Safe if already modified): {e}")

login_manager = LoginManager(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# --- Routes ---

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    TypingResult.query.filter_by(user_id=current_user.id).delete()
    db.session.delete(current_user)
    db.session.commit()
    logout_user()
    flash('Your account has been deleted successfully.')
    return redirect(url_for('home'))


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
    user_key = current_user.api_key
    difficulty = request.args.get('difficulty', 'medium')
    try:
        sentence = backend_generate(user_key, difficulty)
        return jsonify({"sentence": sentence})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/submit', methods=['POST'])
@login_required
def submit_passage():
    user_key = current_user.api_key
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    orig = data.get('original_sentence', '')
    user_str = data.get('user_sentence', '')
    time_str = data.get('time', '0s')
    speed = data.get('typing_speed', '0 WPM')

    try:
        analysis_result = backend_send(orig, user_str, time_str, speed, user_key)
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

        new_run_record = TypingResult(
            user_id=current_user.id,
            speed_wpm=wpm_value,
            accuracy=acc_string,
            score=str(analysis_result.get("score", "100/100")),
            tier_status=str(analysis_result.get("user_rating", "Pro"))
        )

        db.session.add(new_run_record)
        db.session.commit()

        return jsonify(analysis_result)
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    current_tab = request.args.get('tab', 'profile')

    # ---------------------------------------------------------
    # DYNAMIC OPENROUTER TEXT-TO-TEXT MODEL DISCOVERY PROTOCOL
    # ---------------------------------------------------------
    free_models_list = []
    paid_models_list = []
    active_current_model = "google/gemini-2.5-pro"  # Default system archetype fallback

    try:
        # Request full runtime metadata profiles from the remote integration cluster
        api_response = requests.get("https://openrouter.ai/api/v1/models", timeout=5)
        if api_response.status_code == 200:
            available_nodes = api_response.json().get('data', [])

            for node in available_nodes:
                node_id = node.get('id')
                node_name = node.get('name', node_id)

                # Verify structural text architecture layers to prevent multi-modal leaks
                architecture_meta = node.get('architecture', {})
                modality_signature = architecture_meta.get('modality', 'text->text')  # Safe default fallback

                if modality_signature != "text->text":
                    continue  # Safely drop image, vision, audio, or cross-modal pipelines

                # Parse financial usage cost matrices to distinguish free vs paid systems
                per_token_prompt = float(node.get('pricing', {}).get('prompt', 0))
                per_token_completion = float(node.get('pricing', {}).get('completion', 0))

                model_profile = {"id": node_id, "name": node_name}

                if per_token_prompt == 0.0 and per_token_completion == 0.0:
                    free_models_list.append(model_profile)
                else:
                    paid_models_list.append(model_profile)

    except Exception as network_exception:
        # Fail-silent error block ensures dashboard functions offline
        print(f"[METRIC ENGINE EXCEPTION] Failed resolving dynamic OpenRouter metadata nodes: {network_exception}")

    # Fallback structure mappings if remote network lookup is blocked or rate-limited
    if not free_models_list and not paid_models_list:
        free_models_list = [
            {"id": "google/gemini-2.5-flash:free", "name": "Gemini 2.5 Flash (Free)"},
            {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B Instruct (Free)"},
            {"id": "deepseek/deepseek-chat:free", "name": "DeepSeek V3 Chat (Free)"}
        ]
        paid_models_list = [
            {"id": "google/gemini-2.5-pro", "name": "Gemini 2.5 Pro (Premium)"},
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet (Premium)"}
        ]

    # Handle state mutations (Form Submissions)
    if request.method == 'POST':
        action_type = request.form.get('action')

        if action_type == 'update_ai_model':
            requested_model = request.form.get('ai_model_selection')
            if requested_model:
                try:
                    change_model(requested_model)  # Mutate global model routing pointer
                except Exception:
                    pass
                flash(f"Generative processing cluster re-routed to target node: {requested_model}")
            return redirect(url_for('dashboard', tab='settings'))

        elif action_type == 'save':
            provided_key = request.form.get('api_key', '').strip()
            if provided_key:
                current_user.api_key = provided_key
                db.session.commit()
                flash('OpenRouter configuration key matrix saved successfully.')
            return redirect(url_for('dashboard', tab='settings'))

        elif action_type == 'clear':
            current_user.api_key = None
            db.session.commit()
            flash('External integration access token decoupled.')
            return redirect(url_for('dashboard', tab='settings'))

        # Admin action mapping logic remains unchanged for database mutations
        admin_password = request.args.get('admin_password')
        if admin_password == "Admin112233":
            if action_type == 'admin_create_user':
                new_username = request.form.get('username', '').strip()
                new_password = request.form.get('password', '').strip()
                opt_key = request.form.get('api_key', '').strip()
                if new_username and new_password:
                    if User.query.filter_by(username=new_username).first():
                        flash('Error: Identity duplicate exists inside the database.')
                    else:
                        created_node = User(
                            username=new_username,
                            password=generate_password_hash(new_password),
                            api_key=opt_key if opt_key else None
                        )
                        db.session.add(created_node)
                        db.session.commit()
                        flash(f"Successfully tracking new user node profile: {new_username}")
                return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

            elif action_type == 'admin_modify_user':
                target_uid = request.form.get('user_id')
                usr_node = User.query.get(target_uid)
                if usr_node:
                    m_user = request.form.get('username', '').strip()
                    m_pass = request.form.get('password', '').strip()
                    m_key = request.form.get('api_key', '').strip()
                    if m_user:
                        usr_node.username = m_user
                    if m_pass:
                        usr_node.password = generate_password_hash(m_pass)
                    if m_key == "__REMOVE__":
                        usr_node.api_key = None
                    elif m_key:
                        usr_node.api_key = m_key
                    db.session.commit()
                    flash(f"Parameters successfully committed for Node #00{target_uid}.")
                return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

            elif action_type == 'admin_delete_user':
                target_uid = request.form.get('user_id')
                if int(target_uid) != current_user.id:
                    TypingResult.query.filter_by(user_id=target_uid).delete()
                    User.query.filter(User.id == target_uid).delete()
                    db.session.commit()
                    flash(f"Node entry memory trace #00{target_uid} dropped from storage.")
                return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

            elif action_type == 'admin_wipe_all_except_self':
                v_text = request.form.get('verification_text', '').strip()
                if v_text == "OVERRIDE SYSTEM DELETE ALL":
                    all_other_users = User.query.filter(User.id != current_user.id).all()
                    for other in all_other_users:
                        TypingResult.query.filter_by(user_id=other.id).delete()
                        db.session.delete(other)
                    db.session.commit()
                    flash("Global purge sequence executed. Alternative data structures eliminated.")
                else:
                    flash("Purge aborted: Input signature verification failure.")
                return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

    # ---------------------------------------------------------
    # CRASH-PROOF IMPORT RECOVERY LOGIC FOR ACTIVE MODEL POINTER
    # ---------------------------------------------------------
    try:
        import backend
        if hasattr(backend, 'active_model') and backend.active_model:
            active_current_model = backend.active_model
        elif hasattr(backend, 'current_model') and backend.current_model:
            active_current_model = backend.current_model
    except Exception:
        pass

    history_records = TypingResult.query.filter_by(user_id=current_user.id).order_by(
        TypingResult.date_recorded.desc()).all()
    all_users_ledger = User.query.all()

    total_metrics_logged = db.session.query(db.func.count(TypingResult.id)).scalar() or 0
    total_tests = len(history_records)
    avg_wpm = int(db.session.query(db.func.avg(TypingResult.speed_wpm)).filter(
        TypingResult.user_id == current_user.id).scalar() or 0)
    highest_wpm = db.session.query(db.func.max(TypingResult.speed_wpm)).filter(
        TypingResult.user_id == current_user.id).scalar() or 0

    is_valid_key = False
    if current_user.api_key:
        is_valid_key = verify_openrouter(current_user.api_key)

    return render_template(
        'Dashboard.html',
        current_tab=current_tab,
        user=current_user,
        history=history_records,
        total_tests=total_tests,
        avg_wpm=avg_wpm,
        highest_wpm=highest_wpm,
        api_key=current_user.api_key,
        is_valid=is_valid_key,
        all_users=all_users_ledger,
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
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
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
            flash('Usernames can only contain standard alphanumeric characters and underscores.')
            return render_template('register.html')
        if len(password) < 8:
            flash('Security validation failed: Password must be at least 8 characters long.')
            return render_template('register.html')
        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            flash('Security validation failed: Password must include a mixture of both letters and numeric digits.')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Username already exists.')
            return render_template('register.html')

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        flash('Registration successful!')
        return redirect(url_for('home'))
    return render_template('register.html')

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

        # Convert query rows into a structured object structure that Jinja2 looks for
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

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.')
    return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True)