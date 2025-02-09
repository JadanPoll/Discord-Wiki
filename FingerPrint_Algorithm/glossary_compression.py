from typing import List, Optional

def efficient_overlap_and_merge(arr1: List[int], arr2: List[int], threshold: float = 0.9) -> Optional[List[int]]:
    """
    Checks if `arr1` and `arr2` have sufficient overlap based on `threshold`.
    If they do, returns the merged array directly; otherwise, returns None.
    """
    len1, len2 = len(arr1), len(arr2)
    shadow_arr1_set = set(arr1)
    overlap = 0

    # Check overlap and modify the shadow copy inline
    for x in arr2:
        if x in shadow_arr1_set:
            overlap += 1
            shadow_arr1_set.remove(x)  # Remove matched element from the shadow copy

    # Check if overlap satisfies the threshold
    if overlap >= threshold * len1 or overlap >= threshold * len2:
        return sorted(arr2 + list(shadow_arr1_set))  # Sorted to maintain order
    
    return None  # No sufficient overlap

def compress_glossary_entries(keyword: str, entries: List[List[int]], threshold: float = 0.9) -> List[List[int]]:
    """
    Compresses glossary entries by merging overlapping arrays.
    """
    n = len(entries)
    merged_flags = [False] * n  # Track whether an entry is already merged

    for i in range(n):
        if merged_flags[i]:
            continue  # Skip already merged entries

        for j in range(i + 1, n):
            if merged_flags[j]:
                continue  # Skip already merged entries

            merged_result = efficient_overlap_and_merge(entries[i], entries[j], threshold)
            if merged_result is not None:
                entries[i] = merged_result
                merged_flags[j] = True

    # Filter out merged entries
    return [entries[i] for i in range(n) if not merged_flags[i]]
