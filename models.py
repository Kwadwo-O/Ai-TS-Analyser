from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    api_key = db.Column(db.String(150), nullable=True)


class TypingResult(db.Model):
    __tablename__ = 'typing_results'

    id = db.Column(db.Integer, primary_key=True)
    # Connects securely to the users table and auto-deletes history records if the profile is destroyed
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    speed_wpm = db.Column(db.Integer, nullable=False)
    accuracy = db.Column(db.String(10), nullable=False)
    score = db.Column(db.String(20), nullable=False)
    tier_status = db.Column(db.String(30), nullable=False)
    date_recorded = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship linking back to the primary User model
    user = db.relationship('User', backref=db.backref('typing_runs', lazy=True, cascade="all, delete-orphan"))