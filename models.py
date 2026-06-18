from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    # Increased to 500 to handle modern secure scrypt password hashes safely
    password = db.Column(db.String(500), nullable=False)
    api_key = db.Column(db.String(500), nullable=True)


class TypingResult(db.Model):
    __tablename__ = 'typing_results'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    speed_wpm = db.Column(db.Integer, nullable=False)
    accuracy = db.Column(db.String(10), nullable=False)
    score = db.Column(db.String(20), nullable=False)
    tier_status = db.Column(db.String(30), nullable=False)
    date_recorded = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('results', cascade='all, delete-orphan'))