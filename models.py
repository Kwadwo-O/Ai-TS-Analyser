from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    api_key = db.Column(db.String(150), nullable=True)  # Changed to nullable=True as users start without a key


class TypingResult(db.Model):
    __tablename__ = 'typing_results'

    id = db.Column(db.Integer, primary_key=True)
    # Connects to user.id and clears history logs automatically if user deletes their account
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)

    speed_wpm = db.Column(db.Integer, nullable=False)
    accuracy = db.Column(db.String(10), nullable=False)
    score = db.Column(db.String(20), nullable=False)
    tier_status = db.Column(db.String(30), nullable=False)
    date_recorded = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship linking back to the primary User model
    user = db.relationship('User', backref=db.backref('typing_runs', lazy=True, cascade="all, delete-orphan"))