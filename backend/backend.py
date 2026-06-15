"""
this is the backend
it uses openrouteservice api
it generates the sentence fot the typing speed test,
and it also sends the results to the AI to decode
"""

import requests
import json

URL = "https://openrouter.ai/api/v1/key"
MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"

API_KEY = ("sk-or-v1-"
           "817b25c971cdfe90b3847536e74b3bbcba48c5ddc85ea023b5d93f3b54c7cb0f")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://localhost:3000",
    "X-Title": "Typing Speed Test Backend"
}

Analysis_prompt = "analise this data"


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

def verify_openrouter():
    #Checks if the API key is valid.
    url = "https://openrouter.ai/api/v1/key"
    response = requests.get(url, headers=HEADERS)
    return response.status_code == 200


def backend_generate():
    prompt = """Generate a random sentence for a typing speed test. 
    the sentence should be between 10 and 20 words long. 
    The sentence should be grammatically correct and should not contain any special characters or numbers.
    The sentence should be in English.
    The sentence should be unique and not a common phrase or idiom.
    The sentence should have accurate punctuation like commas."""
    data = send_data(prompt)
    return data

def backend_send(original_sentence, user_sentence, time, typing_speed, accuracy):
    prompt = "Generate a random sentence for a typing speed test."
    data = send_data()
    data = data.json()
    return data



if __name__ == "__main__":
    data = backend_generate()
    print(data)
    exit()
    print("Verifying API Key...")
    if verify_openrouter():
        print("Key is valid! Sending prompt...")

        test_prompt = "this is a test prompt can you return True of this works and False if it does not work"
        ai_reply = send_data(API_KEY,test_prompt)

        print("\nAI Response:")
        print(ai_reply)
    else:
        print("Verification failed. Please check your API key.")