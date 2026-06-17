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


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        # 1. Presence Validation
        if not username or not password:
            flash('All input fields are required to establish an account profile.')
            return redirect(url_for('register'))

        # 2. Username Length Check
        if len(username) < 3:
            flash('Your username must be at least 3 characters long.')
            return redirect(url_for('register'))

        # 3. Username Format Character Constraints
        if not re.match(r'^\w+$', username):
            flash('Usernames can only contain standard alphanumeric characters and underscores.')
            return redirect(url_for('register'))

        # 4. Password Length Check
        if len(password) < 8:
            flash('Security validation failed: Password must be at least 8 characters long.')
            return redirect(url_for('register'))

        # 5. Password Complexity Requirements (Letters + Numbers)
        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            flash('Security validation failed: Password must include a mixture of both letters and numeric digits.')
            return redirect(url_for('register'))

        # 6. Uniqueness Check against Database
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

    # Security check for Admin access
    if current_tab == 'admin':
        password_attempt = request.form.get('admin_password') or request.args.get('admin_password')
        if password_attempt != "Admin112233":
            flash("Security error: Access Denied. Administrative verification credentials missing or incorrect.")
            return redirect(url_for('dashboard', tab='profile'))

    if request.method == 'POST':
        action = request.form.get('action')
        target_tab = request.args.get('tab', 'profile')

        # --- Standard User Dashboard Form Actions ---
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

        # --- Administrative Operations Suite ---
        elif action == 'admin_create_user':
            new_username = request.form.get('username', '').strip()
            new_password = request.form.get('password', '')
            new_api_key = request.form.get('api_key', '').strip() or None

            # 1. Presence Validation
            if not new_username or not new_password:
                flash('All input fields are required to establish an account profile.')

            # 2. Username Length Check
            elif len(new_username) < 3:
                flash('Your username must be at least 3 characters long.')

            # 3. Username Format Character Constraints
            elif not re.match(r'^\w+$', new_username):
                flash('Usernames can only contain standard alphanumeric characters and underscores.')

            # 4. Password Length Check
            elif len(new_password) < 8:
                flash('Security validation failed: Password must be at least 8 characters long.')

            # 5. Password Complexity Requirements (Letters + Numbers)
            elif not any(char.isdigit() for char in new_password) or not any(char.isalpha() for char in new_password):
                flash('Security validation failed: Password must include a mixture of both letters and numeric digits.')

            # 6. Uniqueness Check against Database
            elif User.query.filter_by(username=new_username).first():
                flash('Operation error: A user with that identifier already exists.')

            # 7. Safe Database Execution Block
            else:
                try:
                    hashed_pw = generate_password_hash(new_password)
                    created_user = User(username=new_username, password=hashed_pw, api_key=new_api_key)
                    db.session.add(created_user)
                    db.session.commit()
                    flash(f'Account node profile "{new_username}" successfully appended to database layer.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Database node instantiation failure: {str(e)}')

            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_modify_user':
            target_id = request.form.get('user_id')
            mod_username = request.form.get('username', '').strip()
            mod_password = request.form.get('password', '')
            mod_api_key = request.form.get('api_key', '').strip()

            target_account = User.query.get(target_id)
            if target_account:
                try:
                    # Apply validations to modified parameters if modifications are sent
                    if mod_username:
                        if len(mod_username) < 3:
                            flash('Update error: Your username must be at least 3 characters long.')
                            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))
                        if not re.match(r'^\w+$', mod_username):
                            flash(
                                'Update error: Usernames can only contain standard alphanumeric characters and underscores.')
                            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

                        # Check collision if changing to a different user name
                        if mod_username != target_account.username and User.query.filter_by(
                                username=mod_username).first():
                            flash('Update error: A user with that identifier already exists.')
                            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

                        target_account.username = mod_username

                    if mod_password:
                        if len(mod_password) < 8:
                            flash('Update failed: Password must be at least 8 characters long.')
                            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))
                        if not any(char.isdigit() for char in mod_password) or not any(
                                char.isalpha() for char in mod_password):
                            flash('Update failed: Password must include a mixture of both letters and numeric digits.')
                            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

                        target_account.password = generate_password_hash(mod_password)

                    if mod_api_key == "__REMOVE__":
                        target_account.api_key = None
                    elif mod_api_key:
                        target_account.api_key = mod_api_key

                    db.session.commit()
                    flash(f'Database parameters updated for profile target Node #{target_id}.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Mutation error encountered processing user changes: {str(e)}')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_delete_user':
            target_id = request.form.get('user_id')
            if int(target_id) == current_user.id:
                flash('Security Violation: The active operator instance session cannot be deleted.')
            else:
                target_account = User.query.get(target_id)
                if target_account:
                    try:
                        TypingResult.query.filter_by(user_id=target_id).delete()
                        db.session.delete(target_account)
                        db.session.commit()
                        flash(f'Account configuration sequence mapping #{target_id} severed successfully.')
                    except Exception as e:
                        db.session.rollback()
                        flash(f'Error processing account drop: {str(e)}')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        elif action == 'admin_wipe_all_except_self':
            confirm_phrase = request.form.get('verification_text', '').strip()
            if confirm_phrase == 'OVERRIDE SYSTEM DELETE ALL':
                try:
                    all_other_users = User.query.filter(User.id != current_user.id).all()
                    count = 0
                    for u in all_other_users:
                        TypingResult.query.filter_by(user_id=u.id).delete()
                        db.session.delete(u)
                        count += 1
                    db.session.commit()
                    flash(f'Global wipe execute clear. Dropped {count} alternate operational accounts.')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Critical processing structural error: {str(e)}')
            else:
                flash('Verification failed! Nuclear sequence abort.')
            return redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))

        return redirect(url_for('dashboard', tab=target_tab))

    # --- Data Resolution and Template Preparation ---
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

    # Resolution vectors specifically for the Admin dashboard
    all_users = []
    total_metrics_logged = 0
    if current_tab == 'admin':
        all_users = User.query.order_by(User.id.asc()).all()
        total_metrics_logged = TypingResult.query.count()

    return render_template(
        'dashboard.html',
        api_key=db_user.api_key,
        is_valid=is_valid,
        current_tab=current_tab,
        user=db_user,
        history=user_history,
        total_tests=total_tests,
        avg_wpm=avg_wpm,
        highest_wpm=highest_wpm,
        all_users=all_users,
        total_metrics_logged=total_metrics_logged
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