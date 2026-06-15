from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def Home():
    # Serves the single-page application framework
    return render_template("Home.html")

@app.route("/login")
def Login():
    # Serves the single-page application framework
    return render_template("Login.html")

@app.route("/register")
def Register():
    # Serves the single-page application framework
    return render_template("Register.html")

@app.route("/play")
def Play():
    # Serves the single-page application framework
    return render_template("Play.html")


if __name__ == "__main__":
    # Runs the local development server in debug mode
    app.run()