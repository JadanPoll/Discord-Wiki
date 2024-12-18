import math
import math
import tkinter as tk
from tkinter import ttk
from itertools import chain
import json
from dataclasses import dataclass

# --- Load Glossary ---
def load_glossary_data(file_path):
    try:
        with open(file_path, "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {file_path}: {e}")
        return {}

# --- Parameters ---
@dataclass
class CostParams:
    lambda_breadth: float = 0.5
    mu_imbalance: float = 0.5
    nu_depth: float = 0.3
    omega_coherence: float = 3.0
    relevance_threshold: float = 0.6

params = CostParams()

# Precompute group sets and sizes
def precompute_groups(groups):
    group_sets = {group: set(members) for group, members in groups.items()}
    group_sizes = {group: len(members) for group, members in group_sets.items()}
    return group_sets, group_sizes

# Cached Overlap Calculation
def cached_overlap(parent_set, child_set, cache):
    key = (id(parent_set), id(child_set))
    if key not in cache:
        cache[key] = len(parent_set & child_set)
    return cache[key]

# Optimized Cost Function
def calculate_cost(parent_set, child_set, parent_size, child_size, overlap_cache):
    # Relevance calculation
    overlap = cached_overlap(parent_set, child_set, overlap_cache)
    if overlap == 0 or child_size == 0:
        return math.inf  # Skip irrelevant pairs
    relevance = overlap / child_size
    if relevance <= params.relevance_threshold:
        return math.inf

    # Breadth and Coherence penalties
    breadth_penalty = params.lambda_breadth * max(parent_size / child_size, 1)
    coherence_penalty = params.omega_coherence * max(overlap / max(parent_size, child_size), 1e-5)
    
    # Simplified cost
    return (1 / relevance) + breadth_penalty + coherence_penalty

# Build Hierarchy Function
def build_hierarchy(groups):
    hierarchy, assigned_children = {}, set()
    group_sets, group_sizes = precompute_groups(groups)
    overlap_cache = {}  # Cache to store overlaps
    depth_tracker = {group: 0 for group in groups}

    # Sort groups by size (larger groups first)
    sorted_groups = sorted(groups.keys(), key=lambda x: group_sizes[x], reverse=False)

    # Main hierarchy-building loop
    for child in sorted_groups:
        child_set = group_sets[child]
        child_size = group_sizes[child]
        min_cost, best_parent = math.inf, None

        for parent in sorted_groups:
            if parent == child or group_sizes[parent] <= child_size:
                continue  # Skip invalid parents
            
            # Calculate cost
            cost = calculate_cost(group_sets[parent], child_set, group_sizes[parent], child_size, overlap_cache)
            
            if cost != math.inf:
                print(child,parent,cost)
            if cost < min_cost:
                min_cost, best_parent = cost, parent

                # Early exit if cost is "good enough"
                #if cost < 5.0:  
                #    break

        # Assign child to the best parent
        if best_parent:
            hierarchy.setdefault(best_parent, { "subgroups": []})
            hierarchy[best_parent]["subgroups"].append(child)
            assigned_children.add(child)
            depth_tracker[child] = depth_tracker[best_parent] + 1

    # Add unassigned groups
    for group in groups:
        if group not in assigned_children:
            hierarchy.setdefault(group, { "subgroups": []})

    return hierarchy





# --- GUI Class ---
class HierarchyGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Group Hierarchy Builder")
        self.geometry("600x500")
        self.groups = load_glossary_data("Glossary/GLOSSARY_CEMU_discord_messages.json")
        self.hierarchy = {}
        self.create_sliders()
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True)
        self.update_hierarchy()




    def create_sliders(self):
        slider_params = [
            ("Parent Size Penalty (Top Heavy)", "lambda_breadth", 0.1,3.0),
            ("Mu Imbalance Penalty", "mu_imbalance", 0.1, 3.0),
            ("Nu Depth Penalty", "nu_depth", 0.1, 3.0),
            ("Omega Coherence Penalty (Nearly Identical)", "omega_coherence", 0.1, 3.0),
            ("Relevance Threshold", "relevance_threshold", 0.1, 1.0)
        ]

        for label, key, min_val, max_val in slider_params:
            frame = tk.Frame(self)
            frame.pack(fill="x", padx=10, pady=5)
            
            tk.Label(frame, text=label, width=25, anchor="w").pack(side="left")
            
            slider = tk.Scale(frame, from_=min_val, to=max_val, resolution=0.1,
                              orient="horizontal", length=300)
            slider.set(getattr(params, key))
            slider.pack(side="right")

            # Bind slider release event to update only on release
            slider.bind("<ButtonRelease-1>", lambda event, k=key, s=slider: self.update_params(k, s.get()))

    def update_params(self, key, value):
        setattr(params, key, float(value))
        print(f"Updated {key} to {value}")
        self.update_hierarchy()

    def update_hierarchy(self):
        groups_flat = {k: list(chain.from_iterable(v if isinstance(v[0], list) else [v])) 
                       for k, v in self.groups.items()}
        self.hierarchy = build_hierarchy(groups_flat)
        #print(self.hierarchy)

        for item in self.tree.get_children():
            self.tree.delete(item)
        self.populate_tree()





    def populate_tree(self):
        def add_nodes(parent, subgroups):
            #print(parent,subgroups)
            for subgroup in subgroups:
                print(parent,subgroup)
                if self.tree.exists(subgroup):
                    self.tree.move(subgroup, parent, "end")
                else:
                    self.tree.insert(parent, "end", subgroup, text=subgroup)
                if subgroup in self.hierarchy:
                    add_nodes(subgroup, self.hierarchy[subgroup]["subgroups"])

        for group, details in self.hierarchy.items():
            if not self.tree.exists(group):
                self.tree.insert("", "end", group, text=group)
                add_nodes(group, details["subgroups"])

# --- Run Application ---
if __name__ == "__main__":
    app = HierarchyGUI()
    app.mainloop()
