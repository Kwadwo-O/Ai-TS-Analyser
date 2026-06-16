"""
this is the backend
it uses openrouteservice api
it generates the sentence fot the typing speed test,
and it also sends the results to the AI to decode
"""

import requests
import json

MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
API_KEY = ""
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-Title": "Typing Speed Test Backend"
}

def send_data(data):
    url = "https://openrouter.ai/api/v1/chat/completions"
    data = {
        "model": MODEL,  # You can change this to any OpenRouter model slug
        "messages": [{"role": "user", "content": data}]
    }
    response = requests.post(url, headers=HEADERS, json=data)
    if response.status_code == 200:
        return response.json()["choices"][0]["message"]["content"]
    else:
        return f"Error: {response.status_code} - {response.text}"

def verify_openrouter(api_key: str = API_KEY):
    """Pings the OpenRouter API key status endpoint to check if it is valid.
        Returns True if valid, False if invalid or if a connection error occurs.
    """
    url = "https://openrouter.ai/api/v1/key"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    try:
        # Send a GET request with a 5-second timeout to prevent freezing
        response = requests.get(url, headers=headers, timeout=5)
        # A status code of 200 means the key is completely valid
        if response.status_code == 200:
            print("Key is valid")
            return True
        else:
            print(f"API Key is invalid. Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except requests.RequestException as e:
        print(f"📡 Connection error occurred: {e}")
        return False



def backend_generate():
    prompt = """
    Generate a random sentence for a typing speed test. 
    the sentence should be between 10 and 20 words long. 
    The sentence should be grammatically correct and should not contain any special characters or numbers.
    The sentence should be in English.
    The sentence should be unique and not a common phrase or idiom.
    The sentence should have accurate punctuation like commas.
    Avoid inappropriate or sensitive sentences.
    Avoid hard words to type.
    """
    data = send_data(prompt)
    return data

def backend_send(original_sentence, user_sentence, time, typing_speed):
    prompt = f"""
    using this original sentence:{original_sentence}
    use this user typed sentence: {user_sentence}
    the time taken for the sentence: {time}
    use this typing speed: {typing_speed}
    analise this data and give accurate data.
    give me the data in json format:
    (
      "text_analysis": (), # analysis of the typing speed make it detailed and stated the user (just text) like in text give description 
      "user_rating": (), the rating of the user like average, beginner or pro ect
      "score": (), # the users score out of 100%
      "accuracy": (), # how accurate the user is out of 100
      "mistakes": [
        "correct word": "incorrect word"
      ], add the word they wrote wrong and the correct spelling correct word in the first stretchmarks and incorrect for the second brackets if no mistake is made do not return anything
    )
    """
    data = send_data(prompt).strip("```json")

    if '"error"' in data:
        return "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day"
    else:
        data = json.loads(data)
        print(f"""response:{data["text_analysis"]}
        user rating:{data["user_rating"]}
        score: {data["score"]}/100%
        accuracy: {data["accuracy"]}/100""")



if __name__ == "__main__":
    backend_send("The quiet library held many old books, and students read them carefully.",
                 "The quiet library held namy old books and students reed them carefuly.", 20, "20wpm")
    # data = backend_generate()
    # print(data)
    print("Verifying API Key...")
    if verify_openrouter():
        print("Key is valid! Sending prompt...")

        test_prompt = "this is a test prompt can you return True of this works and False if it does not work"
        ai_reply = send_data(API_KEY,test_prompt)

        print("\nAI Response:")
        print(ai_reply)
    else:
        print("Verification failed. Please check your API key.")