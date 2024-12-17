import glossary_compression

# Example usage
entries = [
    ['apple', 'fruit', 'red', 'sweet'],
    ['apple', 'fruit', 'green', 'sour'],
    ['banana', 'fruit', 'yellow', 'sweet'],
    ['banana', 'fruit', 'yellow', 'sweet', 'tropical']
]

compressed_entries = glossary_compression.compress_glossary_entries('fruit', entries)

print(compressed_entries)

import cProfile
cProfile.run("""glossary_compression.compress_glossary_entries('fruit', entries)""")
