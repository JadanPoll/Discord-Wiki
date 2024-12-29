def efficient_overlap_and_merge(arr1, arr2, threshold=0.9):
    len1 = len(arr1)
    len2 = len(arr2)

    shadow_arr1_set = set(arr1)
    overlap = 0

    for x in arr2:
        if x in shadow_arr1_set:
            overlap += 1
            shadow_arr1_set.remove(x)

    if overlap >= threshold * len1 or overlap >= threshold * len2:
        return sorted(arr2 + list(shadow_arr1_set))

    return None


def compress_glossary_entries(keyword, entries, threshold=0.9):
    n = len(entries)
    merged_flags = [False] * n

    for i in range(n):
        if merged_flags[i]:
            continue

        for j in range(i + 1, n):
            if merged_flags[j]:
                continue

            merged_result = efficient_overlap_and_merge(entries[i], entries[j], threshold)
            if merged_result is not None:
                entries[i] = merged_result
                merged_flags[j] = True

    return [entries[i] for i in range(n) if not merged_flags[i]]
