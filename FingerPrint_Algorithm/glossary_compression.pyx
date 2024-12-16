# cython: boundscheck=False, wraparound=False, cdivision=True
from libc.stdlib cimport malloc, free
from libc.string cimport memcpy
from cython cimport inline

# Declare types
cdef inline int max(int a, int b):
    return a if a > b else b

# Efficient merge of sorted arrays
def merge_arrays(arr1, arr2):
    cdef set merged_set = set(arr1)
    merged_set.update(arr2)
    return list(merged_set)

# Two-pointer technique for efficient array comparison
def efficient_overlap_and_merge(arr1, arr2, float threshold=0.9):
    cdef int i = 0, j = 0
    cdef int intersection = 0
    cdef int len1 = len(arr1), len2 = len(arr2)
    cdef int required_intersection = int(threshold * max(len1, len2))

    arr1, arr2 = sorted(arr1), sorted(arr2)

    while i < len1 and j < len2:
        if arr1[i] == arr2[j]:
            intersection += 1
            i += 1
            j += 1
        elif arr1[i] < arr2[j]:
            i += 1
        else:
            j += 1

        # Early exit if the intersection won't reach threshold
        if intersection + min(len1 - i, len2 - j) < required_intersection:
            return False

    return intersection >= required_intersection

# Compress glossary entries using efficient merging
def compress_glossary_entries(keyword, entries):
    cdef int i, j, n = len(entries)
    merged_flags = [False] * n  # Track whether an entry is already merged

    for i in range(n):
        if merged_flags[i]:
            continue  # Skip already merged entries

        for j in range(i + 1, n):
            if merged_flags[j]:
                continue  # Skip already merged entries

            if efficient_overlap_and_merge(entries[i], entries[j]):
                # Merge arrays and mark as merged
                entries[i] = merge_arrays(entries[i], entries[j])
                merged_flags[j] = True

    # Filter out merged entries
    return [entries[i] for i in range(n) if not merged_flags[i]]
