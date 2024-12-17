# cython: boundscheck=False, wraparound=False, cdivision=True
from cython cimport inline
import cython

@cython.boundscheck(False)
@cython.wraparound(False)
def efficient_overlap_and_merge(arr1: list, arr2: list, float threshold=0.9) -> list:
    """
    Checks if `arr1` and `arr2` have sufficient overlap based on `threshold`.
    If they do, returns the merged array directly; otherwise, returns None.
    """
    cdef int len1 = len(arr1)
    cdef int len2 = len(arr2)

    # Create a shadow copy of arr1 as a set
    cdef set shadow_arr1_set = set(arr1)
    cdef int overlap = 0

    # Check overlap and modify the shadow copy inline
    for x in arr2:
        if x in shadow_arr1_set:
            overlap += 1
            shadow_arr1_set.remove(x)  # Remove matched element from the shadow copy

    # Check if overlap satisfies the threshold
    if overlap >= threshold * len1 or overlap >= threshold * len2:
        # Merge arr2 with the remaining elements of shadow_arr1_set
        return sorted(arr2 + list(shadow_arr1_set))  # Sorted to maintain order

    return None  # No sufficient overlap


@cython.boundscheck(False)
@cython.wraparound(False)
def compress_glossary_entries(keyword: str, entries: list, float threshold=0.9) -> list:
    """
    Compresses glossary entries by merging overlapping arrays.
    """
    cdef int i, j, n = len(entries)
    cdef list merged_flags = [False] * n  # Track whether an entry is already merged

    for i in range(n):
        if merged_flags[i]:
            continue  # Skip already merged entries

        for j in range(i + 1, n):
            if merged_flags[j]:
                continue  # Skip already merged entries

            # Pass the threshold parameter to efficient_overlap_and_merge
            merged_result = efficient_overlap_and_merge(entries[i], entries[j], threshold)
            if merged_result is not None:
                # Replace arr1 with the merged result and mark arr2 as merged
                entries[i] = merged_result
                merged_flags[j] = True

    # Filter out merged entries
    return [entries[i] for i in range(n) if not merged_flags[i]]



