from flask import Flask, render_template

app = Flask(__name__, template_folder='templates', static_url_path='/', static_folder='static')

@app.route("/")
def main():
    return render_template('frontpage.html')

@app.route('/visualize')
def visualize():
    return render_template('visualize/index.html', group='dev')

@app.route("/visualize/download_messages")
def dl_msg():
    return render_template('visualize/download/download_messages.html', group='dev')

@app.route("/visualize/live_server_update")
def live_update():
    return render_template('visualize/download/live_server_update.html', group='dev')

@app.route('/visualize/wordcloud')
def wordcloud():
    return render_template('visualize/wordcloud.html', group='dev')

@app.route('/visualize/plot_useractivity')
def plot_useractivity():
    return render_template('visualize/plot_useractivity.html', group='dev')

@app.route('/visualize/plot_timestamp_density')
def plot_timestamp_activity():
    return render_template('visualize/plot_timestamp_density.html', group='dev')

@app.route('/visualize/plot_textdensity_user')
def plot_textdensity_user():
    return render_template('visualize/plot_textdensity_user.html', group='dev')

@app.route('/visualize/plot_general_density')
def plot_general_density():
    return render_template('visualize/plot_general_density.html', group='dev')

@app.route('/storyboard')
def storyboard():
    return render_template('storyboard/storyboard.html', group='story')

@app.route('/content')
def content():
    return render_template('content/content.html', group='content')

@app.route('/character')
def character():
    return render_template('character/content.html', group='char')

if __name__ == "__main__":
    print("Nathan Hello WOrld")
    app.run(host='0.0.0.0', port=3000)  # Use 3000 or the port specified by your host
