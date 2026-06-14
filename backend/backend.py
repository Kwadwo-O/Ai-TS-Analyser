import requests
import os
import json


#this is the backend
#it uses openrouteservice api
#it generates the sentence fot the typing speed test
#and it also sends the results to the ai to decode


def verify_openrouter() -> bool:
    """
    Pings OpenRouter using a free model to verify the API setup.
    Returns True if successful. Raises an exception (crashes) if it fails.
    """
    url = "https://openrouter.ai/api/v1/chat/completions"
    api_key = os.environ.get("OPENROUTER_API_KEY")

    # 1. Crash if the environment variable is missing completely
    if not api_key:
        raise ValueError(
            "❌ CRASH: 'OPENROUTER_API_KEY' environment variable is not set.\n"
            "Please set it in your terminal using: export OPENROUTER_API_KEY='your_key'"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "openrouter/free",
        "messages": [
            {"role": "user", "content": "ping"}
        ],
        "max_tokens": 5
    }

    try:
        # 2. Make the network request
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)

        # 3. Crash if the HTTP status code is not 200 (e.g., 401 Unauthorized, 404 Not Found)
        if response.status_code != 200:
            raise RuntimeError(
                f"❌ CRASH: OpenRouter API returned an error status code: {response.status_code}\n"
                f"Response body: {response.text}"
            )

        # 4. Try to parse the response to ensure it's valid JSON and has the expected structure
        result = response.json()
        _ = result["choices"][0]["message"]["content"]

        # If we made it here, everything works perfectly!
        return True

    except requests.exceptions.RequestException as e:
        # 5. Crash if there is a network timeout, DNS issue, or connection drop
        raise ConnectionError(f"❌ CRASH: Network communication failed.\nDetails: {e}")

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        # 6. Crash if the API returned invalid data structure
        raise ValueError(f"❌ CRASH: OpenRouter returned an unexpected data structure.\nDetails: {e}")


def backend_generate(api_key):


def backend_send(api_key, original_sentence, user_sentence, time):