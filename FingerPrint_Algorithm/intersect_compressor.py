import json

import time
from glossary_compression import  efficient_overlap_and_merge, compress_glossary_entries
import cProfile
def intersect_compressor(data):
    # Iterate through the data and compress each glossary entry
    i=0
    complete_start = time.time()
    for keyword in data:
        start = time.time()
        data[keyword] = compress_glossary_entries(keyword, data[keyword],0.9)
        print(f"{i} : {time.time()-start}")
        i+=1

    print(f"End of end: {time.time() - complete_start}")
    return data  # Ensure the modified data is returned

def load_glossary_from_json(file_path):
    # Load glossary data from a JSON file
    with open(file_path, 'r') as file:
        glossary_data = json.load(file)
    return glossary_data

def save_glossary_to_json(data, file_path):
    # Save the modified glossary data back to a JSON file
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=4)  # Use indent for pretty printing

    
# Load the glossary data from glossary.json
file_path = 'glossary.json'  # Update this path if necessary
glossary_data = load_glossary_from_json(file_path)

def main():

    print("Begin Intersection Compression..")
    # Process the data with intersect_compressor
    processed_data = intersect_compressor(glossary_data)

    print("Done!")
    print("Saving intersection compression...")
    # Save the modified data back to the JSON file
    save_glossary_to_json(processed_data, "compressed_"+file_path)

cProfile.run('main()')
print(f"Data has been processed and saved back to {file_path}.")
