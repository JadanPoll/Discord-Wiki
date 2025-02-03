from pinecone import Pinecone, ServerlessSpec
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModel

pc = Pinecone(api_key="")

namespace="ECE 120 Fall 2024 exams"
index_name = "rag-test"

def load_messages_from_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = json.load(file)
        return content


if not pc.has_index(index_name):
    pc.create_index(
        name=index_name,
        dimension=1024, # Replace with your model dimensions
        metric="cosine", # Replace with your model metric
        spec=ServerlessSpec(
            cloud="aws",
            region="us-east-1"
        ) 
    )

file_path = '/Users/shubhan/Discord-Wiki/FingerPrint_Algorithm/DiscServers/ECE 120 Fall 2024 - exams - mt3 [1275789619954323534].json'
index = pc.Index(index_name)
data = load_messages_from_json(file_path)

user_query = input("Enter your query: ")

def get_response(user_query):
    # Generate embedding for the user query
    x = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[user_query],
        parameters={
            "input_type": "passage"
        }
    )
    # Query Pinecone for similar messages (retrieve the top 5 closest matches)
    results = index.query(
        namespace=namespace,
        vector=x[0].values,
        top_k=5,
        include_values=False,
        include_metadata=True
    )

    # Retrieve the most relevant response (based on matching content)
    responses = []
    for match in results['matches']:
        message_id = match['id']
        # Find the corresponding message in the chat_data
        matched_message = next(item for item in data if item['id'] == message_id)
        responses.append(matched_message['content'])

    # Return the most relevant response
    return responses[0:]  # Or apply additional ranking logic
    #return results

results = get_response(user_query)
print(results)

# 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

import json
results_string = results[0]
for i in results[1:]:
    results_string += ", "
    results_string += i
contents = "Make a paragraph summary from these words: " + results_string
print(contents)

from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="",
)

completion = client.chat.completions.create(
  extra_headers={
    "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai.
  },
  model="deepseek/deepseek-r1:free",
  messages=[
    {
      "role": "user",
      "content": contents
    }
  ]
)
print(completion)
#print(completion.choices[0].message.content)

# Enter your query: circuit
# ['capacitor', 'Input', 'mt3', 'condition code', 'alr']
# Make a paragraph summary from these words: capacitor, Input, mt3, condition code, alr
# [Choice(finish_reason='stop', index=0, logprobs=None, 
# message=ChatCompletionMessage(content="The capacitor in the **MT3** system plays a critical role in stabilizing and regulating 
# the **input** voltage to ensure efficient energy storage and delivery. The system utilizes a **condition code** to monitor 
# operational parameters, providing real-time feedback on performance and stability. Additionally, **ALR** (Automatic Load Regulation) 
# works in tandem with these components to dynamically adjust power distribution based on demand, optimizing functionality under 
# varying load conditions. Together, these elements enhance the MT3 system's reliability and adaptability in managing electrical 
# inputs and outputs.", refusal=None, role='assistant', audio=None, function_call=None, tool_calls=None), native_finish_reason='stop')]

#Enter your query: capacitor
# ['capacitor', 'np', 'lec 28', 'Input', 'mt3']
# Make a paragraph summary from these words: capacitor, np, lec 28, Input, mt3
# ChatCompletion(id='gen-1738534414-yCSCDWcfVinCE3S9CzyG', choices=[Choice(finish_reason='stop', index=0, logprobs=None, 
# message=ChatCompletionMessage(content="In **Lecture 28 (Lec 28)**, the focus revolves around analyzing the role of a 
# **non-polarized (NP) capacitor** within an **input** circuit configuration, particularly in the context of 
# **Module/System MT3 (MT3)**. The discussion highlights how the NP capacitor stabilizes input signals, filters noise, and ensures 
# efficient energy storage and discharge in MT3's operational framework. This component is critical for maintaining signal integrity 
# and optimizing performance in the designated system or application.", refusal=None, role='assistant', audio=None, function_call=None, tool_calls=None), native_finish_reason='stop')], created=1738534414, model='deepseek/deepseek-r1', object='chat.completion', service_tier=None, system_fingerprint=None, usage=CompletionUsage(completion_tokens=520, prompt_tokens=24, total_tokens=544, completion_tokens_details=None, prompt_tokens_details=None), provider='Chutes')