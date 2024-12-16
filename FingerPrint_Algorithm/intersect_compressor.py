import json
import numpy as np

def intersect_compressor(data):
    def intersection_over_union(arr1, arr2):
        # Using set operations for calculating IOU
        set1, set2 = set(arr1), set(arr2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union

    def merge_arrays(arr1, arr2):
        # Merging by using set union operation
        return list(set(arr1) | set(arr2))

    result = {}
    for key, arrays in data.items():
        n = len(arrays)
        
        # Precompute set versions of arrays for faster intersection/union calculations
        sets = [set(arr) for arr in arrays]
        
        # Initialize the result arrays and an array of merge flags to avoid unnecessary merging
        merged_flags = np.zeros(n, dtype=bool)
        
        for i in range(n):
            for j in range(i + 1, n):
                iou = intersection_over_union(arrays[i], arrays[j])
                if iou > 0.9:


                    print(f"Compressing {key} {i}:{j} IOU:{iou}")
                    # If they should merge, do so only once
                    if len(arrays[i]) < len(arrays[j]) and not merged_flags[i]:
                        arrays[j] = merge_arrays(arrays[i], arrays[j])
                        merged_flags[j] = True
                    elif len(arrays[i]) >= len(arrays[j]) and not merged_flags[j]:
                        arrays[i] = merge_arrays(arrays[i], arrays[j])
                        merged_flags[i] = True

        result[key] = arrays
    return result

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

print("Begin Intersection Compression..")
# Process the data with intersect_compressor
processed_data = intersect_compressor(glossary_data)

print("Done!")
print("Saving intersection compression...")
# Save the modified data back to the JSON file
save_glossary_to_json(processed_data, file_path)

print(f"Data has been processed and saved back to {file_path}.")
