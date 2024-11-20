from pinecone import Pinecone, ServerlessSpec
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModel

pc = Pinecone(api_key="pcsk_68RpQp_U1uWtNsxDGA7sh6tEVtbQz1kDPprmSogeCr74nRWtBNCNuUkyQQQZnADxtC6fw")

index_name = "rag-test"

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

tfidf_dict = {}
with open('/Users/shubhan/Discord-Wiki/FingerPrint_Algorithm/Physics/Study Together - 💭 Community - general [595999872222756888] (after 2024-11-01)_tfidf.json', 'r', encoding='utf-8') as file:
    tfidf_dict = json.load(file)

tokenizer = AutoTokenizer.from_pretrained("intfloat/e5-large")
model = AutoModel.from_pretrained("intfloat/e5-base-v2")

# Function to generate embeddings
def generate_embedding(text):
    embeddings = pc.inference.embed("multilingual-e5-large",
        inputs=text,
        parameters={
            "input_type": "passage"
        }
    )  # Average over all tokens

    return embeddings

def load_messages_from_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = json.load(file)
        return content
        # Collect all messages in the "messages" array with content
        #return " ".join([msg.get("content", "") for msg in data if "content" in msg])
        # Generate embedding for the message content

data = load_messages_from_json(file_path)
namespace="ECE 120 Fall 2024 exams"

for i, entry in enumerate(data):
    content = entry["content"]
    
    # Generate embedding for the message content
    content_embedding = generate_embedding(content)
    
    vectors = []
    for d, e in zip(data, content_embedding):
        vectors.append({
            "id": entry['id'],
            "values": e['values'],
            "metadata": {'text': entry['content']}
        })
    # Insert into Pinecone using the message id
    index.upsert(vectors=vectors, namespace="ECE 120 Fall 2024 exams")

user_query = input("Enter your query: ")

def get_response(user_query):
    # Generate embedding for the user query
    x = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[user_query],
        parameters={
            "input_type": "query"
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
    return responses[0]  # Or apply additional ranking logic

print(get_response(user_query))