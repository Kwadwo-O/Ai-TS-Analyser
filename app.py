from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def Home():
    # Serves the single-page application framework
    return render_template("Home.html")




if __name__ == "__main__":
    # Runs the local development server in debug mode
    app.run()